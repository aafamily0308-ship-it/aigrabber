// Plugins Panel - UI for managing plugins and MCP servers
// Phase 4: MCP & Plugins

import { useState, useEffect } from 'react';
import { 
  Puzzle, 
  Server, 
  Plus, 
  Trash2, 
  Power, 
  PowerOff, 
  RefreshCw,
  Settings2,
  Wrench,
  ExternalLink,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { pluginRegistry, Plugin, getPluginCount, getAvailableTools } from '@/lib/pluginSystem';
import { mcpClient, MCPServer } from '@/lib/mcpClient';
import { usePluginStore } from '@/stores/pluginStore';
import { getAllAvailableTools, ToolDefinition } from '@/lib/toolExecutor';

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [mcpServers, setMCPServers] = useState<MCPServer[]>([]);
  const [allTools, setAllTools] = useState<ToolDefinition[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ id: '', name: '', url: '', protocol: 'ws' as 'ws' | 'http' });
  const [connecting, setConnecting] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    enabledPluginIds,
    enablePlugin,
    disablePlugin,
    addMCPServer,
    removeMCPServer,
    autoConnectServers,
    toggleAutoConnect,
    toolsEnabled,
    setToolsEnabled,
    autoExecuteTools,
    setAutoExecuteTools,
    showToolCalls,
    setShowToolCalls,
  } = usePluginStore();

  // Subscribe to updates
  useEffect(() => {
    const unsubPlugins = pluginRegistry.subscribe(setPlugins);
    const unsubMCP = mcpClient.subscribe(setMCPServers);
    
    setPlugins(pluginRegistry.getAllPlugins());
    setMCPServers(mcpClient.getServers());
    
    return () => {
      unsubPlugins();
      unsubMCP();
    };
  }, []);

  // Update tools when plugins/MCP changes
  useEffect(() => {
    setAllTools(getAllAvailableTools());
  }, [plugins, mcpServers, enabledPluginIds]);

  const handleAddServer = () => {
    if (!newServer.id || !newServer.name || !newServer.url) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    addMCPServer({
      id: newServer.id,
      name: newServer.name,
      url: newServer.url,
      protocol: newServer.protocol,
    });

    setNewServer({ id: '', name: '', url: '', protocol: 'ws' });
    setShowAddServer(false);
    toast({ title: 'Server Added', description: `${newServer.name} has been added` });
  };

  const handleConnect = async (serverId: string) => {
    setConnecting(serverId);
    try {
      const success = await mcpClient.connect(serverId);
      if (success) {
        toast({ title: 'Connected', description: 'Successfully connected to MCP server' });
      } else {
        toast({ title: 'Connection Failed', description: 'Could not connect to server', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = (serverId: string) => {
    mcpClient.disconnect(serverId);
    toast({ title: 'Disconnected', description: 'Disconnected from MCP server' });
  };

  const pluginCount = getPluginCount();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Puzzle className="w-6 h-6" />
            Plugins & Tools
          </h2>
          <p className="text-muted-foreground">
            Extend AI capabilities with plugins and MCP servers
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {pluginCount.enabled}/{pluginCount.total} plugins • {allTools.length} tools
        </Badge>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Tool Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Tools</Label>
              <p className="text-sm text-muted-foreground">Allow AI to use tools and plugins</p>
            </div>
            <Switch checked={toolsEnabled} onCheckedChange={setToolsEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Execute Tools</Label>
              <p className="text-sm text-muted-foreground">Automatically execute tool calls from AI</p>
            </div>
            <Switch checked={autoExecuteTools} onCheckedChange={setAutoExecuteTools} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Tool Calls</Label>
              <p className="text-sm text-muted-foreground">Display tool call details in chat</p>
            </div>
            <Switch checked={showToolCalls} onCheckedChange={setShowToolCalls} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="plugins">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plugins" className="gap-2">
            <Puzzle className="w-4 h-4" />
            Plugins ({plugins.length})
          </TabsTrigger>
          <TabsTrigger value="mcp" className="gap-2">
            <Server className="w-4 h-4" />
            MCP Servers ({mcpServers.length})
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="w-4 h-4" />
            All Tools ({allTools.length})
          </TabsTrigger>
        </TabsList>

        {/* Plugins Tab */}
        <TabsContent value="plugins">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 p-1">
              {plugins.map((plugin) => (
                <Card key={plugin.metadata.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{plugin.metadata.icon || '🔌'}</span>
                        <div>
                          <h3 className="font-semibold">{plugin.metadata.name}</h3>
                          <p className="text-sm text-muted-foreground">{plugin.metadata.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              v{plugin.metadata.version}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {plugin.metadata.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {plugin.tools?.length || 0} tools
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={enabledPluginIds.includes(plugin.metadata.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            enablePlugin(plugin.metadata.id);
                          } else {
                            disablePlugin(plugin.metadata.id);
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* MCP Servers Tab */}
        <TabsContent value="mcp">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAddServer} onOpenChange={setShowAddServer}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add MCP Server
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add MCP Server</DialogTitle>
                    <DialogDescription>
                      Connect to an external MCP server for additional tools
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Server ID</Label>
                      <Input
                        value={newServer.id}
                        onChange={(e) => setNewServer({ ...newServer, id: e.target.value })}
                        placeholder="my-mcp-server"
                      />
                    </div>
                    <div>
                      <Label>Server Name</Label>
                      <Input
                        value={newServer.name}
                        onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                        placeholder="My MCP Server"
                      />
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={newServer.url}
                        onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                        placeholder="ws://localhost:8080/mcp"
                      />
                    </div>
                    <div>
                      <Label>Protocol</Label>
                      <Select
                        value={newServer.protocol}
                        onValueChange={(v: 'http' | 'ws') => setNewServer({ ...newServer, protocol: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ws">WebSocket</SelectItem>
                          <SelectItem value="http">HTTP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddServer(false)}>Cancel</Button>
                    <Button onClick={handleAddServer}>Add Server</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[350px]">
              <div className="space-y-3 p-1">
                {mcpServers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No MCP servers configured</p>
                    <p className="text-sm">Add a server to extend AI capabilities</p>
                  </div>
                ) : (
                  mcpServers.map((server) => (
                    <Card key={server.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              server.status === 'connected' ? 'bg-success' :
                              server.status === 'error' ? 'bg-destructive' :
                              'bg-muted'
                            }`} />
                            <div>
                              <h3 className="font-semibold">{server.name}</h3>
                              <p className="text-sm text-muted-foreground">{server.url}</p>
                              {server.error && (
                                <p className="text-sm text-destructive">{server.error}</p>
                              )}
                              {server.capabilities?.tools && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {server.capabilities.tools.length} tools
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={autoConnectServers.includes(server.id)}
                              onCheckedChange={() => toggleAutoConnect(server.id)}
                              title="Auto-connect on startup"
                            />
                            {server.status === 'connected' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisconnect(server.id)}
                              >
                                <PowerOff className="w-4 h-4 mr-1" />
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnect(server.id)}
                                disabled={connecting === server.id}
                              >
                                {connecting === server.id ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Power className="w-4 h-4 mr-1" />
                                )}
                                Connect
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeMCPServer(server.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* All Tools Tab */}
        <TabsContent value="tools">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 p-1">
              {allTools.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tools available</p>
                  <p className="text-sm">Enable plugins or connect MCP servers</p>
                </div>
              ) : (
                allTools.map((tool, idx) => (
                  <Card key={`${tool.name}-${idx}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-semibold">{tool.name}</code>
                            <Badge variant={tool.source === 'plugin' ? 'secondary' : 'outline'} className="text-xs">
                              {tool.source === 'plugin' ? tool.pluginName : tool.serverName}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
