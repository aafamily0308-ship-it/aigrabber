import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const lmstudioProvider: AIProviderPlugin = createProvider({
  id: 'lmstudio',
  name: 'LM Studio',
  type: 'local',
  description: 'Run local LLMs with LM Studio desktop app',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:1234',
  defaultPort: 1234,
  defaultModel: 'local-model',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:1234',
      required: true,
      defaultValue: 'http://localhost:1234',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: 'local-model',
      required: true,
      defaultValue: 'local-model',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        return { online: false, latency: 0, error: `HTTP ${response.status}` };
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
