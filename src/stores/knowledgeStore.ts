import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'md' | 'epub' | 'docx';
  size: number;
  content?: string;
  chunks?: string[];
  status: 'processing' | 'ready' | 'error';
  createdAt: Date;
}

interface KnowledgeState {
  documents: Document[];
  selectedDocuments: string[];
  searchQuery: string;
  
  // Actions
  addDocument: (doc: Omit<Document, 'id' | 'createdAt'>) => string;
  updateDocumentStatus: (id: string, status: Document['status'], content?: string) => void;
  updateDocumentChunks: (id: string, chunks: string[]) => void;
  removeDocument: (id: string) => void;
  toggleDocumentSelection: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      documents: [],
      selectedDocuments: [],
      searchQuery: '',

      addDocument: (doc) => {
        const id = crypto.randomUUID();
        const newDoc: Document = {
          ...doc,
          id,
          createdAt: new Date(),
        };
        set((state) => ({
          documents: [newDoc, ...state.documents],
        }));
        return id;
      },

      updateDocumentStatus: (id, status, content) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, status, content: content || d.content } : d
          ),
        })),

      updateDocumentChunks: (id, chunks) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, chunks } : d
          ),
        })),

      removeDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
          selectedDocuments: state.selectedDocuments.filter((docId) => docId !== id),
        })),

      toggleDocumentSelection: (id) =>
        set((state) => ({
          selectedDocuments: state.selectedDocuments.includes(id)
            ? state.selectedDocuments.filter((docId) => docId !== id)
            : [...state.selectedDocuments, id],
        })),

      clearSelection: () => set({ selectedDocuments: [] }),

      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'ai-command-knowledge',
      partialize: (state) => ({
        documents: state.documents,
      }),
    }
  )
);
