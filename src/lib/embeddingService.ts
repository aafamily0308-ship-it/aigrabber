// Embedding Service - Generate text embeddings for semantic search
// Phase 3: Memory & RAG
// Uses TF-IDF for offline operation, with optional cloud embeddings

export interface EmbeddingVector {
  vector: number[];
  dimensions: number;
  method: 'tfidf' | 'cloud';
}

export interface TextChunk {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

// Vocabulary for TF-IDF
const globalVocabulary: Map<string, number> = new Map();
const documentFrequency: Map<string, number> = new Map();
let totalDocuments = 0;

// Tokenize text
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

// Calculate term frequency
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by document length
  const docLength = tokens.length;
  for (const [term, count] of tf) {
    tf.set(term, count / docLength);
  }
  return tf;
}

// Update global vocabulary with new document
export function updateVocabulary(text: string): void {
  const tokens = new Set(tokenize(text));
  totalDocuments++;
  
  for (const token of tokens) {
    if (!globalVocabulary.has(token)) {
      globalVocabulary.set(token, globalVocabulary.size);
    }
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
}

// Calculate TF-IDF vector
function calculateTFIDF(text: string): number[] {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  
  // Create vector of fixed size (top N terms or all vocab)
  const vocabSize = Math.min(globalVocabulary.size, 512);
  const vector = new Array(vocabSize).fill(0);
  
  // Get sorted vocabulary (most frequent first)
  const sortedVocab = Array.from(globalVocabulary.entries())
    .sort((a, b) => (documentFrequency.get(b[0]) || 0) - (documentFrequency.get(a[0]) || 0))
    .slice(0, vocabSize);
  
  for (let i = 0; i < sortedVocab.length; i++) {
    const [term] = sortedVocab[i];
    const tfValue = tf.get(term) || 0;
    const df = documentFrequency.get(term) || 1;
    const idf = Math.log((totalDocuments + 1) / (df + 1)) + 1;
    vector[i] = tfValue * idf;
  }
  
  // L2 normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }
  
  return vector;
}

// Simple word embedding using character n-grams (no external dependencies)
function calculateCharNGramEmbedding(text: string, dimensions: number = 256): number[] {
  const vector = new Array(dimensions).fill(0);
  const cleanText = text.toLowerCase().replace(/[^\w\sа-яё]/gi, '');
  
  // Character 3-grams
  for (let i = 0; i < cleanText.length - 2; i++) {
    const ngram = cleanText.slice(i, i + 3);
    const hash = hashString(ngram);
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }
  
  // Word unigrams
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    const hash = hashString(word);
    const index = Math.abs(hash) % dimensions;
    vector[index] += 2; // Weight words more than character n-grams
  }
  
  // L2 normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }
  
  return vector;
}

// Simple string hash function
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash;
}

// Generate embedding for text (offline method)
export function generateEmbedding(text: string): EmbeddingVector {
  // Update vocabulary with this text
  updateVocabulary(text);
  
  // Use hybrid approach: TF-IDF + char n-grams
  const tfidfVector = calculateTFIDF(text);
  const charVector = calculateCharNGramEmbedding(text, 256);
  
  // Concatenate vectors
  const vector = [...tfidfVector.slice(0, 256), ...charVector];
  
  return {
    vector,
    dimensions: vector.length,
    method: 'tfidf',
  };
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    // Pad shorter vector with zeros
    const maxLen = Math.max(a.length, b.length);
    while (a.length < maxLen) a.push(0);
    while (b.length < maxLen) b.push(0);
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// Find top-k most similar vectors
export function findTopK(
  queryVector: number[],
  candidates: { id: string; vector: number[] }[],
  k: number = 5
): { id: string; score: number }[] {
  const scores = candidates.map(candidate => ({
    id: candidate.id,
    score: cosineSimilarity(queryVector, candidate.vector),
  }));
  
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Chunk text into smaller pieces for embedding
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

// Process document into chunks with embeddings
export function processDocument(
  docId: string,
  text: string,
  metadata?: Record<string, any>
): { chunks: TextChunk[]; embeddings: EmbeddingVector[] } {
  const textChunks = chunkText(text);
  const chunks: TextChunk[] = [];
  const embeddings: EmbeddingVector[] = [];
  
  for (let i = 0; i < textChunks.length; i++) {
    const chunkId = `${docId}_chunk_${i}`;
    chunks.push({
      id: chunkId,
      text: textChunks[i],
      metadata: { ...metadata, chunkIndex: i, docId },
    });
    embeddings.push(generateEmbedding(textChunks[i]));
  }
  
  return { chunks, embeddings };
}

// Export vocabulary state for persistence
export function exportVocabularyState(): {
  vocabulary: [string, number][];
  documentFrequency: [string, number][];
  totalDocuments: number;
} {
  return {
    vocabulary: Array.from(globalVocabulary.entries()),
    documentFrequency: Array.from(documentFrequency.entries()),
    totalDocuments,
  };
}

// Import vocabulary state from persistence
export function importVocabularyState(state: {
  vocabulary: [string, number][];
  documentFrequency: [string, number][];
  totalDocuments: number;
}): void {
  globalVocabulary.clear();
  documentFrequency.clear();
  
  for (const [term, index] of state.vocabulary) {
    globalVocabulary.set(term, index);
  }
  for (const [term, freq] of state.documentFrequency) {
    documentFrequency.set(term, freq);
  }
  totalDocuments = state.totalDocuments;
}

// Clear vocabulary (for testing or reset)
export function clearVocabulary(): void {
  globalVocabulary.clear();
  documentFrequency.clear();
  totalDocuments = 0;
}
