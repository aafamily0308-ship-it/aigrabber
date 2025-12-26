import { createProvider, type AIProviderPlugin, type TestResult, type StreamOptions } from './providerInterface';

export const anthropicProvider: AIProviderPlugin = createProvider({
  id: 'anthropic',
  name: 'Anthropic',
  type: 'cloud',
  description: 'Claude 3.5, Claude 3 Opus, Sonnet, and Haiku models',
  apiFormat: 'anthropic',
  defaultEndpoint: 'https://api.anthropic.com',
  defaultPort: 443,
  defaultModel: 'claude-3-5-sonnet-20241022',
  requiresApiKey: true,
  
  configFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'sk-ant-...',
      required: true,
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ],
      defaultValue: 'claude-3-5-sonnet-20241022',
    },
  ],
  
  async test(_endpoint: string, apiKey?: string): Promise<TestResult> {
    if (!apiKey) {
      return { online: false, latency: 0, error: 'API key required' };
    }
    
    const start = Date.now();
    try {
      // Anthropic doesn't have a models endpoint, so we do a minimal completion
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { online: false, latency: 0, error: `HTTP ${response.status}: ${error}` };
      }
      
      return {
        online: true,
        latency: Date.now() - start,
        models: [
          'claude-3-5-sonnet-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ],
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
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  },
  
  async stream(options: StreamOptions): Promise<void> {
    const { model, messages, apiKey, onToken, onComplete, onError, signal, maxTokens = 2048 } = options;
    
    if (!apiKey) {
      onError(new Error('API key required'));
      return;
    }
    
    try {
      // Convert messages to Anthropic format
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemMessage,
          messages: chatMessages,
          stream: true,
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
            if (!data || data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                onToken(parsed.delta.text);
              }
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
  },
});
