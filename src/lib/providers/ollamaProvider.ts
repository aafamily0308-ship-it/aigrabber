import { createProvider, streamOllamaCompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const ollamaProvider: AIProviderPlugin = createProvider({
  id: 'ollama',
  name: 'Ollama',
  type: 'local',
  description: 'Run large language models locally with Ollama',
  apiFormat: 'ollama',
  defaultEndpoint: 'http://localhost:11434',
  defaultPort: 11434,
  defaultModel: 'llama3.2',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:11434',
      required: true,
      defaultValue: 'http://localhost:11434',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: 'llama3.2',
      required: true,
      defaultValue: 'llama3.2',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        return { online: false, latency: 0, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];
      
      return {
        online: true,
        latency: Date.now() - start,
        models,
      };
    } catch (error) {
      return {
        online: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  },
  
  async getModels(endpoint: string): Promise<string[]> {
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  },
  
  stream: streamOllamaCompatible,
});
