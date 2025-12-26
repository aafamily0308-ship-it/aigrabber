import { createProvider, type AIProviderPlugin, type TestResult, type StreamOptions } from './providerInterface';

export const googleProvider: AIProviderPlugin = createProvider({
  id: 'google',
  name: 'Google Gemini',
  type: 'cloud',
  description: 'Gemini Pro, Gemini Flash and other Google AI models',
  apiFormat: 'google',
  defaultEndpoint: 'https://generativelanguage.googleapis.com',
  defaultPort: 443,
  defaultModel: 'gemini-1.5-flash',
  requiresApiKey: true,
  
  configFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'AIza...',
      required: true,
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-pro', label: 'Gemini Pro' },
      ],
      defaultValue: 'gemini-1.5-flash',
    },
  ],
  
  async test(endpoint: string, apiKey?: string): Promise<TestResult> {
    if (!apiKey) {
      return { online: false, latency: 0, error: 'API key required' };
    }
    
    const start = Date.now();
    try {
      const response = await fetch(
        `${endpoint}/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { online: false, latency: 0, error: `HTTP ${response.status}: ${error}` };
      }
      
      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => 
        m.name.replace('models/', '')
      ).filter((name: string) => name.startsWith('gemini')) || [];
      
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
      const response = await fetch(`${endpoint}/v1beta/models?key=${apiKey}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: { name: string }) => 
        m.name.replace('models/', '')
      ).filter((name: string) => name.startsWith('gemini')) || [];
    } catch {
      return [];
    }
  },
  
  async stream(options: StreamOptions): Promise<void> {
    const { endpoint, model, messages, apiKey, onToken, onComplete, onError, signal } = options;
    
    if (!apiKey) {
      onError(new Error('API key required'));
      return;
    }
    
    try {
      // Convert to Gemini format
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      
      const response = await fetch(
        `${endpoint}/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
          }),
          signal,
        }
      );
      
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
            if (!data) continue;
            
            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) onToken(text);
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
