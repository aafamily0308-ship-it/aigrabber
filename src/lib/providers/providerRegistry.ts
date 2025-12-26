// Provider Registry - Dynamic registration and management of AI providers

import type { AIProviderPlugin, APIFormat } from './providerInterface';
import { ollamaProvider } from './ollamaProvider';
import { lmstudioProvider } from './lmstudioProvider';
import { llamacppProvider } from './llamacppProvider';
import { koboldcppProvider } from './koboldcppProvider';
import { localaiProvider } from './localaiProvider';
import { textgenwebuiProvider } from './textgenwebuiProvider';
import { vllmProvider } from './vllmProvider';
import { openaiProvider } from './openaiProvider';
import { anthropicProvider } from './anthropicProvider';
import { googleProvider } from './googleProvider';
import { customProviderTemplate, createCustomProvider } from './customProvider';

// Built-in providers registry
const builtinProviders: Map<string, AIProviderPlugin> = new Map([
  // Local providers
  ['ollama', ollamaProvider],
  ['lmstudio', lmstudioProvider],
  ['llamacpp', llamacppProvider],
  ['koboldcpp', koboldcppProvider],
  ['localai', localaiProvider],
  ['textgenweb', textgenwebuiProvider],
  ['vllm', vllmProvider],
  // Cloud providers
  ['openai', openaiProvider],
  ['anthropic', anthropicProvider],
  ['google', googleProvider],
]);

// Custom providers registry (user-added)
const customProviders: Map<string, AIProviderPlugin> = new Map();

// Storage key for persisting custom providers
const CUSTOM_PROVIDERS_KEY = 'ai-command-custom-providers';

// Initialize custom providers from localStorage
function loadCustomProviders(): void {
  try {
    const stored = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
    if (stored) {
      const configs = JSON.parse(stored) as Array<{
        id: string;
        name: string;
        endpoint: string;
        apiFormat: APIFormat;
        model?: string;
        apiKey?: string;
        description?: string;
      }>;
      
      configs.forEach(config => {
        const provider = createCustomProvider(config);
        customProviders.set(config.id, provider);
      });
    }
  } catch (error) {
    console.error('Failed to load custom providers:', error);
  }
}

// Save custom providers to localStorage
function saveCustomProviders(): void {
  try {
    const configs = Array.from(customProviders.values()).map(p => ({
      id: p.id,
      name: p.name,
      endpoint: p.defaultEndpoint,
      apiFormat: p.apiFormat,
      model: p.defaultModel,
      description: p.description,
    }));
    localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Failed to save custom providers:', error);
  }
}

// Initialize on load
loadCustomProviders();

// Provider Registry API
export const providerRegistry = {
  // Get all providers (builtin + custom)
  getAll(): AIProviderPlugin[] {
    return [
      ...Array.from(builtinProviders.values()),
      ...Array.from(customProviders.values()),
    ];
  },
  
  // Get only builtin providers
  getBuiltin(): AIProviderPlugin[] {
    return Array.from(builtinProviders.values());
  },
  
  // Get only custom providers
  getCustom(): AIProviderPlugin[] {
    return Array.from(customProviders.values());
  },
  
  // Get only local providers
  getLocal(): AIProviderPlugin[] {
    return this.getAll().filter(p => p.type === 'local');
  },
  
  // Get only cloud providers
  getCloud(): AIProviderPlugin[] {
    return this.getAll().filter(p => p.type === 'cloud');
  },
  
  // Get a specific provider by ID
  get(id: string): AIProviderPlugin | undefined {
    return builtinProviders.get(id) || customProviders.get(id);
  },
  
  // Check if a provider exists
  has(id: string): boolean {
    return builtinProviders.has(id) || customProviders.has(id);
  },
  
  // Register a custom provider
  register(config: {
    id: string;
    name: string;
    endpoint: string;
    apiFormat: APIFormat;
    model?: string;
    apiKey?: string;
    description?: string;
  }): AIProviderPlugin {
    // Generate unique ID if needed
    let id = config.id || config.name.toLowerCase().replace(/\s+/g, '-');
    let counter = 1;
    while (this.has(id)) {
      id = `${config.id || config.name.toLowerCase().replace(/\s+/g, '-')}-${counter}`;
      counter++;
    }
    
    const provider = createCustomProvider({ ...config, id });
    customProviders.set(id, provider);
    saveCustomProviders();
    
    return provider;
  },
  
  // Update a custom provider
  update(id: string, config: Partial<{
    name: string;
    endpoint: string;
    apiFormat: APIFormat;
    model: string;
    apiKey: string;
    description: string;
  }>): AIProviderPlugin | undefined {
    const existing = customProviders.get(id);
    if (!existing) return undefined;
    
    const updated = createCustomProvider({
      id,
      name: config.name || existing.name,
      endpoint: config.endpoint || existing.defaultEndpoint,
      apiFormat: config.apiFormat || existing.apiFormat,
      model: config.model || existing.defaultModel,
      description: config.description || existing.description,
    });
    
    customProviders.set(id, updated);
    saveCustomProviders();
    
    return updated;
  },
  
  // Remove a custom provider
  remove(id: string): boolean {
    if (!customProviders.has(id)) return false;
    customProviders.delete(id);
    saveCustomProviders();
    return true;
  },
  
  // Get the custom provider template
  getTemplate(): AIProviderPlugin {
    return customProviderTemplate;
  },
  
  // Export all custom providers configuration
  exportConfig(): string {
    const configs = Array.from(customProviders.values()).map(p => ({
      id: p.id,
      name: p.name,
      endpoint: p.defaultEndpoint,
      apiFormat: p.apiFormat,
      model: p.defaultModel,
      description: p.description,
    }));
    return JSON.stringify(configs, null, 2);
  },
  
  // Import custom providers from config
  importConfig(json: string): number {
    try {
      const configs = JSON.parse(json) as Array<{
        id: string;
        name: string;
        endpoint: string;
        apiFormat: APIFormat;
        model?: string;
        description?: string;
      }>;
      
      let imported = 0;
      configs.forEach(config => {
        if (!this.has(config.id)) {
          this.register(config);
          imported++;
        }
      });
      
      return imported;
    } catch {
      return 0;
    }
  },
  
  // Auto-detect provider type from endpoint
  async detectProviderType(endpoint: string): Promise<{
    format: APIFormat;
    models: string[];
  } | null> {
    // Try OpenAI-compatible first
    try {
      const response = await fetch(`${endpoint}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json();
        return {
          format: 'openai',
          models: data.data?.map((m: { id: string }) => m.id) || [],
        };
      }
    } catch { /* continue */ }
    
    // Try Ollama
    try {
      const response = await fetch(`${endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json();
        return {
          format: 'ollama',
          models: data.models?.map((m: { name: string }) => m.name) || [],
        };
      }
    } catch { /* continue */ }
    
    // Try KoboldCpp
    try {
      const response = await fetch(`${endpoint}/api/v1/info`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        return {
          format: 'koboldcpp',
          models: ['kobold'],
        };
      }
    } catch { /* continue */ }
    
    return null;
  },
};

// Re-export types and utilities
export type { AIProviderPlugin, APIFormat, StreamOptions, AIMessage, ConfigField, TestResult } from './providerInterface';
export { createProvider, streamOpenAICompatible, streamOllamaCompatible } from './providerInterface';
