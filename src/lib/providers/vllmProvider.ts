import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const vllmProvider: AIProviderPlugin = createProvider({
  id: 'vllm',
  name: 'vLLM',
  type: 'local',
  description: 'High-throughput LLM inference engine with PagedAttention',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:8000',
  defaultPort: 8000,
  defaultModel: 'default',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:8000',
      required: true,
      defaultValue: 'http://localhost:8000',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: 'meta-llama/Llama-2-7b-hf',
      required: true,
      defaultValue: 'default',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      // vLLM uses OpenAI-compatible API
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        // Try health endpoint
        const healthResponse = await fetch(`${endpoint}/health`, {
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
