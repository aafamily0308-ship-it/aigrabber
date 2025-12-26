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
    status: 'offline', // Default offline until checked
    model: 'llama3.2',
    priority: 1,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    type: 'local',
    endpoint: 'http://localhost:1234',
    isActive: true,
    status: 'offline', // Default offline until checked
    model: 'local-model',
    priority: 2,
  },
  {
    id: 'gemini',
    name: 'Gemini Pro',
    type: 'cloud',
    endpoint: 'https://generativelanguage.googleapis.com',
    isActive: true,
    status: 'offline', // Offline until API key is provided
    model: 'gemini-pro',
    priority: 3,
  },
  {
    id: 'openai',
    name: 'GPT-4o',
    type: 'cloud',
    endpoint: 'https://api.openai.com',
    isActive: true,
    status: 'offline', // Offline until API key is provided
    model: 'gpt-4o',
    priority: 4,
  },
  {
    id: 'anthropic',
    name: 'Claude 3',
    type: 'cloud',
    endpoint: 'https://api.anthropic.com',
    isActive: true,
    status: 'offline', // Offline until API key is provided
    model: 'claude-3-sonnet-20240229',
    priority: 5,
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
