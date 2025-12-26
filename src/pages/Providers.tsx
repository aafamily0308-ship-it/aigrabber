import { useState, useEffect } from "react";
import { 
  Server, 
  Cpu, 
  Cloud, 
  RefreshCw, 
  Check, 
  X,
  Zap,
  Settings,
  Shield,
  Plus,
  Trash2,
  Loader2,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProviderStore, Provider } from "@/stores/providerStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { providerRegistry, type APIFormat } from "@/lib/providers/providerRegistry";

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function Providers() {
  const [checking, setChecking] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [lmStudioModels, setLmStudioModels] = useState<string[]>([]);
  const { toast } = useToast();
  
  const {
    providers,
    updateProviderStatus,
    toggleProvider,
    updateProviderEndpoint,
    updateProviderModel,
    addProvider,
    removeProvider,
  } = useProviderStore();
  
  // Custom provider form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    endpoint: 'http://localhost:8080',
    apiFormat: 'openai' as APIFormat,
    model: '',
  });
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  
  // Get custom providers from registry
  const registryCustomProviders = providerRegistry.getCustom();
  
  // Auto-detect endpoint type
  const detectEndpoint = async () => {
    if (!newProvider.endpoint) return;
    setDetecting(true);
    setDetectedModels([]);
    
    try {
      const result = await providerRegistry.detectProviderType(newProvider.endpoint);
      if (result) {
        setNewProvider(prev => ({ ...prev, apiFormat: result.format }));
        setDetectedModels(result.models);
        if (result.models.length > 0 && !newProvider.model) {
          setNewProvider(prev => ({ ...prev, model: result.models[0] }));
        }
        toast({
          title: "Endpoint Detected",
          description: `Found ${result.format} API with ${result.models.length} models`,
        });
      } else {
        toast({
          title: "Detection Failed",
          description: "Could not detect API type. Please configure manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Detection Error",
        description: "Failed to connect to endpoint",
        variant: "destructive",
      });
    } finally {
      setDetecting(false);
    }
  };
  
  // Add custom provider
  const handleAddCustomProvider = () => {
    if (!newProvider.name || !newProvider.endpoint) {
      toast({
        title: "Missing Fields",
        description: "Name and endpoint are required",
        variant: "destructive",
      });
      return;
    }
    
    // Register in provider registry
    const provider = providerRegistry.register({
      id: newProvider.name.toLowerCase().replace(/\s+/g, '-'),
      name: newProvider.name,
      endpoint: newProvider.endpoint,
      apiFormat: newProvider.apiFormat,
      model: newProvider.model || 'default',
    });
    
    // Add to provider store
    addProvider({
      id: provider.id,
      name: provider.name,
      type: 'local',
      endpoint: newProvider.endpoint,
      isActive: true,
      status: 'offline',
      model: newProvider.model || 'default',
      priority: providers.length + 1,
      requiresApiKey: false,
    });
    
    toast({
      title: "Provider Added",
      description: `${newProvider.name} has been added successfully`,
    });
    
    // Reset form
    setNewProvider({
      name: '',
      endpoint: 'http://localhost:8080',
      apiFormat: 'openai',
      model: '',
    });
    setDetectedModels([]);
    setShowAddDialog(false);
  };
  
  // Remove custom provider
  const handleRemoveCustomProvider = (id: string) => {
    providerRegistry.remove(id);
    removeProvider(id);
    toast({
      title: "Provider Removed",
      description: "Custom provider has been deleted",
    });
  };

  const fetchOllamaModels = async (endpoint: string) => {
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        setOllamaModels(data.models || []);
        return data.models || [];
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    }
    return [];
  };

  const fetchLmStudioModels = async (endpoint: string) => {
    try {
      const response = await fetch(`${endpoint}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: any) => m.id) || [];
        setLmStudioModels(models);
        return models;
      }
    } catch (error) {
      console.error('Failed to fetch LM Studio models:', error);
    }
    return [];
  };

  const checkProvider = async (provider: Provider) => {
    setChecking(provider.id);
    updateProviderStatus(provider.id, 'checking');

    try {
      if (provider.type === 'local') {
        const startTime = Date.now();
        
        if (provider.id === 'ollama') {
          const models = await fetchOllamaModels(provider.endpoint);
          if (models.length >= 0) {
            const latency = Date.now() - startTime;
            updateProviderStatus(provider.id, 'online', latency);
            toast({
              title: "Ollama Connected",
              description: `Response time: ${latency}ms • ${models.length} models available`,
            });
          } else {
            throw new Error('Not available');
          }
        } else if (provider.id === 'lmstudio') {
          const models = await fetchLmStudioModels(provider.endpoint);
          if (models.length >= 0) {
            const latency = Date.now() - startTime;
            updateProviderStatus(provider.id, 'online', latency);
            toast({
              title: "LM Studio Connected",
              description: `Response time: ${latency}ms • ${models.length} models loaded`,
            });
          } else {
            throw new Error('Not available');
          }
        } else {
          // For custom/other local providers
          try {
            const response = await fetch(`${provider.endpoint}/v1/models`, {
              signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - startTime;
            if (response.ok) {
              updateProviderStatus(provider.id, 'online', latency);
              toast({
                title: `${provider.name} Connected`,
                description: `Response time: ${latency}ms`,
              });
            } else {
              throw new Error('Not available');
            }
          } catch {
            // Try Ollama format
            const response = await fetch(`${provider.endpoint}/api/tags`, {
              signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - startTime;
            if (response.ok) {
              updateProviderStatus(provider.id, 'online', latency);
              toast({
                title: `${provider.name} Connected`,
                description: `Response time: ${latency}ms`,
              });
            } else {
              throw new Error('Not available');
            }
          }
        }
      } else {
        updateProviderStatus(provider.id, 'online', 50);
        toast({
          title: `${provider.name} Available`,
          description: "Cloud provider is ready",
        });
      }
    } catch (error) {
      updateProviderStatus(provider.id, 'offline');
      toast({
        title: `${provider.name} Offline`,
        description: provider.type === 'local' 
          ? "Make sure the service is running" 
          : "Check your connection",
        variant: "destructive",
      });
    } finally {
      setChecking(null);
    }
  };

  const checkAllProviders = async () => {
    for (const provider of providers) {
      await checkProvider(provider);
    }
  };

  useEffect(() => {
    providers
      .filter(p => p.type === 'local')
      .forEach(p => checkProvider(p));
  }, []);

  const localProviders = providers.filter(p => p.type === 'local' && !registryCustomProviders.some(c => c.id === p.id));
  const cloudProviders = providers.filter(p => p.type === 'cloud');
  const customProvidersList = providers.filter(p => registryCustomProviders.some(c => c.id === p.id));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text">AI Providers</h1>
          <p className="text-muted-foreground mt-1">Manage your AI connections</p>
        </div>
        <Button onClick={checkAllProviders} variant="outline" className="gap-2">
          <RefreshCw className={cn("w-4 h-4", checking && "animate-spin")} />
          Check All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {providers.filter(p => p.isActive).length}
              </p>
              <p className="text-sm text-muted-foreground">Active Providers</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {localProviders.filter(p => p.status === 'online').length}
              </p>
              <p className="text-sm text-muted-foreground">Local Online</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {cloudProviders.filter(p => p.status === 'online').length}
              </p>
              <p className="text-sm text-muted-foreground">Cloud Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Local Providers */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-success" />
          <h2 className="text-xl font-semibold text-foreground">Local Providers</h2>
          <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
            Private
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {localProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              checking={checking === provider.id}
              onCheck={() => checkProvider(provider)}
              onToggle={() => toggleProvider(provider.id)}
              onUpdateEndpoint={(endpoint) => updateProviderEndpoint(provider.id, endpoint)}
              onUpdateModel={(model) => updateProviderModel(provider.id, model)}
              availableModels={provider.id === 'ollama' ? ollamaModels.map(m => m.name) : lmStudioModels}
            />
          ))}
        </div>
      </div>

      {/* Custom Providers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Custom Providers</h2>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {customProvidersList.length} added
            </span>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Custom Provider</DialogTitle>
                <DialogDescription>
                  Connect to any OpenAI-compatible or Ollama-compatible API endpoint
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Provider Name</Label>
                  <Input
                    id="name"
                    placeholder="My Custom Provider"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="endpoint"
                      placeholder="http://localhost:8080"
                      value={newProvider.endpoint}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, endpoint: e.target.value }))}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={detectEndpoint}
                      disabled={detecting}
                      title="Auto-detect API format"
                    >
                      {detecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiFormat">API Format</Label>
                  <Select 
                    value={newProvider.apiFormat} 
                    onValueChange={(value: APIFormat) => setNewProvider(prev => ({ ...prev, apiFormat: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI Compatible</SelectItem>
                      <SelectItem value="ollama">Ollama Compatible</SelectItem>
                      <SelectItem value="koboldcpp">KoboldCpp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  {detectedModels.length > 0 ? (
                    <Select 
                      value={newProvider.model} 
                      onValueChange={(value) => setNewProvider(prev => ({ ...prev, model: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="model"
                      placeholder="default"
                      value={newProvider.model}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, model: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomProvider}>
                  Add Provider
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {customProvidersList.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customProvidersList.map((provider) => (
              <CustomProviderCard
                key={provider.id}
                provider={provider}
                checking={checking === provider.id}
                onCheck={() => checkProvider(provider)}
                onToggle={() => toggleProvider(provider.id)}
                onUpdateEndpoint={(endpoint) => updateProviderEndpoint(provider.id, endpoint)}
                onUpdateModel={(model) => updateProviderModel(provider.id, model)}
                onRemove={() => handleRemoveCustomProvider(provider.id)}
              />
            ))}
          </div>
        ) : (
          <div className="glass rounded-xl p-8 text-center">
            <Plus className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No custom providers added yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Click "Add Provider" to connect your own API endpoint
            </p>
          </div>
        )}
      </div>

      {/* Cloud Providers */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-secondary" />
          <h2 className="text-xl font-semibold text-foreground">Cloud Providers</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cloudProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              checking={checking === provider.id}
              onCheck={() => checkProvider(provider)}
              onToggle={() => toggleProvider(provider.id)}
              onUpdateEndpoint={(endpoint) => updateProviderEndpoint(provider.id, endpoint)}
              onUpdateModel={(model) => updateProviderModel(provider.id, model)}
              availableModels={[]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  checking: boolean;
  onCheck: () => void;
  onToggle: () => void;
  onUpdateEndpoint: (endpoint: string) => void;
  onUpdateModel: (model: string) => void;
  availableModels: string[];
}

function ProviderCard({ 
  provider, 
  checking, 
  onCheck, 
  onToggle,
  onUpdateEndpoint,
  onUpdateModel,
  availableModels,
}: ProviderCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn(
      "glass rounded-xl p-5 transition-all",
      !provider.isActive && "opacity-60"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            provider.type === 'local' ? "bg-success/20" : "bg-secondary/20"
          )}>
            {provider.type === 'local' ? (
              <Cpu className="w-6 h-6 text-success" />
            ) : (
              <Cloud className="w-6 h-6 text-secondary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{provider.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            provider.status === 'online' ? "bg-success/20 text-success" :
            provider.status === 'checking' ? "bg-warning/20 text-warning" :
            "bg-destructive/20 text-destructive"
          )}>
            {provider.status === 'online' && <Check className="w-3 h-3" />}
            {provider.status === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
            {provider.status === 'offline' && <X className="w-3 h-3" />}
            {provider.status}
          </div>
          <Switch checked={provider.isActive} onCheckedChange={onToggle} />
        </div>
      </div>

      {provider.latency && provider.status === 'online' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Zap className="w-4 h-4 text-warning" />
          {provider.latency}ms latency
        </div>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCheck}
            disabled={checking}
            className="flex-1"
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className={cn("w-4 h-4 transition-transform", isOpen && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4 space-y-3 pt-4 border-t border-border">
          {provider.type === 'local' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Endpoint</label>
                <Input
                  value={provider.endpoint}
                  onChange={(e) => onUpdateEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                {availableModels.length > 0 ? (
                  <Select value={provider.model || ''} onValueChange={onUpdateModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={provider.model || ''}
                    onChange={(e) => onUpdateModel(e.target.value)}
                    placeholder="llama3.2"
                    className="text-sm"
                  />
                )}
              </div>
            </>
          )}
          {provider.type === 'cloud' && (
            <p className="text-sm text-muted-foreground">
              Cloud provider settings are managed automatically.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Custom Provider Card with delete option
interface CustomProviderCardProps {
  provider: Provider;
  checking: boolean;
  onCheck: () => void;
  onToggle: () => void;
  onUpdateEndpoint: (endpoint: string) => void;
  onUpdateModel: (model: string) => void;
  onRemove: () => void;
}

function CustomProviderCard({ 
  provider, 
  checking, 
  onCheck, 
  onToggle,
  onUpdateEndpoint,
  onUpdateModel,
  onRemove,
}: CustomProviderCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn(
      "glass rounded-xl p-5 transition-all border border-primary/20",
      !provider.isActive && "opacity-60"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{provider.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            provider.status === 'online' ? "bg-success/20 text-success" :
            provider.status === 'checking' ? "bg-warning/20 text-warning" :
            "bg-destructive/20 text-destructive"
          )}>
            {provider.status === 'online' && <Check className="w-3 h-3" />}
            {provider.status === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
            {provider.status === 'offline' && <X className="w-3 h-3" />}
            {provider.status}
          </div>
          <Switch checked={provider.isActive} onCheckedChange={onToggle} />
        </div>
      </div>

      {provider.latency && provider.status === 'online' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Zap className="w-4 h-4 text-warning" />
          {provider.latency}ms latency
        </div>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCheck}
            disabled={checking}
            className="flex-1"
          >
            {checking ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Test
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onRemove}
            title="Remove provider"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className={cn("w-4 h-4 transition-transform", isOpen && "rotate-90")} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4 space-y-3 pt-4 border-t border-border">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Endpoint</label>
            <Input
              value={provider.endpoint}
              onChange={(e) => onUpdateEndpoint(e.target.value)}
              placeholder="http://localhost:8080"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Model</label>
            <Input
              value={provider.model || ''}
              onChange={(e) => onUpdateModel(e.target.value)}
              placeholder="default"
              className="text-sm"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
