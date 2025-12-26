// Vector Store - IndexedDB-based vector storage for semantic search
// Phase 3: Memory & RAG

import { initDB } from './indexedDBStore';
import { EmbeddingVector, cosineSimilarity, findTopK } from './embeddingService';

const VECTOR_STORE_NAME = 'vectors';

export interface StoredVector {
  id: string;
  vector: number[];
  text: string;
  type: 'document' | 'conversation' | 'memory';
  sourceId: string;  // Original document/conversation ID
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  type: StoredVector['type'];
  sourceId: string;
  metadata?: Record<string, any>;
}

// Extend IndexedDB with vectors store
async function getVectorDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai-command-center-vectors', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(VECTOR_STORE_NAME)) {
        const store = db.createObjectStore(VECTOR_STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// Store a vector
export async function storeVector(
  id: string,
  vector: number[],
  text: string,
  type: StoredVector['type'],
  sourceId: string,
  metadata?: Record<string, any>
): Promise<void> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    
    const storedVector: StoredVector = {
      id,
      vector,
      text,
      type,
      sourceId,
      metadata,
      createdAt: new Date(),
    };
    
    const request = store.put(storedVector);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Store multiple vectors in batch
export async function storeVectorsBatch(vectors: Omit<StoredVector, 'createdAt'>[]): Promise<void> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    
    for (const v of vectors) {
      store.put({
        ...v,
        createdAt: new Date(),
      });
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Get all vectors of a specific type
export async function getVectorsByType(type: StoredVector['type']): Promise<StoredVector[]> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    const index = store.index('type');
    const request = index.getAll(type);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get vectors by source ID
export async function getVectorsBySourceId(sourceId: string): Promise<StoredVector[]> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    const index = store.index('sourceId');
    const request = index.getAll(sourceId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete vectors by source ID
export async function deleteVectorsBySourceId(sourceId: string): Promise<void> {
  const db = await getVectorDB();
  const vectors = await getVectorsBySourceId(sourceId);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    
    for (const v of vectors) {
      store.delete(v.id);
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Search for similar vectors
export async function searchSimilar(
  queryVector: number[],
  options: {
    type?: StoredVector['type'];
    limit?: number;
    minScore?: number;
  } = {}
): Promise<SearchResult[]> {
  const { type, limit = 10, minScore = 0.1 } = options;
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    
    let request: IDBRequest;
    if (type) {
      const index = store.index('type');
      request = index.getAll(type);
    } else {
      request = store.getAll();
    }
    
    request.onsuccess = () => {
      const vectors: StoredVector[] = request.result;
      
      // Calculate similarity scores
      const candidates = vectors.map(v => ({
        id: v.id,
        vector: v.vector,
        text: v.text,
        type: v.type,
        sourceId: v.sourceId,
        metadata: v.metadata,
      }));
      
      const topK = findTopK(queryVector, candidates, limit);
      
      // Filter by minimum score and build results
      const results: SearchResult[] = topK
        .filter(r => r.score >= minScore)
        .map(r => {
          const original = vectors.find(v => v.id === r.id)!;
          return {
            id: r.id,
            text: original.text,
            score: r.score,
            type: original.type,
            sourceId: original.sourceId,
            metadata: original.metadata,
          };
        });
      
      resolve(results);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Get vector count
export async function getVectorCount(type?: StoredVector['type']): Promise<number> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    
    let request: IDBRequest;
    if (type) {
      const index = store.index('type');
      request = index.count(type);
    } else {
      request = store.count();
    }
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear all vectors (for reset)
export async function clearVectors(type?: StoredVector['type']): Promise<void> {
  const db = await getVectorDB();
  
  if (type) {
    const vectors = await getVectorsByType(type);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(VECTOR_STORE_NAME);
      
      for (const v of vectors) {
        store.delete(v.id);
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } else {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(VECTOR_STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Get storage stats
export async function getVectorStoreStats(): Promise<{
  totalVectors: number;
  byType: Record<StoredVector['type'], number>;
  estimatedSizeKB: number;
}> {
  const db = await getVectorDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VECTOR_STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const vectors: StoredVector[] = request.result;
      
      const byType: Record<StoredVector['type'], number> = {
        document: 0,
        conversation: 0,
        memory: 0,
      };
      
      let estimatedSize = 0;
      for (const v of vectors) {
        byType[v.type]++;
        // Rough size estimate: vector floats + text
        estimatedSize += v.vector.length * 8 + v.text.length * 2;
      }
      
      resolve({
        totalVectors: vectors.length,
        byType,
        estimatedSizeKB: Math.round(estimatedSize / 1024),
      });
    };
    
    request.onerror = () => reject(request.error);
  });
}
