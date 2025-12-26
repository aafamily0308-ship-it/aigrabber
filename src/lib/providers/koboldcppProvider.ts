import { createProvider, type AIProviderPlugin, type TestResult, type StreamOptions } from './providerInterface';

export const koboldcppProvider: AIProviderPlugin = createProvider({
  id: 'koboldcpp',
  name: 'KoboldCpp',
  type: 'local',
  description: 'Easy-to-use llama.cpp wrapper with CUDA/ROCm support',
  apiFormat: 'koboldcpp',
  defaultEndpoint: 'http://localhost:5001',
  defaultPort: 5001,
  defaultModel: 'kobold',
  requiresApiKey: false,
  
  configFields: [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      placeholder: 'http://localhost:5001',
      required: true,
      defaultValue: 'http://localhost:5001',
    },
    {
      key: 'maxLength',
      label: 'Max Length',
      type: 'number',
      placeholder: '200',
      required: false,
      defaultValue: 200,
    },
  ],
  
  async test(endpoint: string): Promise<TestResult> {
    const start = Date.now();
    try {
      // KoboldCpp has /api/v1/info endpoint
      const response = await fetch(`${endpoint}/api/v1/info`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        // Try /api/extra/version as fallback
        const versionResponse = await fetch(`${endpoint}/api/extra/version`, {
          signal: AbortSignal.timeout(5000),
        });
        
        if (!versionResponse.ok) {
          return { online: false, latency: 0, error: `HTTP ${response.status}` };
        }
      }
      
      return {
        online: true,
        latency: Date.now() - start,
        models: ['kobold'],
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
    // KoboldCpp loads one model at a time
    return ['kobold'];
  },
  
  async stream(options: StreamOptions): Promise<void> {
    const { endpoint, messages, onToken, onComplete, onError, signal, maxTokens = 200 } = options;
    
    try {
      // Build prompt from messages
      const prompt = messages.map(m => {
        if (m.role === 'system') return `System: ${m.content}`;
        if (m.role === 'user') return `User: ${m.content}`;
        return `Assistant: ${m.content}`;
      }).join('\n') + '\nAssistant:';
      
      // KoboldCpp streaming via SSE
      const response = await fetch(`${endpoint}/api/extra/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_length: maxTokens,
          temperature: 0.7,
          top_p: 0.9,
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
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                onToken(parsed.token);
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
