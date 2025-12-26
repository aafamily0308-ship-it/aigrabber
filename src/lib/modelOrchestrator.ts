// Model Orchestrator - Automatic model selection based on task type
// Phase 2: Intelligent Core

import { AIProvider, isLocalProvider } from './localAIClient';

export type TaskType = 
  | 'code'           // Programming, debugging
  | 'creative'       // Writing, brainstorming
  | 'analysis'       // Data analysis, reasoning
  | 'conversation'   // General chat
  | 'translation'    // Language translation
  | 'summarization'  // Text summarization
  | 'long-context'   // Large documents
  | 'quick';         // Fast, simple responses

export interface ModelCapabilities {
  provider: AIProvider;
  name: string;
  strengths: TaskType[];
  contextWindow: number;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'free' | 'low' | 'medium' | 'high';
  isLocal: boolean;
}

// Model registry with capabilities
export const modelRegistry: ModelCapabilities[] = [
  {
    provider: 'local-ollama',
    name: 'Ollama (Llama 3.2)',
    strengths: ['code', 'conversation', 'quick'],
    contextWindow: 8192,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  {
    provider: 'local-lmstudio',
    name: 'LM Studio',
    strengths: ['code', 'conversation', 'creative'],
    contextWindow: 8192,
    speed: 'fast',
    cost: 'free',
    isLocal: true,
  },
  {
    provider: 'cloud-google',
    name: 'Google Gemini',
    strengths: ['long-context', 'analysis', 'summarization', 'creative'],
    contextWindow: 1000000,
    speed: 'medium',
    cost: 'medium',
    isLocal: false,
  },
  {
    provider: 'cloud-openai',
    name: 'OpenAI GPT-4o',
    strengths: ['code', 'creative', 'analysis', 'conversation'],
    contextWindow: 128000,
    speed: 'medium',
    cost: 'high',
    isLocal: false,
  },
  {
    provider: 'cloud-anthropic',
    name: 'Anthropic Claude',
    strengths: ['code', 'analysis', 'creative', 'long-context'],
    contextWindow: 200000,
    speed: 'medium',
    cost: 'high',
    isLocal: false,
  },
];

export interface OrchestratorConfig {
  preferLocal: boolean;           // Prefer local models when suitable
  fallbackToCloud: boolean;       // Use cloud if local fails
  maxContextRatio: number;        // Max % of context window to use (e.g., 0.8)
  speedPriority: 'fast' | 'balanced' | 'quality';
}

export const defaultOrchestratorConfig: OrchestratorConfig = {
  preferLocal: true,
  fallbackToCloud: true,
  maxContextRatio: 0.8,
  speedPriority: 'balanced',
};

// Detect task type from message content
export function detectTaskType(message: string): TaskType {
  const lowerMessage = message.toLowerCase();
  
  // Code detection
  const codePatterns = [
    /```[\s\S]*```/,
    /\b(function|const|let|var|class|def|import|export)\b/,
    /\b(debug|error|exception|bug|fix|code|programming|javascript|python|typescript|react|api)\b/i,
  ];
  if (codePatterns.some(p => p.test(message))) {
    return 'code';
  }

  // Translation detection
  if (/\b(translate|перевод|переведи|translation|в|на)\b/i.test(lowerMessage) && 
      /\b(english|russian|spanish|french|german|chinese|русский|английский)\b/i.test(lowerMessage)) {
    return 'translation';
  }

  // Summarization detection
  if (/\b(summarize|summary|краткое|резюме|кратко|tl;dr|tldr)\b/i.test(lowerMessage)) {
    return 'summarization';
  }

  // Analysis detection
  if (/\b(analyze|analysis|анализ|compare|comparison|evaluate|assess|explain why|reasoning)\b/i.test(lowerMessage)) {
    return 'analysis';
  }

  // Creative detection
  if (/\b(write|create|story|poem|creative|imagine|brainstorm|idea|напиши|придумай)\b/i.test(lowerMessage)) {
    return 'creative';
  }

  // Long context detection (by message length)
  if (message.length > 10000) {
    return 'long-context';
  }

  // Quick response detection
  if (message.length < 100 && !message.includes('?')) {
    return 'quick';
  }

  return 'conversation';
}

// Estimate token count (rough approximation)
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English, ~2 for Russian
  const hasRussian = /[а-яА-ЯёЁ]/.test(text);
  const charsPerToken = hasRussian ? 2 : 4;
  return Math.ceil(text.length / charsPerToken);
}

// Select best model for the task
export function selectModel(
  taskType: TaskType,
  messageLength: number,
  availableProviders: AIProvider[],
  config: OrchestratorConfig = defaultOrchestratorConfig
): AIProvider {
  const estimatedTokens = estimateTokenCount(new Array(messageLength).fill('a').join(''));
  
  // Filter models that are available
  const availableModels = modelRegistry.filter(m => 
    availableProviders.includes(m.provider)
  );

  if (availableModels.length === 0) {
    return 'local-ollama'; // Default fallback
  }

  // Score each model
  const scoredModels = availableModels.map(model => {
    let score = 0;

    // Strength match (+30 points)
    if (model.strengths.includes(taskType)) {
      score += 30;
    }

    // Context window suitability (+20 points if fits)
    const maxUsableContext = model.contextWindow * config.maxContextRatio;
    if (estimatedTokens <= maxUsableContext) {
      score += 20;
    } else {
      score -= 50; // Penalty for context overflow
    }

    // Local preference (+15 points if preferLocal)
    if (config.preferLocal && model.isLocal) {
      score += 15;
    }

    // Speed priority
    if (config.speedPriority === 'fast') {
      if (model.speed === 'fast') score += 20;
      if (model.speed === 'slow') score -= 10;
    } else if (config.speedPriority === 'quality') {
      if (model.speed === 'slow') score += 10; // Quality models are often slower
      if (model.cost === 'high') score += 5;   // Higher cost often means better
    }

    // Cost consideration
    if (model.cost === 'free') score += 10;
    if (model.cost === 'high') score -= 5;

    return { model, score };
  });

  // Sort by score (descending)
  scoredModels.sort((a, b) => b.score - a.score);

  return scoredModels[0].model.provider;
}

// Get fallback chain for a provider
export function getFallbackChain(
  primaryProvider: AIProvider,
  availableProviders: AIProvider[]
): AIProvider[] {
  const chain: AIProvider[] = [primaryProvider];
  
  // Add other available providers as fallbacks
  const isLocalPrimary = isLocalProvider(primaryProvider);
  
  // If primary is local, add other local first, then cloud
  if (isLocalPrimary) {
    const otherLocal = availableProviders.filter(p => 
      isLocalProvider(p) && p !== primaryProvider
    );
    const cloudProviders = availableProviders.filter(p => !isLocalProvider(p));
    chain.push(...otherLocal, ...cloudProviders);
  } else {
    // If primary is cloud, add other cloud first, then local
    const otherCloud = availableProviders.filter(p => 
      !isLocalProvider(p) && p !== primaryProvider
    );
    const localProviders = availableProviders.filter(p => isLocalProvider(p));
    chain.push(...otherCloud, ...localProviders);
  }

  return chain.filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates
}

// Export orchestrator function
export function orchestrate(
  message: string,
  conversationHistory: string[],
  availableProviders: AIProvider[],
  config?: Partial<OrchestratorConfig>
): {
  selectedProvider: AIProvider;
  taskType: TaskType;
  fallbackChain: AIProvider[];
  reasoning: string;
} {
  const fullConfig = { ...defaultOrchestratorConfig, ...config };
  
  // Combine message with recent history for context
  const fullContext = [...conversationHistory.slice(-5), message].join('\n');
  
  const taskType = detectTaskType(message);
  const selectedProvider = selectModel(
    taskType,
    fullContext.length,
    availableProviders,
    fullConfig
  );
  const fallbackChain = getFallbackChain(selectedProvider, availableProviders);

  const modelInfo = modelRegistry.find(m => m.provider === selectedProvider);
  const reasoning = `Task: ${taskType} → Model: ${modelInfo?.name || selectedProvider} (${modelInfo?.strengths.join(', ')})`;

  return {
    selectedProvider,
    taskType,
    fallbackChain,
    reasoning,
  };
}
