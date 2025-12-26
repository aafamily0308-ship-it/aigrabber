import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult, type StreamOptions } from './providerInterface';

export const llamacppProvider: AIProviderPlugin = createProvider({
  id: 'llamacpp',
  name: 'llama.cpp Server',
  type: 'local',
  description: 'High-performance C++ inference with llama.cpp server',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:8080',
  defaultPort: 8080,
  defaultModel: 'default',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:8080',
      required: true,
      defaultValue: 'http://localhost:8080',
    },
    {
      key: 'model',
      label: 'Model Name',
      type: 'text',
      placeholder: 'default',
      required: false,
      defaultValue: 'default',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      // llama.cpp server has /health endpoint
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        // Try /v1/models as fallback
        const modelsResponse = await fetch(`${endpoint}/v1/models`, {
          signal: AbortSignal.timeout(5000),
        });
        
        if (!modelsResponse.ok) {
          return { online: false, latency: 0, error: `HTTP ${response.status}` };
        }
      }
      
      return {
        online: true,
        latency: Date.now() - start,
        models: ['default'],
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
      const response = await fetch(`${endpoint}/v1/models`);
      if (!response.ok) return ['default'];
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || ['default'];
    } catch {
      return ['default'];
    }
  },
  
  async stream(options: StreamOptions): Promise<void> {
    // llama.cpp supports OpenAI-compatible API
    return streamOpenAICompatible(options);
  },
});
