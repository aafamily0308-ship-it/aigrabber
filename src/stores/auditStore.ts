import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: 'chat_request' | 'document_upload' | 'export' | 'settings_change' | 'provider_change';
  provider?: string;
  providerType?: 'local' | 'cloud';
  tokensUsed?: number;
  dataSize?: number; // in bytes
  sensitiveDataDetected?: boolean;
  details?: string;
}

interface AuditState {
  entries: AuditEntry[];
  maxEntries: number;
  paranoidMode: boolean;
  showDataPreview: boolean;
  
  // Actions
  addEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  clearEntries: () => void;
  setParanoidMode: (enabled: boolean) => void;
  setShowDataPreview: (show: boolean) => void;
  
  // Stats
  getStats: () => {
    totalRequests: number;
    localRequests: number;
    cloudRequests: number;
    totalTokens: number;
    totalDataSent: number;
  };
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: 1000,
      paranoidMode: false,
      showDataPreview: false,

      addEntry: (entry) =>
        set((state) => {
          const newEntry: AuditEntry = {
            ...entry,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          };
          
          const entries = [newEntry, ...state.entries].slice(0, state.maxEntries);
          return { entries };
        }),

      clearEntries: () => set({ entries: [] }),

      setParanoidMode: (enabled) => set({ paranoidMode: enabled }),

      setShowDataPreview: (show) => set({ showDataPreview: show }),

      getStats: () => {
        const entries = get().entries;
        const chatRequests = entries.filter(e => e.action === 'chat_request');
        
        return {
          totalRequests: chatRequests.length,
          localRequests: chatRequests.filter(e => e.providerType === 'local').length,
          cloudRequests: chatRequests.filter(e => e.providerType === 'cloud').length,
          totalTokens: chatRequests.reduce((acc, e) => acc + (e.tokensUsed || 0), 0),
          totalDataSent: chatRequests.filter(e => e.providerType === 'cloud').reduce((acc, e) => acc + (e.dataSize || 0), 0),
        };
      },
    }),
    {
      name: 'ai-command-audit',
      partialize: (state) => ({
        entries: state.entries,
        paranoidMode: state.paranoidMode,
        showDataPreview: state.showDataPreview,
      }),
    }
  )
);
