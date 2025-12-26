// Universal Provider Interface - Plugin system for AI providers

export type APIFormat = 'openai' | 'ollama' | 'anthropic' | 'google' | 'koboldcpp' | 'custom';
export type ProviderType = 'local' | 'cloud' | 'custom';

export interface StreamOptions {
  endpoint: string;
  model: string;
  messages: AIMessage[];
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
}

export interface TestResult {
  online: boolean;
  latency: number;
  error?: string;
  models?: string[];
}

export interface AIProviderPlugin {
  // Identification
  id: string;
  name: string;
  type: ProviderType;
  description: string;
  icon?: string;
  
  // API compatibility
  apiFormat: APIFormat;
  
  // Default settings
  defaultEndpoint: string;
  defaultPort: number;
  defaultModel?: string;
  
  // Requires API key
  requiresApiKey: boolean;
  
  // Methods
  test: (endpoint: string, apiKey?: string) => Promise<TestResult>;
  stream: (options: StreamOptions) => Promise<void>;
  getModels: (endpoint: string, apiKey?: string) => Promise<string[]>;
  
  // UI configuration fields
  configFields: ConfigField[];
  
  // Optional: Custom request transformer
  transformRequest?: (messages: AIMessage[], model: string) => unknown;
  
  // Optional: Custom response parser
  parseResponse?: (chunk: string) => string;
}

// Helper to create a provider plugin
export function createProvider(config: AIProviderPlugin): AIProviderPlugin {
  return config;
}

// Standard OpenAI-compatible streaming implementation
export async function streamOpenAICompatible(
  options: StreamOptions,
  headers: Record<string, string> = {}
): Promise<void> {
  const { endpoint, model, messages, onToken, onComplete, onError, signal, temperature = 0.7, maxTokens = 2048 } = options;
  
  try {
    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onToken(content);
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }
    
    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// Standard Ollama streaming implementation
export async function streamOllamaCompatible(
  options: StreamOptions
): Promise<void> {
  const { endpoint, model, messages, onToken, onComplete, onError, signal, temperature = 0.7 } = options;
  
  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature },
      }),
      signal,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            onToken(parsed.message.content);
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
    
    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
