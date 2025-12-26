// Model Orchestrator - Automatic model selection based on task type
// Phase 2: Intelligent Core

import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/lib/providers';

export type ProviderId = string;

export type TaskType = 
  | 'code'
  | 'creative'
  | 'analysis'
  | 'conversation'
  | 'translation'
  | 'summarization'
  | 'long-context'
  | 'quick';

export interface ModelCapabilities {
  providerId: ProviderId;
  name: string;
  strengths: TaskType[];
  contextWindow: number;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'free' | 'low' | 'medium' | 'high';
  isLocal: boolean;
}

// Model registry with capabilities
export const modelRegistry: ModelCapabilities[] = [
  // Local providers
  {
    providerId: 'ollama',
    name: 'Ollama (Llama 3.2)',
    strengths: ['code', 'conversation', 'quick'],
    contextWindow: 8192,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'lmstudio',
    name: 'LM Studio',
    strengths: ['code', 'conversation', 'creative'],
    contextWindow: 8192,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'llamacpp',
    name: 'llama.cpp Server',
    strengths: ['code', 'conversation', 'quick'],
    contextWindow: 4096,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'koboldcpp',
    name: 'KoboldCpp',
    strengths: ['creative', 'conversation'],
    contextWindow: 4096,
    speed: 'medium',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'localai',
    name: 'LocalAI',
    strengths: ['code', 'conversation', 'analysis'],
    contextWindow: 8192,
    speed: 'medium',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'textgenweb',
    name: 'Text Generation WebUI',
    strengths: ['creative', 'conversation'],
    contextWindow: 4096,
    speed: 'medium',
    cost: 'free',
    isLocal: true,
  },
  {
    providerId: 'vllm',
    name: 'vLLM',
    strengths: ['code', 'analysis', 'long-context'],
    contextWindow: 32768,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  // Cloud providers
  {
    providerId: 'google',
    name: 'Google Gemini',
    strengths: ['long-context', 'analysis', 'summarization', 'creative'],
    contextWindow: 1000000,
    speed: 'medium',
    cost: 'medium',
    isLocal: false,
  },
  {
    providerId: 'openai',
    name: 'OpenAI GPT-4o',
    strengths: ['code', 'creative', 'analysis', 'conversation'],
    contextWindow: 128000,
    speed: 'medium',
    cost: 'high',
    isLocal: false,
  },
  {
    providerId: 'anthropic',
    name: 'Anthropic Claude',
    strengths: ['code', 'analysis', 'creative', 'long-context'],
    contextWindow: 200000,
    speed: 'medium',
    cost: 'high',
    isLocal: false,
  },
];

export interface OrchestratorConfig {
  preferLocal: boolean;
  fallbackToCloud: boolean;
  maxContextRatio: number;
  speedPriority: 'fast' | 'balanced' | 'quality';
}

export const defaultOrchestratorConfig: OrchestratorConfig = {
  preferLocal: true,
  fallbackToCloud: true,
  maxContextRatio: 0.8,
  speedPriority: 'balanced',
};

export function detectTaskType(message: string): TaskType {
  const lowerMessage = message.toLowerCase();
  
  const codePatterns = [
    /```[\s\S]*```/,
    /\b(function|const|let|var|class|def|import|export)\b/,
    /\b(debug|error|exception|bug|fix|code|programming|javascript|python|typescript|react|api)\b/i,
  ];
  if (codePatterns.some(p => p.test(message))) {
    return 'code';
  }

  if (/\b(translate|перевод|переведи|translation|в|на)\b/i.test(lowerMessage) && 
      /\b(english|russian|spanish|french|german|chinese|русский|английский)\b/i.test(lowerMessage)) {
    return 'translation';
  }

  if (/\b(summarize|summary|краткое|резюме|кратко|tl;dr|tldr)\b/i.test(lowerMessage)) {
    return 'summarization';
  }

  if (/\b(analyze|analysis|анализ|compare|comparison|evaluate|assess|explain why|reasoning)\b/i.test(lowerMessage)) {
    return 'analysis';
  }

  if (/\b(write|create|story|poem|creative|imagine|brainstorm|idea|напиши|придумай)\b/i.test(lowerMessage)) {
    return 'creative';
  }

  if (message.length > 10000) {
    return 'long-context';
  }

  if (message.length < 100 && !message.includes('?')) {
    return 'quick';
  }

  return 'conversation';
}

export function estimateTokenCount(text: string): number {
  const hasRussian = /[а-яА-ЯёЁ]/.test(text);
  const charsPerToken = hasRussian ? 2 : 4;
  return Math.ceil(text.length / charsPerToken);
}

export function selectModel(
  taskType: TaskType,
  messageLength: number,
  availableProviders: ProviderId[],
  config: OrchestratorConfig = defaultOrchestratorConfig
): ProviderId {
  const estimatedTokens = estimateTokenCount(new Array(messageLength).fill('a').join(''));
  
  const availableModels = modelRegistry.filter(m => 
    availableProviders.includes(m.providerId)
  );

  if (availableModels.length === 0) {
    return 'ollama';
  }

  const scoredModels = availableModels.map(model => {
    let score = 0;

    if (model.strengths.includes(taskType)) {
      score += 30;
    }

    const maxUsableContext = model.contextWindow * config.maxContextRatio;
    if (estimatedTokens <= maxUsableContext) {
      score += 20;
    } else {
      score -= 50;
    }

    if (config.preferLocal && model.isLocal) {
      score += 15;
    }

    if (config.speedPriority === 'fast') {
      if (model.speed === 'fast') score += 20;
      if (model.speed === 'slow') score -= 10;
    } else if (config.speedPriority === 'quality') {
      if (model.speed === 'slow') score += 10;
      if (model.cost === 'high') score += 5;
    }

    if (model.cost === 'free') score += 10;
    if (model.cost === 'high') score -= 5;

    return { model, score };
  });

  scoredModels.sort((a, b) => b.score - a.score);

  return scoredModels[0].model.providerId;
}

export function getFallbackChain(
  primaryProvider: ProviderId,
  availableProviders: ProviderId[]
): ProviderId[] {
  const chain: ProviderId[] = [primaryProvider];
  
  const providers = useProviderStore.getState().providers;
  const isLocalPrimary = providers.find(p => p.id === primaryProvider)?.type === 'local';
  
  if (isLocalPrimary) {
    const otherLocal = availableProviders.filter(id => {
      const p = providers.find(pr => pr.id === id);
      return p?.type === 'local' && id !== primaryProvider;
    });
    const cloudProviders = availableProviders.filter(id => {
      const p = providers.find(pr => pr.id === id);
      return p?.type !== 'local';
    });
    chain.push(...otherLocal, ...cloudProviders);
  } else {
    const otherCloud = availableProviders.filter(id => {
      const p = providers.find(pr => pr.id === id);
      return p?.type !== 'local' && id !== primaryProvider;
    });
    const localProviders = availableProviders.filter(id => {
      const p = providers.find(pr => pr.id === id);
      return p?.type === 'local';
    });
    chain.push(...otherCloud, ...localProviders);
  }

  return chain.filter((p, i, arr) => arr.indexOf(p) === i);
}

export function orchestrate(
  message: string,
  conversationHistory: string[],
  availableProviders: ProviderId[],
  config?: Partial<OrchestratorConfig>
): {
  selectedProvider: ProviderId;
  taskType: TaskType;
  fallbackChain: ProviderId[];
  reasoning: string;
} {
  const fullConfig = { ...defaultOrchestratorConfig, ...config };
  
  const fullContext = [...conversationHistory.slice(-5), message].join('\n');
  
  const taskType = detectTaskType(message);
  const selectedProvider = selectModel(
    taskType,
    fullContext.length,
    availableProviders,
    fullConfig
  );
  const fallbackChain = getFallbackChain(selectedProvider, availableProviders);

  const modelInfo = modelRegistry.find(m => m.providerId === selectedProvider);
  const reasoning = `Task: ${taskType} → Model: ${modelInfo?.name || selectedProvider} (${modelInfo?.strengths.join(', ')})`;

  return {
    selectedProvider,
    taskType,
    fallbackChain,
    reasoning,
  };
}

// Helper for backward compatibility
export function isLocalProvider(providerId: ProviderId): boolean {
  const provider = useProviderStore.getState().providers.find(p => p.id === providerId);
  return provider?.type === 'local';
}

// Backward compatibility type alias
export type AIProvider = ProviderId;
