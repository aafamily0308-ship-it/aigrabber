import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MessageRole = 'user' | 'assistant' | 'system';
export type ProviderType = 'ollama' | 'lmstudio' | 'llamacpp' | 'koboldcpp' | 'localai' | 'textgenweb' | 'vllm' | 'google' | 'openai' | 'anthropic' | 'custom';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  provider?: ProviderType;
  timestamp: Date;
  tokensUsed?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  provider: ProviderType;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  selectedProvider: ProviderType;
  
  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (conversationId: string, content: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setSelectedProvider: (provider: ProviderType) => void;
  deleteConversation: (id: string) => void;
  clearConversations: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      selectedProvider: 'ollama',

      createConversation: () => {
        const id = crypto.randomUUID();
        const newConversation: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          provider: get().selectedProvider,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      addMessage: (conversationId, message) => {
        const newMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  title: conv.messages.length === 0 && message.role === 'user' 
                    ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                    : conv.title,
                  updatedAt: new Date(),
                }
              : conv
          ),
        }));
      },

      updateLastMessage: (conversationId, content) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg, i) =>
                    i === conv.messages.length - 1
                      ? { ...msg, content }
                      : msg
                  ),
                  updatedAt: new Date(),
                }
              : conv
          ),
        }));
      },

      setIsStreaming: (isStreaming) => set({ isStreaming }),

      setSelectedProvider: (provider) => set({ selectedProvider: provider }),

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        }));
      },

      clearConversations: () => set({ conversations: [], activeConversationId: null }),
    }),
    {
      name: 'ai-command-chat',
      partialize: (state) => ({
        conversations: state.conversations,
        selectedProvider: state.selectedProvider,
      }),
    }
  )
);
