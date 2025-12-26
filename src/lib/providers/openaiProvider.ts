import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const openaiProvider: AIProviderPlugin = createProvider({
  id: 'openai',
  name: 'OpenAI',
  type: 'cloud',
  description: 'GPT-4, GPT-4o, and other OpenAI models',
  apiFormat: 'openai',
  defaultEndpoint: 'https://api.openai.com',
  defaultPort: 443,
  defaultModel: 'gpt-4o',
  requiresApiKey: true,
  
  configFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'sk-...',
      required: true,
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ],
      defaultValue: 'gpt-4o',
    },
  ],
  
  async test(endpoint: string, apiKey?: string): Promise<TestResult> {
    if (!apiKey) {
      return { online: false, latency: 0, error: 'API key required' };
    }
    
    const start = Date.now();
    try {
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { online: false, latency: 0, error: `HTTP ${response.status}: ${error}` };
      }
      
      const data = await response.json();
      const models = data.data?.map((m: { id: string }) => m.id).filter((id: string) => 
        id.startsWith('gpt-')
      ) || [];
      
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
  
  async getModels(endpoint: string, apiKey?: string): Promise<string[]> {
    if (!apiKey) return [];
    
    try {
      const response = await fetch(`${endpoint}/v1/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id).filter((id: string) => 
        id.startsWith('gpt-')
      ) || [];
    } catch {
      return [];
    }
  },
  
  stream: (options) => streamOpenAICompatible(options, {
    'Authorization': `Bearer ${options.apiKey}`,
  }),
});
