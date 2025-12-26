import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  category: 'general' | 'coding' | 'writing' | 'analysis' | 'custom';
  isDefault?: boolean;
  createdAt: Date;
}

interface PromptsState {
  prompts: SystemPrompt[];
  activePromptId: string | null;
  
  // Actions
  addPrompt: (prompt: Omit<SystemPrompt, 'id' | 'createdAt'>) => string;
  updatePrompt: (id: string, updates: Partial<SystemPrompt>) => void;
  deletePrompt: (id: string) => void;
  setActivePrompt: (id: string | null) => void;
  getActivePrompt: () => SystemPrompt | null;
}

const defaultPrompts: SystemPrompt[] = [
  {
    id: 'default',
    name: 'Default Assistant',
    content: 'You are a helpful AI assistant. Be concise, accurate, and friendly.',
    category: 'general',
    isDefault: true,
    createdAt: new Date(),
  },
  {
    id: 'coder',
    name: 'Coding Expert',
    content: `You are an expert software developer. When writing code:
- Use best practices and clean code principles
- Add comments for complex logic
- Consider edge cases and error handling
- Suggest improvements when relevant
Always explain your code clearly.`,
    category: 'coding',
    isDefault: true,
    createdAt: new Date(),
  },
  {
    id: 'writer',
    name: 'Creative Writer',
    content: `You are a skilled writer and editor. Help with:
- Grammar and style improvements
- Content structure and flow
- Tone adjustments for different audiences
- Creative ideas and storytelling
Maintain the author's voice while enhancing quality.`,
    category: 'writing',
    isDefault: true,
    createdAt: new Date(),
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    content: `You are a data analysis expert. Focus on:
- Clear explanations of data patterns
- Statistical insights and interpretations
- Visualization recommendations
- Actionable conclusions
Present findings in a structured, easy-to-understand format.`,
    category: 'analysis',
    isDefault: true,
    createdAt: new Date(),
  },
  {
    id: 'researcher',
    name: 'Research Assistant',
    content: `You are a thorough research assistant. When answering:
- Provide balanced, well-researched information
- Cite sources and acknowledge limitations
- Distinguish facts from opinions
- Offer multiple perspectives on complex topics
Be comprehensive but concise.`,
    category: 'general',
    isDefault: true,
    createdAt: new Date(),
  },
];

export const usePromptsStore = create<PromptsState>()(
  persist(
    (set, get) => ({
      prompts: defaultPrompts,
      activePromptId: 'default',

      addPrompt: (prompt) => {
        const id = crypto.randomUUID();
        set((state) => ({
          prompts: [...state.prompts, { ...prompt, id, createdAt: new Date() }],
        }));
        return id;
      },

      updatePrompt: (id, updates) =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deletePrompt: (id) =>
        set((state) => ({
          prompts: state.prompts.filter((p) => p.id !== id || p.isDefault),
          activePromptId: state.activePromptId === id ? 'default' : state.activePromptId,
        })),

      setActivePrompt: (id) => set({ activePromptId: id }),

      getActivePrompt: () => {
        const state = get();
        return state.prompts.find((p) => p.id === state.activePromptId) || null;
      },
    }),
    {
      name: 'ai-command-prompts',
      partialize: (state) => ({
        prompts: state.prompts,
        activePromptId: state.activePromptId,
      }),
    }
  )
);
