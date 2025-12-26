/**
 * Headless API for programmatic access to AI Command Center
 * Accessible via window.AiCommand
 */

import { useChatStore } from '@/stores/chatStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/lib/providers';

export interface HeadlessAPI {
  // Chat functions
  chat: (message: string) => Promise<string>;
  stream: (message: string, onToken: (token: string) => void) => Promise<string>;
  
  // Provider management
  setProvider: (providerId: string) => boolean;
  setModel: (model: string) => void;
  getProvider: () => { id: string; model: string };
  getProviders: () => Array<{ id: string; name: string; status: string; isActive: boolean }>;
  
  // History management
  getHistory: () => Array<{ role: string; content: string; timestamp: Date }>;
  clearHistory: () => void;
  
  // Utility
  ping: (providerId?: string) => Promise<{ success: boolean; latency: number }>;
  version: () => string;
}

// Internal state for headless mode
let currentProviderId = 'ollama';
let currentModel = 'llama3.2';

/**
 * Initialize the Headless API and attach it to window.AiCommand
 */
export function initHeadlessAPI(): void {
  const api: HeadlessAPI = {
    /**
     * Send a message and get a complete response
     */
    chat: async (message: string): Promise<string> => {
      const providerState = useProviderStore.getState().providers.find(
        p => p.id === currentProviderId
      );
      
      if (!providerState || providerState.status !== 'online') {
        throw new Error(`Provider ${currentProviderId} is not online`);
      }
      
      const provider = providerRegistry.get(currentProviderId);
      if (!provider) {
        throw new Error(`Provider ${currentProviderId} not found`);
      }
      
      // Get conversation history
      const chatState = useChatStore.getState();
      const activeConv = chatState.conversations.find(
        c => c.id === chatState.activeConversationId
      );
      
      const messages = [
        ...(activeConv?.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })) || []),
        { role: 'user' as const, content: message },
      ];
      
      let response = '';
      
      await provider.stream({
        endpoint: providerState.endpoint || provider.defaultEndpoint,
        model: currentModel,
        messages,
        onToken: (token) => {
          response += token;
        },
        onComplete: () => {},
        onError: (error) => {
          throw error;
        },
      });
      
      // Add messages to store
      let convId = chatState.activeConversationId;
      if (!convId) {
        convId = useChatStore.getState().createConversation();
      }
      
      useChatStore.getState().addMessage(convId, { role: 'user', content: message });
      useChatStore.getState().addMessage(convId, { role: 'assistant', content: response });
      
      return response;
    },
    
    /**
     * Stream a message with token-by-token callback
     */
    stream: async (message: string, onToken: (token: string) => void): Promise<string> => {
      const providerState = useProviderStore.getState().providers.find(
        p => p.id === currentProviderId
      );
      
      if (!providerState || providerState.status !== 'online') {
        throw new Error(`Provider ${currentProviderId} is not online`);
      }
      
      const provider = providerRegistry.get(currentProviderId);
      if (!provider) {
        throw new Error(`Provider ${currentProviderId} not found`);
      }
      
      const chatState = useChatStore.getState();
      const activeConv = chatState.conversations.find(
        c => c.id === chatState.activeConversationId
      );
      
      const messages = [
        ...(activeConv?.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })) || []),
        { role: 'user' as const, content: message },
      ];
      
      let response = '';
      
      await provider.stream({
        endpoint: providerState.endpoint || provider.defaultEndpoint,
        model: currentModel,
        messages,
        onToken: (token) => {
          response += token;
          onToken(token);
        },
        onComplete: () => {},
        onError: (error) => {
          throw error;
        },
      });
      
      return response;
    },
    
    /**
     * Set the active provider
     */
    setProvider: (providerId: string): boolean => {
      const provider = useProviderStore.getState().providers.find(p => p.id === providerId);
      if (!provider) {
        console.warn(`Provider ${providerId} not found`);
        return false;
      }
      currentProviderId = providerId;
      currentModel = provider.model || 'default';
      return true;
    },
    
    /**
     * Set the model for the current provider
     */
    setModel: (model: string): void => {
      currentModel = model;
    },
    
    /**
     * Get current provider and model
     */
    getProvider: () => ({
      id: currentProviderId,
      model: currentModel,
    }),
    
    /**
     * Get all available providers with their status
     */
    getProviders: () => {
      return useProviderStore.getState().providers.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        isActive: p.isActive,
      }));
    },
    
    /**
     * Get conversation history
     */
    getHistory: () => {
      const state = useChatStore.getState();
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })) || [];
    },
    
    /**
     * Clear all conversation history
     */
    clearHistory: (): void => {
      useChatStore.getState().clearConversations();
    },
    
    /**
     * Ping a provider to test connectivity
     */
    ping: async (providerId?: string): Promise<{ success: boolean; latency: number }> => {
      const id = providerId || currentProviderId;
      const provider = providerRegistry.get(id);
      const providerState = useProviderStore.getState().providers.find(p => p.id === id);
      
      if (!provider || !providerState) {
        return { success: false, latency: -1 };
      }
      
      const start = performance.now();
      try {
        const result = await provider.test(providerState.endpoint || provider.defaultEndpoint);
        const latency = Math.round(performance.now() - start);
        return { success: result.online, latency };
      } catch {
        return { success: false, latency: -1 };
      }
    },
    
    /**
     * Get API version
     */
    version: () => '1.0.0',
  };
  
  // Attach to window
  (window as unknown as { AiCommand: HeadlessAPI }).AiCommand = api;
  
  // Log initialization
  console.log('%c🤖 AI Command Headless API initialized', 'color: #10b981; font-weight: bold');
  console.log('%cUsage: window.AiCommand.chat("Hello")', 'color: #6b7280');
  console.log('%cRun window.AiCommand for all methods', 'color: #6b7280');
}

// TypeScript declaration for global access
declare global {
  interface Window {
    AiCommand: HeadlessAPI;
  }
}
