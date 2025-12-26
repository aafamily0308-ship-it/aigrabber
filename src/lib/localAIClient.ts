// Unified AI Client for direct requests to AI providers
// Supports: Ollama, LM Studio, OpenAI, Google AI, Anthropic

export type AIProvider = 
  | 'ollama' 
  | 'lmstudio' 
  | 'llamacpp'
  | 'koboldcpp'
  | 'localai'
  | 'textgenweb'
  | 'vllm'
  | 'openai' 
  | 'google' 
  | 'anthropic'
  // Legacy aliases
  | 'local-ollama' 
  | 'local-lmstudio' 
  | 'cloud-openai' 
  | 'cloud-google' 
  | 'cloud-anthropic'
  | 'cloud-gemini'
  | 'cloud-gpt5';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  provider: AIProvider;
  messages: AIMessage[];
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface ProviderConfig {
  ollama: {
    baseUrl: string;
    model: string;
  };
  lmstudio: {
    baseUrl: string;
    model: string;
  };
  openai: {
    baseUrl: string;
    model: string;
  };
  google: {
    baseUrl: string;
    model: string;
  };
  anthropic: {
    baseUrl: string;
    model: string;
  };
}

export const defaultConfig: ProviderConfig = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234',
    model: 'local-model',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
  },
};

// Check if a provider is local
export function isLocalProvider(provider: AIProvider): boolean {
  return provider.startsWith('local-');
}

// Check if a cloud provider needs API key
export function needsApiKey(provider: AIProvider): boolean {
  return !isLocalProvider(provider);
}

// Map legacy provider names to new ones
function normalizeProvider(provider: AIProvider): AIProvider {
  const mapping: Record<string, AIProvider> = {
    'cloud-gemini': 'google',
    'cloud-gpt5': 'openai',
    'cloud-google': 'google',
    'cloud-openai': 'openai',
    'cloud-anthropic': 'anthropic',
    'local-ollama': 'ollama',
    'local-lmstudio': 'lmstudio',
  };
  return mapping[provider] || provider;
}

// Stream AI response from Ollama
async function streamOllama(options: AIRequestOptions): Promise<void> {
  const { messages, temperature = 0.7, maxTokens = 4096, systemPrompt, signal, onToken, onError, onComplete } = options;

  const allMessages = systemPrompt 
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  try {
    const response = await fetch(`${defaultConfig.ollama.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultConfig.ollama.model,
        messages: allMessages,
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}. Make sure Ollama is running.`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            onToken(parsed.message.content);
          }
        } catch {}
      }
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Ollama request failed'));
  }
}

// Stream AI response from LM Studio
async function streamLMStudio(options: AIRequestOptions): Promise<void> {
  const { messages, temperature = 0.7, maxTokens = 4096, systemPrompt, signal, onToken, onError, onComplete } = options;

  const allMessages = systemPrompt 
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  try {
    const response = await fetch(`${defaultConfig.lmstudio.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultConfig.lmstudio.model,
        messages: allMessages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status}. Make sure LM Studio is running.`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onToken(content);
            }
          } catch {}
        }
      }
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('LM Studio request failed'));
  }
}

// Stream AI response from OpenAI
async function streamOpenAI(options: AIRequestOptions): Promise<void> {
  const { messages, apiKey, temperature = 0.7, maxTokens = 4096, systemPrompt, signal, onToken, onError, onComplete } = options;

  if (!apiKey) {
    onError?.(new Error('OpenAI API key is required. Add it in Settings.'));
    return;
  }

  const allMessages = systemPrompt 
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  try {
    const response = await fetch(`${defaultConfig.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: defaultConfig.openai.model,
        messages: allMessages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      }
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onToken(content);
          }
        } catch {}
      }
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('OpenAI request failed'));
  }
}

// Stream AI response from Google AI (Gemini)
async function streamGoogle(options: AIRequestOptions): Promise<void> {
  const { messages, apiKey, temperature = 0.7, maxTokens = 4096, systemPrompt, signal, onToken, onError, onComplete } = options;

  if (!apiKey) {
    onError?.(new Error('Google AI API key is required. Add it in Settings.'));
    return;
  }

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Add system instruction if present
  const systemInstruction = systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined;

  try {
    const response = await fetch(
      `${defaultConfig.google.baseUrl}/models/${defaultConfig.google.model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        signal,
      }
    );

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid Google AI API key');
      }
      if (response.status === 429) {
        throw new Error('Google AI rate limit exceeded');
      }
      throw new Error(`Google AI error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Google AI returns JSON objects, try to parse complete objects
      try {
        // Try to find complete JSON objects in the buffer
        const jsonMatch = buffer.match(/\{[\s\S]*?"text":\s*"([^"]*)"[\s\S]*?\}/);
        if (jsonMatch) {
          const text = jsonMatch[1];
          if (text) {
            // Unescape the text
            const unescaped = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            onToken(unescaped);
          }
          // Remove processed part from buffer
          buffer = buffer.slice(jsonMatch.index! + jsonMatch[0].length);
        }
      } catch {}
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Google AI request failed'));
  }
}

// Stream AI response from Anthropic (Claude)
async function streamAnthropic(options: AIRequestOptions): Promise<void> {
  const { messages, apiKey, temperature = 0.7, maxTokens = 4096, systemPrompt, signal, onToken, onError, onComplete } = options;

  if (!apiKey) {
    onError?.(new Error('Anthropic API key is required. Add it in Settings.'));
    return;
  }

  try {
    const response = await fetch(`${defaultConfig.anthropic.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: defaultConfig.anthropic.model,
        messages: messages.filter(m => m.role !== 'system'),
        system: systemPrompt || messages.find(m => m.role === 'system')?.content,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Anthropic API key');
      }
      if (response.status === 429) {
        throw new Error('Anthropic rate limit exceeded');
      }
      throw new Error(`Anthropic error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '' || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onToken(parsed.delta.text);
          }
        } catch {}
      }
    }

    onComplete?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Anthropic request failed'));
  }
}

// Main streaming function - routes to appropriate provider
export async function streamAI(options: AIRequestOptions): Promise<void> {
  const provider = normalizeProvider(options.provider);

  switch (provider) {
    case 'ollama':
      return streamOllama(options);
    case 'lmstudio':
    case 'llamacpp':
    case 'localai':
    case 'textgenweb':
    case 'vllm':
      return streamLMStudio(options);
    case 'openai':
      return streamOpenAI(options);
    case 'google':
      return streamGoogle(options);
    case 'anthropic':
      return streamAnthropic(options);
    case 'koboldcpp':
      // KoboldCpp uses a different format, fallback to LMStudio-style
      return streamLMStudio(options);
    default:
      options.onError?.(new Error(`Unknown provider: ${provider}`));
  }
}

// Test provider connection
export async function testProvider(provider: AIProvider, apiKey?: string): Promise<{ success: boolean; message: string }> {
  const normalized = normalizeProvider(provider);

  try {
    if (normalized === 'local-ollama') {
      const response = await fetch(`${defaultConfig.ollama.baseUrl}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { success: true, message: 'Ollama is running' };
      }
      return { success: false, message: 'Ollama not responding' };
    }

    if (normalized === 'local-lmstudio') {
      const response = await fetch(`${defaultConfig.lmstudio.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { success: true, message: 'LM Studio is running' };
      }
      return { success: false, message: 'LM Studio not responding' };
    }

    if (normalized === 'cloud-openai') {
      if (!apiKey) return { success: false, message: 'API key required' };
      const response = await fetch(`${defaultConfig.openai.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { success: true, message: 'OpenAI key is valid' };
      }
      if (response.status === 401) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: 'OpenAI error' };
    }

    if (normalized === 'cloud-google') {
      if (!apiKey) return { success: false, message: 'API key required' };
      const response = await fetch(
        `${defaultConfig.google.baseUrl}/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (response.ok) {
        return { success: true, message: 'Google AI key is valid' };
      }
      if (response.status === 400) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: 'Google AI error' };
    }

    if (normalized === 'cloud-anthropic') {
      if (!apiKey) return { success: false, message: 'API key required' };
      // Anthropic doesn't have a simple models endpoint, so we just check the key format
      if (apiKey.startsWith('sk-ant-')) {
        return { success: true, message: 'Anthropic key format is valid' };
      }
      return { success: false, message: 'Invalid key format (should start with sk-ant-)' };
    }

    return { success: false, message: 'Unknown provider' };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        return { success: false, message: 'Connection timeout' };
      }
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Connection failed' };
  }
}

// Get provider display name
export function getProviderDisplayName(provider: AIProvider): string {
  const names: Partial<Record<AIProvider, string>> = {
    'ollama': 'Ollama',
    'lmstudio': 'LM Studio',
    'llamacpp': 'llama.cpp',
    'koboldcpp': 'KoboldCpp',
    'localai': 'LocalAI',
    'textgenweb': 'Text Gen WebUI',
    'vllm': 'vLLM',
    'openai': 'OpenAI',
    'google': 'Google AI',
    'anthropic': 'Anthropic',
    'local-ollama': 'Ollama',
    'local-lmstudio': 'LM Studio',
    'cloud-openai': 'OpenAI',
    'cloud-google': 'Google AI',
    'cloud-anthropic': 'Anthropic',
    'cloud-gemini': 'Google AI',
    'cloud-gpt5': 'OpenAI',
  };
  return names[provider] || provider;
}
