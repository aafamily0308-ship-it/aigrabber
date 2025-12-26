// MCP Client - Model Context Protocol implementation for external tool integration
// Phase 4: MCP & Plugins

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'ws' | 'stdio';
  status: 'connected' | 'disconnected' | 'error';
  lastPing?: Date;
  capabilities?: MCPCapabilities;
  error?: string;
}

export interface MCPCapabilities {
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// MCP Client class for managing server connections
class MCPClientManager {
  private servers: Map<string, MCPServer> = new Map();
  private connections: Map<string, WebSocket | null> = new Map();
  private messageHandlers: Map<string, (msg: MCPMessage) => void> = new Map();
  private pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
  private requestId = 0;
  private listeners: Set<(servers: MCPServer[]) => void> = new Set();

  // Register an MCP server
  registerServer(server: Omit<MCPServer, 'status'>): void {
    const fullServer: MCPServer = {
      ...server,
      status: 'disconnected',
    };
    this.servers.set(server.id, fullServer);
    this.notifyListeners();
  }

  // Remove an MCP server
  removeServer(serverId: string): void {
    this.disconnect(serverId);
    this.servers.delete(serverId);
    this.notifyListeners();
  }

  // Connect to an MCP server
  async connect(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.error(`Server ${serverId} not found`);
      return false;
    }

    try {
      if (server.protocol === 'ws') {
        return await this.connectWebSocket(server);
      } else if (server.protocol === 'http') {
        return await this.connectHTTP(server);
      } else {
        // stdio not supported in browser
        this.updateServerStatus(serverId, 'error', 'stdio protocol not supported in browser');
        return false;
      }
    } catch (error: any) {
      this.updateServerStatus(serverId, 'error', error.message);
      return false;
    }
  }

  private async connectWebSocket(server: MCPServer): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(server.url);
        
        ws.onopen = async () => {
          this.connections.set(server.id, ws);
          this.updateServerStatus(server.id, 'connected');
          
          // Initialize and get capabilities
          try {
            await this.initialize(server.id);
            await this.getCapabilities(server.id);
          } catch (e) {
            console.warn('Failed to get capabilities:', e);
          }
          
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg: MCPMessage = JSON.parse(event.data);
            this.handleMessage(server.id, msg);
          } catch (e) {
            console.error('Failed to parse MCP message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.updateServerStatus(server.id, 'error', 'Connection error');
          resolve(false);
        };

        ws.onclose = () => {
          this.connections.set(server.id, null);
          this.updateServerStatus(server.id, 'disconnected');
        };
      } catch (error: any) {
        this.updateServerStatus(server.id, 'error', error.message);
        resolve(false);
      }
    });
  }

  private async connectHTTP(server: MCPServer): Promise<boolean> {
    try {
      // Test connection with initialize
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.requestId,
          method: 'initialize',
          params: {
            protocolVersion: '1.0',
            capabilities: {},
            clientInfo: { name: 'AI Command Center', version: '1.0.0' },
          },
        }),
      });

      if (response.ok) {
        this.updateServerStatus(server.id, 'connected');
        await this.getCapabilities(server.id);
        return true;
      } else {
        this.updateServerStatus(server.id, 'error', `HTTP ${response.status}`);
        return false;
      }
    } catch (error: any) {
      this.updateServerStatus(server.id, 'error', error.message);
      return false;
    }
  }

  // Disconnect from a server
  disconnect(serverId: string): void {
    const ws = this.connections.get(serverId);
    if (ws) {
      ws.close();
    }
    this.connections.delete(serverId);
    this.updateServerStatus(serverId, 'disconnected');
  }

  // Initialize connection
  private async initialize(serverId: string): Promise<unknown> {
    return this.sendRequest(serverId, 'initialize', {
      protocolVersion: '1.0',
      capabilities: {},
      clientInfo: { name: 'AI Command Center', version: '1.0.0' },
    });
  }

  // Get server capabilities
  private async getCapabilities(serverId: string): Promise<void> {
    try {
      // Get tools
      const toolsResult = await this.sendRequest(serverId, 'tools/list', {});
      const tools = (toolsResult as any)?.tools || [];

      // Get resources
      const resourcesResult = await this.sendRequest(serverId, 'resources/list', {});
      const resources = (resourcesResult as any)?.resources || [];

      // Get prompts
      const promptsResult = await this.sendRequest(serverId, 'prompts/list', {});
      const prompts = (promptsResult as any)?.prompts || [];

      const server = this.servers.get(serverId);
      if (server) {
        server.capabilities = { tools, resources, prompts };
        this.notifyListeners();
      }
    } catch (error) {
      console.warn('Failed to get capabilities:', error);
    }
  }

  // Send request to server
  async sendRequest(serverId: string, method: string, params: unknown): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const id = String(++this.requestId);
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    if (server.protocol === 'ws') {
      const ws = this.connections.get(serverId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      return new Promise((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
        ws.send(JSON.stringify(message));

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    } else {
      // HTTP request
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result: MCPMessage = await response.json();
      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.result;
    }
  }

  // Handle incoming messages
  private handleMessage(serverId: string, msg: MCPMessage): void {
    if (msg.id && this.pendingRequests.has(String(msg.id))) {
      const { resolve, reject } = this.pendingRequests.get(String(msg.id))!;
      this.pendingRequests.delete(String(msg.id));

      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(msg.result);
      }
    }

    // Notify custom handlers
    const handler = this.messageHandlers.get(serverId);
    if (handler) {
      handler(msg);
    }
  }

  // Call a tool on a server
  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest(serverId, 'tools/call', { name: toolName, arguments: args });
  }

  // Get a resource from a server
  async getResource(serverId: string, uri: string): Promise<unknown> {
    return this.sendRequest(serverId, 'resources/read', { uri });
  }

  // Get a prompt from a server
  async getPrompt(serverId: string, name: string, args?: Record<string, string>): Promise<unknown> {
    return this.sendRequest(serverId, 'prompts/get', { name, arguments: args });
  }

  // Update server status
  private updateServerStatus(serverId: string, status: MCPServer['status'], error?: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.status = status;
      server.error = error;
      server.lastPing = status === 'connected' ? new Date() : server.lastPing;
      this.notifyListeners();
    }
  }

  // Get all servers
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  // Get connected servers
  getConnectedServers(): MCPServer[] {
    return this.getServers().filter(s => s.status === 'connected');
  }

  // Get all tools from connected servers
  getAllTools(): { serverId: string; serverName: string; tool: MCPTool }[] {
    return this.getConnectedServers().flatMap(server => 
      (server.capabilities?.tools || []).map(tool => ({
        serverId: server.id,
        serverName: server.name,
        tool,
      }))
    );
  }

  // Subscribe to server changes
  subscribe(listener: (servers: MCPServer[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const servers = this.getServers();
    this.listeners.forEach(l => l(servers));
  }
}

// Singleton instance
export const mcpClient = new MCPClientManager();

// Convenience functions
export function getMCPServers(): MCPServer[] {
  return mcpClient.getServers();
}

export function getMCPTools(): { serverId: string; serverName: string; tool: MCPTool }[] {
  return mcpClient.getAllTools();
}

export async function callMCPTool(
  serverId: string, 
  toolName: string, 
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await mcpClient.callTool(serverId, toolName, args);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Pre-configured example servers (for testing)
export const exampleMCPServers: Omit<MCPServer, 'status'>[] = [
  {
    id: 'local-mcp',
    name: 'Local MCP Server',
    url: 'ws://localhost:8080/mcp',
    protocol: 'ws',
  },
  {
    id: 'file-server',
    name: 'File System Server',
    url: 'http://localhost:3001/mcp',
    protocol: 'http',
  },
];
