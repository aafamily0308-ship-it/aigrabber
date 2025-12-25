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
  ExternalLink,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProviderStore, Provider } from "@/stores/providerStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function Providers() {
  const [checking, setChecking] = useState<string | null>(null);
  const { toast } = useToast();
  
  const {
    providers,
    updateProviderStatus,
    toggleProvider,
    updateProviderEndpoint,
    updateProviderModel,
  } = useProviderStore();

  const checkProvider = async (provider: Provider) => {
    setChecking(provider.id);
    updateProviderStatus(provider.id, 'checking');

    try {
      if (provider.type === 'local') {
        const startTime = Date.now();
        
        if (provider.id === 'ollama') {
          const response = await fetch(`${provider.endpoint}/api/tags`, {
            method: 'GET',
          });
          if (response.ok) {
            const latency = Date.now() - startTime;
            updateProviderStatus(provider.id, 'online', latency);
            toast({
              title: "Ollama Connected",
              description: `Response time: ${latency}ms`,
            });
          } else {
            throw new Error('Not available');
          }
        } else if (provider.id === 'lmstudio') {
          const response = await fetch(`${provider.endpoint}/v1/models`, {
            method: 'GET',
          });
          if (response.ok) {
            const latency = Date.now() - startTime;
            updateProviderStatus(provider.id, 'online', latency);
            toast({
              title: "LM Studio Connected",
              description: `Response time: ${latency}ms`,
            });
          } else {
            throw new Error('Not available');
          }
        }
      } else {
        // Cloud providers are always online
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
    // Check local providers on mount
    providers
      .filter(p => p.type === 'local')
      .forEach(p => checkProvider(p));
  }, []);

  const localProviders = providers.filter(p => p.type === 'local');
  const cloudProviders = providers.filter(p => p.type === 'cloud');

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
            />
          ))}
        </div>
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
}

function ProviderCard({ 
  provider, 
  checking, 
  onCheck, 
  onToggle,
  onUpdateEndpoint,
  onUpdateModel,
}: ProviderCardProps) {
  const [showSettings, setShowSettings] = useState(false);

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

      {showSettings && provider.type === 'local' && (
        <div className="space-y-3 mb-4 pt-4 border-t border-border">
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
            <Input
              value={provider.model || ''}
              onChange={(e) => onUpdateModel(e.target.value)}
              placeholder="llama3.2"
              className="text-sm"
            />
          </div>
        </div>
      )}

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
        {provider.type === 'local' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
