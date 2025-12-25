import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Provider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  isActive: boolean;
  status: 'online' | 'offline' | 'checking';
  latency?: number;
  model?: string;
  priority: number;
}

interface ProviderState {
  providers: Provider[];
  
  // Actions
  updateProviderStatus: (id: string, status: 'online' | 'offline' | 'checking', latency?: number) => void;
  toggleProvider: (id: string) => void;
  updateProviderEndpoint: (id: string, endpoint: string) => void;
  updateProviderModel: (id: string, model: string) => void;
  reorderProviders: (providers: Provider[]) => void;
}

const defaultProviders: Provider[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    endpoint: 'http://localhost:11434',
    isActive: true,
    status: 'offline',
    model: 'llama3.2',
    priority: 1,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    type: 'local',
    endpoint: 'http://localhost:1234',
    isActive: true,
    status: 'offline',
    model: 'local-model',
    priority: 2,
  },
  {
    id: 'gemini',
    name: 'Gemini 2.5 Flash',
    type: 'cloud',
    endpoint: 'lovable-ai-gateway',
    isActive: true,
    status: 'online',
    model: 'google/gemini-2.5-flash',
    priority: 3,
  },
  {
    id: 'gpt5',
    name: 'GPT-5',
    type: 'cloud',
    endpoint: 'lovable-ai-gateway',
    isActive: true,
    status: 'online',
    model: 'openai/gpt-5',
    priority: 4,
  },
];

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      providers: defaultProviders,

      updateProviderStatus: (id, status, latency) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, status, latency } : p
          ),
        })),

      toggleProvider: (id) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p
          ),
        })),

      updateProviderEndpoint: (id, endpoint) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, endpoint } : p
          ),
        })),

      updateProviderModel: (id, model) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, model } : p
          ),
        })),

      reorderProviders: (providers) => set({ providers }),
    }),
    {
      name: 'ai-command-providers',
    }
  )
);
