// Plugin Store - Zustand store for plugin management
// Phase 4: MCP & Plugins

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Plugin, 
  pluginRegistry, 
  PluginMetadata 
} from '@/lib/pluginSystem';
import { 
  MCPServer, 
  mcpClient, 
  exampleMCPServers 
} from '@/lib/mcpClient';

interface PluginState {
  // Plugin management
  enabledPluginIds: string[];
  customPlugins: PluginMetadata[];
  
  // MCP management
  mcpServers: Omit<MCPServer, 'status' | 'capabilities'>[];
  autoConnectServers: string[];
  
  // Settings
  toolsEnabled: boolean;
  autoExecuteTools: boolean;
  showToolCalls: boolean;
  
  // Actions
  enablePlugin: (pluginId: string) => void;
  disablePlugin: (pluginId: string) => void;
  addMCPServer: (server: Omit<MCPServer, 'status' | 'capabilities'>) => void;
  removeMCPServer: (serverId: string) => void;
  toggleAutoConnect: (serverId: string) => void;
  setToolsEnabled: (enabled: boolean) => void;
  setAutoExecuteTools: (enabled: boolean) => void;
  setShowToolCalls: (show: boolean) => void;
  connectAllAutoConnectServers: () => Promise<void>;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      // Initial state
      enabledPluginIds: ['datetime', 'calculator', 'text-utils', 'web-search'],
      customPlugins: [],
      mcpServers: [],
      autoConnectServers: [],
      toolsEnabled: true,
      autoExecuteTools: false,
      showToolCalls: true,

      // Plugin actions
      enablePlugin: (pluginId) => {
        pluginRegistry.enable(pluginId);
        set((state) => ({
          enabledPluginIds: [...new Set([...state.enabledPluginIds, pluginId])],
        }));
      },

      disablePlugin: (pluginId) => {
        pluginRegistry.disable(pluginId);
        set((state) => ({
          enabledPluginIds: state.enabledPluginIds.filter(id => id !== pluginId),
        }));
      },

      // MCP actions
      addMCPServer: (server) => {
        mcpClient.registerServer(server);
        set((state) => ({
          mcpServers: [...state.mcpServers, server],
        }));
      },

      removeMCPServer: (serverId) => {
        mcpClient.removeServer(serverId);
        set((state) => ({
          mcpServers: state.mcpServers.filter(s => s.id !== serverId),
          autoConnectServers: state.autoConnectServers.filter(id => id !== serverId),
        }));
      },

      toggleAutoConnect: (serverId) => {
        set((state) => ({
          autoConnectServers: state.autoConnectServers.includes(serverId)
            ? state.autoConnectServers.filter(id => id !== serverId)
            : [...state.autoConnectServers, serverId],
        }));
      },

      // Settings actions
      setToolsEnabled: (enabled) => set({ toolsEnabled: enabled }),
      setAutoExecuteTools: (enabled) => set({ autoExecuteTools: enabled }),
      setShowToolCalls: (show) => set({ showToolCalls: show }),

      // Auto-connect on startup
      connectAllAutoConnectServers: async () => {
        const { autoConnectServers, mcpServers } = get();
        
        for (const serverId of autoConnectServers) {
          const server = mcpServers.find(s => s.id === serverId);
          if (server) {
            try {
              await mcpClient.connect(serverId);
            } catch (error) {
              console.error(`Failed to connect to ${serverId}:`, error);
            }
          }
        }
      },
    }),
    {
      name: 'ai-command-plugins',
      partialize: (state) => ({
        enabledPluginIds: state.enabledPluginIds,
        customPlugins: state.customPlugins,
        mcpServers: state.mcpServers,
        autoConnectServers: state.autoConnectServers,
        toolsEnabled: state.toolsEnabled,
        autoExecuteTools: state.autoExecuteTools,
        showToolCalls: state.showToolCalls,
      }),
    }
  )
);

// Initialize plugins from store on module load
const initializePlugins = () => {
  const state = usePluginStore.getState();
  
  // Enable stored plugins
  state.enabledPluginIds.forEach(id => {
    pluginRegistry.enable(id);
  });
  
  // Register stored MCP servers
  state.mcpServers.forEach(server => {
    mcpClient.registerServer(server);
  });
};

// Run initialization
initializePlugins();
