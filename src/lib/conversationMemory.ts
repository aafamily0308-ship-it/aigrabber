// Conversation Memory - Long-term memory with semantic search
// Phase 3: Memory & RAG

import { generateEmbedding } from './embeddingService';
import { storeVector, searchSimilar, deleteVectorsBySourceId, getVectorsBySourceId, SearchResult } from './vectorStore';

export interface MemoryEntry {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  summary?: string;
  topics: string[];
  importance: 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface ConversationSummary {
  id: string;
  conversationId: string;
  title: string;
  summary: string;
  keyTopics: string[];
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Extract topics from text
function extractTopics(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those', 'and', 'or', 'but', 'if', 'then',
    'что', 'как', 'это', 'и', 'в', 'не', 'на', 'с', 'я', 'ты', 'он', 'она', 'мы', 'они',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Count word frequency
  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  // Get top 5 most frequent words as topics
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// Determine importance of a message
function assessImportance(content: string, role: 'user' | 'assistant'): MemoryEntry['importance'] {
  const importantPatterns = [
    /password|api.?key|secret|token|credential/i,
    /important|critical|urgent|must|never|always/i,
    /remember|don't forget|keep in mind/i,
    /my name is|i am|i'm called/i,
    /prefer|like|want|need/i,
  ];

  const hasImportantPattern = importantPatterns.some(pattern => pattern.test(content));
  
  if (hasImportantPattern) return 'high';
  if (content.length > 200) return 'medium';
  return 'low';
}

// Generate a summary of text
function generateSummary(text: string, maxLength: number = 100): string {
  // Simple extractive summary: first sentence or first N characters
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length <= maxLength) {
    return firstSentence[0];
  }
  
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

// Store a message in memory
export async function storeMemory(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant'
): Promise<MemoryEntry> {
  const id = `memory_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const topics = extractTopics(content);
  const importance = assessImportance(content, role);
  
  const entry: MemoryEntry = {
    id,
    conversationId,
    content,
    role,
    summary: generateSummary(content),
    topics,
    importance,
    timestamp: new Date(),
  };

  // Generate embedding and store
  const embedding = generateEmbedding(content);
  await storeVector(
    id,
    embedding.vector,
    content,
    'memory',
    conversationId,
    {
      role,
      topics,
      importance,
      summary: entry.summary,
    }
  );

  return entry;
}

// Store conversation in memory (batch)
export async function storeConversationMemory(
  conversationId: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<void> {
  for (const msg of messages) {
    if (msg.content.trim()) {
      await storeMemory(conversationId, msg.content, msg.role);
    }
  }
}

// Search memory for relevant context
export async function searchMemory(
  query: string,
  options: {
    limit?: number;
    minScore?: number;
    excludeConversationId?: string;
  } = {}
): Promise<SearchResult[]> {
  const { limit = 5, minScore = 0.2, excludeConversationId } = options;
  
  const queryEmbedding = generateEmbedding(query);
  const results = await searchSimilar(queryEmbedding.vector, {
    type: 'memory',
    limit: limit * 2, // Get more to allow filtering
    minScore,
  });

  // Filter out excluded conversation
  let filtered = results;
  if (excludeConversationId) {
    filtered = results.filter(r => r.sourceId !== excludeConversationId);
  }

  return filtered.slice(0, limit);
}

// Get memory for a specific conversation
export async function getConversationMemory(conversationId: string): Promise<SearchResult[]> {
  const vectors = await getVectorsBySourceId(conversationId);
  
  return vectors
    .filter(v => v.type === 'memory')
    .map(v => ({
      id: v.id,
      text: v.text,
      score: 1, // Max score for direct retrieval
      type: v.type,
      sourceId: v.sourceId,
      metadata: v.metadata,
    }))
    .sort((a, b) => {
      const aTime = a.metadata?.timestamp || 0;
      const bTime = b.metadata?.timestamp || 0;
      return bTime - aTime;
    });
}

// Delete memory for a conversation
export async function deleteConversationMemory(conversationId: string): Promise<void> {
  await deleteVectorsBySourceId(conversationId);
}

// Generate conversation summary
export function generateConversationSummary(
  conversationId: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  title?: string
): ConversationSummary {
  // Combine all message content for topic extraction
  const allContent = messages.map(m => m.content).join(' ');
  const keyTopics = extractTopics(allContent);
  
  // Generate summary from user messages
  const userMessages = messages.filter(m => m.role === 'user');
  const summaryText = userMessages.length > 0
    ? generateSummary(userMessages.map(m => m.content).join('. '), 200)
    : 'Empty conversation';

  return {
    id: `summary_${conversationId}`,
    conversationId,
    title: title || keyTopics.slice(0, 3).join(', ') || 'Conversation',
    summary: summaryText,
    keyTopics,
    messageCount: messages.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Find related conversations based on current context
export async function findRelatedConversations(
  query: string,
  currentConversationId: string,
  limit: number = 3
): Promise<{
  conversationId: string;
  relevantMemories: SearchResult[];
  score: number;
}[]> {
  const results = await searchMemory(query, {
    limit: 20,
    minScore: 0.15,
    excludeConversationId: currentConversationId,
  });

  // Group by conversation
  const byConversation = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = byConversation.get(r.sourceId) || [];
    existing.push(r);
    byConversation.set(r.sourceId, existing);
  }

  // Calculate aggregate score per conversation
  const conversationScores = Array.from(byConversation.entries())
    .map(([conversationId, memories]) => ({
      conversationId,
      relevantMemories: memories,
      score: memories.reduce((sum, m) => sum + m.score, 0) / memories.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return conversationScores;
}

// Get personalized context based on memory
export async function getPersonalizedContext(
  query: string,
  currentConversationId: string
): Promise<string> {
  const memories = await searchMemory(query, {
    limit: 3,
    minScore: 0.25,
    excludeConversationId: currentConversationId,
  });

  if (memories.length === 0) return '';

  let context = '\n\n---\n**Relevant from previous conversations:**\n';
  for (const m of memories) {
    const role = m.metadata?.role === 'user' ? 'User' : 'Assistant';
    context += `- ${role}: ${m.metadata?.summary || m.text.slice(0, 100)}\n`;
  }

  return context;
}
