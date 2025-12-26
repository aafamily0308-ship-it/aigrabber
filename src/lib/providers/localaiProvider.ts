import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const localaiProvider: AIProviderPlugin = createProvider({
  id: 'localai',
  name: 'LocalAI',
  type: 'local',
  description: 'Self-hosted OpenAI-compatible API with multiple model support',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:8080',
  defaultPort: 8080,
  defaultModel: 'gpt-3.5-turbo',
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
      label: 'Model',
      type: 'text',
      placeholder: 'gpt-3.5-turbo',
      required: true,
      defaultValue: 'gpt-3.5-turbo',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      // LocalAI supports OpenAI-compatible /v1/models endpoint
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        // Try /readyz health check
        const healthResponse = await fetch(`${endpoint}/readyz`, {
          signal: AbortSignal.timeout(5000),
        });
        
        if (!healthResponse.ok) {
          return { online: false, latency: 0, error: `HTTP ${response.status}` };
        }
        
        return {
          online: true,
          latency: Date.now() - start,
          models: [],
        };
      }
      
      const data = await response.json();
      const models = data.data?.map((m: { id: string }) => m.id) || [];
      
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
      const response = await fetch(`${endpoint}/v1/models`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || [];
    } catch {
      return [];
    }
  },
  
  stream: (options) => streamOpenAICompatible(options),
});
