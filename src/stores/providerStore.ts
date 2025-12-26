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
  apiKey?: string;
  requiresApiKey?: boolean;
}

interface ProviderState {
  providers: Provider[];
  
  // Actions
  updateProviderStatus: (id: string, status: 'online' | 'offline' | 'checking', latency?: number) => void;
  toggleProvider: (id: string) => void;
  updateProviderEndpoint: (id: string, endpoint: string) => void;
  updateProviderModel: (id: string, model: string) => void;
  updateProviderApiKey: (id: string, apiKey: string) => void;
  addProvider: (provider: Provider) => void;
  removeProvider: (id: string) => void;
  reorderProviders: (providers: Provider[]) => void;
  getActiveProvider: () => Provider | undefined;
  getOnlineProviders: () => Provider[];
}

const defaultProviders: Provider[] = [
  // Local Providers
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    endpoint: 'http://localhost:11434',
    isActive: true,
    status: 'offline',
    model: 'llama3.2',
    priority: 1,
    requiresApiKey: false,
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
    requiresApiKey: false,
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp Server',
    type: 'local',
    endpoint: 'http://localhost:8080',
    isActive: false,
    status: 'offline',
    model: 'default',
    priority: 3,
    requiresApiKey: false,
  },
  {
    id: 'koboldcpp',
    name: 'KoboldCpp',
    type: 'local',
    endpoint: 'http://localhost:5001',
    isActive: false,
    status: 'offline',
    model: 'kobold',
    priority: 4,
    requiresApiKey: false,
  },
  {
    id: 'localai',
    name: 'LocalAI',
    type: 'local',
    endpoint: 'http://localhost:8080',
    isActive: false,
    status: 'offline',
    model: 'gpt-4',
    priority: 5,
    requiresApiKey: false,
  },
  {
    id: 'textgenweb',
    name: 'Text Generation WebUI',
    type: 'local',
    endpoint: 'http://localhost:5000',
    isActive: false,
    status: 'offline',
    model: 'default',
    priority: 6,
    requiresApiKey: false,
  },
  {
    id: 'vllm',
    name: 'vLLM',
    type: 'local',
    endpoint: 'http://localhost:8000',
    isActive: false,
    status: 'offline',
    model: 'default',
    priority: 7,
    requiresApiKey: false,
  },
  // Cloud Providers
  {
    id: 'google',
    name: 'Google AI (Gemini)',
    type: 'cloud',
    endpoint: 'https://generativelanguage.googleapis.com',
    isActive: true,
    status: 'offline',
    model: 'gemini-2.0-flash',
    priority: 8,
    requiresApiKey: true,
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    type: 'cloud',
    endpoint: 'https://api.openai.com',
    isActive: true,
    status: 'offline',
    model: 'gpt-4o',
    priority: 9,
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    type: 'cloud',
    endpoint: 'https://api.anthropic.com',
    isActive: true,
    status: 'offline',
    model: 'claude-sonnet-4-20250514',
    priority: 10,
    requiresApiKey: true,
  },
];

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
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

      updateProviderApiKey: (id, apiKey) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, apiKey } : p
          ),
        })),

      addProvider: (provider) =>
        set((state) => {
          if (state.providers.some(p => p.id === provider.id)) {
            return state;
          }
          return { providers: [...state.providers, provider] };
        }),

      removeProvider: (id) =>
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
        })),

      reorderProviders: (providers) => set({ providers }),

      getActiveProvider: () => {
        const state = get();
        return state.providers.find(p => p.isActive && p.status === 'online');
      },

      getOnlineProviders: () => {
        const state = get();
        return state.providers.filter(p => p.status === 'online');
      },
    }),
    {
      name: 'ai-command-providers',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          // Migration: add new providers if missing
          const state = persistedState as { providers: Provider[] };
          const existingIds = new Set(state.providers.map(p => p.id));
          const missingProviders = defaultProviders.filter(p => !existingIds.has(p.id));
          return {
            ...state,
            providers: [...state.providers, ...missingProviders],
          };
        }
        return persistedState;
      },
    }
  )
);
