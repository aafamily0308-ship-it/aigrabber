import { createProvider, streamOpenAICompatible, streamOllamaCompatible, type AIProviderPlugin, type TestResult, type StreamOptions, type APIFormat } from './providerInterface';

// Factory function to create custom providers
export function createCustomProvider(config: {
  id: string;
  name: string;
  endpoint: string;
  apiFormat: APIFormat;
  model?: string;
  apiKey?: string;
  description?: string;
}): AIProviderPlugin {
  const { id, name, endpoint, apiFormat, model = 'default', apiKey, description } = config;
  
  return createProvider({
    id,
    name,
    type: 'custom',
    description: description || `Custom provider: ${name}`,
    apiFormat,
    defaultEndpoint: endpoint,
    defaultPort: parseInt(new URL(endpoint).port) || 80,
    defaultModel: model,
    requiresApiKey: !!apiKey,
    
    configFields: [
      {
        key: 'endpoint',
        label: 'Endpoint URL',
        type: 'text',
        placeholder: endpoint,
        required: true,
        defaultValue: endpoint,
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        placeholder: model,
        required: true,
        defaultValue: model,
      },
      ...(apiKey ? [{
        key: 'apiKey' as const,
        label: 'API Key' as const,
        type: 'password' as const,
        required: true,
      }] : []),
    ],
    
    async test(testEndpoint: string, testApiKey?: string): Promise<TestResult> {
      const start = Date.now();
      try {
        let testUrl = '';
        const headers: Record<string, string> = {};
        
        switch (apiFormat) {
          case 'openai':
            testUrl = `${testEndpoint}/v1/models`;
            if (testApiKey) headers['Authorization'] = `Bearer ${testApiKey}`;
            break;
          case 'ollama':
            testUrl = `${testEndpoint}/api/tags`;
            break;
          default:
            testUrl = `${testEndpoint}/health`;
        }
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) {
          return { online: false, latency: 0, error: `HTTP ${response.status}` };
        }
        
        return {
          online: true,
          latency: Date.now() - start,
          models: [model],
        };
      } catch (error) {
        return {
          online: false,
          latency: 0,
          error: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
    
    async getModels(): Promise<string[]> {
      return [model];
    },
    
    async stream(options: StreamOptions): Promise<void> {
      switch (apiFormat) {
        case 'ollama':
          return streamOllamaCompatible(options);
        case 'openai':
        default:
          return streamOpenAICompatible(options, 
            options.apiKey ? { 'Authorization': `Bearer ${options.apiKey}` } : {}
          );
      }
    },
  });
}

// Default custom provider template
export const customProviderTemplate: AIProviderPlugin = createProvider({
  id: 'custom',
  name: 'Custom Provider',
  type: 'custom',
  description: 'Add your own OpenAI-compatible or Ollama-compatible API',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:8080',
  defaultPort: 8080,
  defaultModel: 'default',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'name',
      label: 'Provider Name',
      type: 'text',
      placeholder: 'My Custom Provider',
      required: true,
    },
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:8080',
      required: true,
    },
    {
      key: 'apiFormat',
      label: 'API Format',
      type: 'select',
      options: [
        { value: 'openai', label: 'OpenAI Compatible' },
        { value: 'ollama', label: 'Ollama Compatible' },
      ],
      defaultValue: 'openai',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: 'default',
      required: true,
    },
    {
      key: 'apiKey',
      label: 'API Key (optional)',
      type: 'password',
      required: false,
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${endpoint}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      
      return {
        online: response.ok,
        latency: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        online: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  },
  
  async getModels(): Promise<string[]> {
    return ['default'];
  },
  
  stream: (options) => streamOpenAICompatible(options),
});
