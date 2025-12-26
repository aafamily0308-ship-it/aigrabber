// RAG Pipeline - Retrieval Augmented Generation
// Phase 3: Memory & RAG

import { generateEmbedding, processDocument, chunkText } from './embeddingService';
import { 
  storeVector, 
  storeVectorsBatch, 
  searchSimilar, 
  deleteVectorsBySourceId,
  getVectorsBySourceId,
  SearchResult,
  getVectorStoreStats,
} from './vectorStore';
import { searchMemory, getPersonalizedContext } from './conversationMemory';

export interface RAGDocument {
  id: string;
  name: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface RAGContext {
  documents: {
    id: string;
    name: string;
    chunk: string;
    score: number;
  }[];
  memories: {
    text: string;
    score: number;
    role?: string;
  }[];
  personalizedContext: string;
  totalSources: number;
}

export interface RAGConfig {
  maxDocumentChunks: number;
  maxMemories: number;
  minScore: number;
  includeMemory: boolean;
  includePersonalization: boolean;
}

export const defaultRAGConfig: RAGConfig = {
  maxDocumentChunks: 5,
  maxMemories: 3,
  minScore: 0.15,
  includeMemory: true,
  includePersonalization: true,
};

// Index a document for RAG
export async function indexDocument(document: RAGDocument): Promise<{
  chunksCreated: number;
  success: boolean;
}> {
  try {
    // Delete existing vectors for this document
    await deleteVectorsBySourceId(document.id);
    
    // Process document into chunks with embeddings
    const { chunks, embeddings } = processDocument(
      document.id,
      document.content,
      { name: document.name, ...document.metadata }
    );
    
    // Store all vectors
    const vectorsToStore = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: embeddings[i].vector,
      text: chunk.text,
      type: 'document' as const,
      sourceId: document.id,
      metadata: chunk.metadata,
    }));
    
    await storeVectorsBatch(vectorsToStore);
    
    return {
      chunksCreated: chunks.length,
      success: true,
    };
  } catch (error) {
    console.error('Error indexing document:', error);
    return {
      chunksCreated: 0,
      success: false,
    };
  }
}

// Index multiple documents
export async function indexDocuments(documents: RAGDocument[]): Promise<{
  totalChunks: number;
  successCount: number;
  failedIds: string[];
}> {
  let totalChunks = 0;
  let successCount = 0;
  const failedIds: string[] = [];
  
  for (const doc of documents) {
    const result = await indexDocument(doc);
    if (result.success) {
      totalChunks += result.chunksCreated;
      successCount++;
    } else {
      failedIds.push(doc.id);
    }
  }
  
  return { totalChunks, successCount, failedIds };
}

// Remove document from index
export async function removeFromIndex(documentId: string): Promise<void> {
  await deleteVectorsBySourceId(documentId);
}

// Search documents for relevant chunks
export async function searchDocuments(
  query: string,
  options: {
    limit?: number;
    minScore?: number;
    documentIds?: string[];
  } = {}
): Promise<SearchResult[]> {
  const { limit = 5, minScore = 0.15, documentIds } = options;
  
  const queryEmbedding = generateEmbedding(query);
  let results = await searchSimilar(queryEmbedding.vector, {
    type: 'document',
    limit: limit * 2,
    minScore,
  });
  
  // Filter by specific document IDs if provided
  if (documentIds && documentIds.length > 0) {
    results = results.filter(r => documentIds.includes(r.sourceId));
  }
  
  return results.slice(0, limit);
}

// Build RAG context for a query
export async function buildRAGContext(
  query: string,
  conversationId: string,
  config: Partial<RAGConfig> = {}
): Promise<RAGContext> {
  const cfg = { ...defaultRAGConfig, ...config };
  
  // Search documents
  const docResults = await searchDocuments(query, {
    limit: cfg.maxDocumentChunks,
    minScore: cfg.minScore,
  });
  
  const documents = docResults.map(r => ({
    id: r.sourceId,
    name: r.metadata?.name || 'Unknown',
    chunk: r.text,
    score: r.score,
  }));
  
  // Search memory if enabled
  let memories: RAGContext['memories'] = [];
  if (cfg.includeMemory) {
    const memoryResults = await searchMemory(query, {
      limit: cfg.maxMemories,
      minScore: cfg.minScore,
      excludeConversationId: conversationId,
    });
    
    memories = memoryResults.map(r => ({
      text: r.text,
      score: r.score,
      role: r.metadata?.role,
    }));
  }
  
  // Get personalized context if enabled
  let personalizedContext = '';
  if (cfg.includePersonalization) {
    personalizedContext = await getPersonalizedContext(query, conversationId);
  }
  
  return {
    documents,
    memories,
    personalizedContext,
    totalSources: documents.length + memories.length,
  };
}

// Format RAG context for prompt injection
export function formatRAGContext(context: RAGContext): string {
  if (context.totalSources === 0 && !context.personalizedContext) {
    return '';
  }
  
  let formatted = '\n\n---\n**CONTEXT (use this information to answer):**\n';
  
  // Add document chunks
  if (context.documents.length > 0) {
    formatted += '\n📚 **From Knowledge Base:**\n';
    for (const doc of context.documents) {
      formatted += `\n**${doc.name}** (relevance: ${Math.round(doc.score * 100)}%)\n`;
      formatted += `${doc.chunk}\n`;
    }
  }
  
  // Add memories
  if (context.memories.length > 0) {
    formatted += '\n💭 **From Previous Conversations:**\n';
    for (const mem of context.memories) {
      const role = mem.role === 'user' ? 'User asked' : 'Assistant said';
      formatted += `- ${role}: ${mem.text.slice(0, 150)}${mem.text.length > 150 ? '...' : ''}\n`;
    }
  }
  
  // Add personalized context
  if (context.personalizedContext) {
    formatted += context.personalizedContext;
  }
  
  formatted += '\n---\n';
  
  return formatted;
}

// Full RAG pipeline: query -> context -> augmented prompt
export async function ragAugment(
  query: string,
  conversationId: string,
  config: Partial<RAGConfig> = {}
): Promise<{
  augmentedQuery: string;
  context: RAGContext;
  hasContext: boolean;
}> {
  const context = await buildRAGContext(query, conversationId, config);
  const formattedContext = formatRAGContext(context);
  
  return {
    augmentedQuery: query + formattedContext,
    context,
    hasContext: context.totalSources > 0 || !!context.personalizedContext,
  };
}

// Check if a document is indexed
export async function isDocumentIndexed(documentId: string): Promise<boolean> {
  const vectors = await getVectorsBySourceId(documentId);
  return vectors.length > 0;
}

// Get RAG stats
export async function getRAGStats(): Promise<{
  indexedDocuments: number;
  totalChunks: number;
  memoryEntries: number;
  estimatedSizeKB: number;
}> {
  const stats = await getVectorStoreStats();
  
  // Count unique documents
  const documentIds = new Set<string>();
  // This is a simplification - in production we'd track this separately
  
  return {
    indexedDocuments: stats.byType.document > 0 ? Math.ceil(stats.byType.document / 5) : 0, // Rough estimate
    totalChunks: stats.byType.document,
    memoryEntries: stats.byType.memory,
    estimatedSizeKB: stats.estimatedSizeKB,
  };
}

// Rebuild entire index from documents
export async function rebuildIndex(
  documents: RAGDocument[],
  onProgress?: (current: number, total: number) => void
): Promise<{
  success: boolean;
  totalChunks: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalChunks = 0;
  
  for (let i = 0; i < documents.length; i++) {
    try {
      const result = await indexDocument(documents[i]);
      if (result.success) {
        totalChunks += result.chunksCreated;
      } else {
        errors.push(`Failed to index: ${documents[i].name}`);
      }
    } catch (error) {
      errors.push(`Error indexing ${documents[i].name}: ${error}`);
    }
    
    onProgress?.(i + 1, documents.length);
  }
  
  return {
    success: errors.length === 0,
    totalChunks,
    errors,
  };
}
