import { createProvider, streamOpenAICompatible, type AIProviderPlugin, type TestResult } from './providerInterface';

export const textgenwebuiProvider: AIProviderPlugin = createProvider({
  id: 'textgenweb',
  name: 'Text Generation WebUI',
  type: 'local',
  description: 'Gradio-based web UI for text generation (oobabooga)',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:5000',
  defaultPort: 5000,
  defaultModel: 'default',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:5000',
      required: true,
      defaultValue: 'http://localhost:5000',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: 'default',
      required: false,
      defaultValue: 'default',
    },
    {
      key: 'apiType',
      label: 'API Type',
      type: 'select',
      options: [
        { value: 'openai', label: 'OpenAI Compatible' },
        { value: 'blocking', label: 'Blocking API' },
      ],
      defaultValue: 'openai',
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      // Try OpenAI-compatible endpoint first
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: { id: string }) => m.id) || [];
        return {
          online: true,
          latency: Date.now() - start,
          models,
        };
      }
      
      // Try internal model endpoint
      const internalResponse = await fetch(`${endpoint}/api/v1/model`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (internalResponse.ok) {
        const data = await internalResponse.json();
        return {
          online: true,
          latency: Date.now() - start,
          models: data.result ? [data.result] : [],
        };
      }
      
      return { online: false, latency: 0, error: `HTTP ${response.status}` };
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
      // Try OpenAI-compatible endpoint
      const response = await fetch(`${endpoint}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        return data.data?.map((m: { id: string }) => m.id) || [];
      }
      
      // Try internal API
      const internalResponse = await fetch(`${endpoint}/api/v1/model`);
      if (internalResponse.ok) {
        const data = await internalResponse.json();
        return data.result ? [data.result] : [];
      }
      
      return [];
    } catch {
      return [];
    }
  },
  
  stream: (options) => streamOpenAICompatible(options),
});
