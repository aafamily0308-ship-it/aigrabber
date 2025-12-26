// Context Manager - Smart context window management
// Phase 2: Intelligent Core

import { estimateTokenCount } from './modelOrchestrator';

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  tokens?: number;
}

export interface ContextWindow {
  messages: ContextMessage[];
  systemPrompt?: string;
  attachedDocuments: string[];
  totalTokens: number;
  maxTokens: number;
}

export interface ContextConfig {
  maxTokens: number;
  reserveForResponse: number;  // Tokens to reserve for AI response
  priorityWeights: {
    recency: number;    // Weight for recent messages
    relevance: number;  // Weight for keyword matches
    role: number;       // Weight for user vs assistant
  };
  slidingWindowSize: number;  // Number of recent messages to always keep
}

export const defaultContextConfig: ContextConfig = {
  maxTokens: 4096,
  reserveForResponse: 1024,
  priorityWeights: {
    recency: 0.4,
    relevance: 0.4,
    role: 0.2,
  },
  slidingWindowSize: 6,
};

// Calculate token count for a message
export function calculateMessageTokens(message: ContextMessage): number {
  if (message.tokens) return message.tokens;
  return estimateTokenCount(message.content);
}

// Extract keywords from a query for relevance scoring
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'и', 'в', 'не', 'на', 'с', 'что', 'как', 'это', 'по', 'но', 'из',
    'у', 'за', 'о', 'от', 'к', 'же', 'для', 'до', 'или', 'если', 'то',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\\w\\sа-яё]/gi, '')
    .split(/\\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

// Calculate relevance score between message and query
function calculateRelevance(message: string, queryKeywords: string[]): number {
  if (queryKeywords.length === 0) return 0;

  const messageWords = new Set(extractKeywords(message));
  let matches = 0;

  for (const keyword of queryKeywords) {
    if (messageWords.has(keyword)) {
      matches++;
    }
  }

  return matches / queryKeywords.length;
}

// Score a message for inclusion in context
function scoreMessage(
  message: ContextMessage,
  index: number,
  totalMessages: number,
  queryKeywords: string[],
  config: ContextConfig
): number {
  const { priorityWeights } = config;

  // Recency score (0-1, higher for more recent)
  const recencyScore = (index + 1) / totalMessages;

  // Relevance score (0-1)
  const relevanceScore = calculateRelevance(message.content, queryKeywords);

  // Role score (user messages slightly more important for context)
  const roleScore = message.role === 'user' ? 1 : 0.8;

  // Priority boost
  const priorityBoost = 
    message.priority === 'high' ? 0.3 :
    message.priority === 'medium' ? 0.1 : 0;

  const baseScore = 
    recencyScore * priorityWeights.recency +
    relevanceScore * priorityWeights.relevance +
    roleScore * priorityWeights.role;

  return baseScore + priorityBoost;
}

// Build optimized context window
export function buildContextWindow(
  messages: ContextMessage[],
  currentQuery: string,
  systemPrompt?: string,
  attachedDocuments?: string[],
  config: ContextConfig = defaultContextConfig
): ContextWindow {
  const availableTokens = config.maxTokens - config.reserveForResponse;
  const queryKeywords = extractKeywords(currentQuery);

  // Always include system prompt
  let usedTokens = systemPrompt ? estimateTokenCount(systemPrompt) : 0;

  // Add attached documents
  const docTokens = (attachedDocuments || []).reduce((sum, doc) => 
    sum + estimateTokenCount(doc), 0
  );
  usedTokens += docTokens;

  // Score all messages
  const scoredMessages = messages.map((msg, index) => ({
    message: msg,
    score: scoreMessage(msg, index, messages.length, queryKeywords, config),
    tokens: calculateMessageTokens(msg),
  }));

  // Always keep the most recent messages (sliding window)
  const recentMessages = scoredMessages.slice(-config.slidingWindowSize);
  const olderMessages = scoredMessages.slice(0, -config.slidingWindowSize);

  // Add recent messages first
  const selectedMessages: ContextMessage[] = [];
  for (const item of recentMessages) {
    if (usedTokens + item.tokens <= availableTokens) {
      selectedMessages.push(item.message);
      usedTokens += item.tokens;
    }
  }

  // Sort older messages by score and add what fits
  olderMessages.sort((a, b) => b.score - a.score);
  for (const item of olderMessages) {
    if (usedTokens + item.tokens <= availableTokens) {
      selectedMessages.unshift(item.message); // Add to beginning
      usedTokens += item.tokens;
    }
  }

  // Sort by timestamp to maintain conversation order
  selectedMessages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    messages: selectedMessages,
    systemPrompt,
    attachedDocuments: attachedDocuments || [],
    totalTokens: usedTokens,
    maxTokens: config.maxTokens,
  };
}

// Summarize old messages to compress context
export function summarizeMessages(messages: ContextMessage[]): string {
  if (messages.length === 0) return '';

  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  const topics = userMessages
    .map(m => extractKeywords(m.content).slice(0, 3))
    .flat();

  const uniqueTopics = [...new Set(topics)].slice(0, 10);

  return `[Previous conversation summary: ${messages.length} messages discussing: ${uniqueTopics.join(', ')}]`;
}

// Check if context needs compression
export function needsCompression(
  messages: ContextMessage[],
  config: ContextConfig = defaultContextConfig
): boolean {
  const totalTokens = messages.reduce((sum, m) => 
    sum + calculateMessageTokens(m), 0
  );
  return totalTokens > config.maxTokens * 0.9;
}

// Get context usage statistics
export function getContextStats(window: ContextWindow): {
  used: number;
  available: number;
  percentage: number;
  messageCount: number;
} {
  return {
    used: window.totalTokens,
    available: window.maxTokens - window.totalTokens,
    percentage: (window.totalTokens / window.maxTokens) * 100,
    messageCount: window.messages.length,
  };
}
