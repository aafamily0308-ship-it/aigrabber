import { useState, useEffect } from "react";
import { Activity, CheckCircle, XCircle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  checkAllProviders, 
  getHealthSummary, 
  ProviderHealth,
  ProviderId,
} from "@/lib/providerHealthMonitor";
import { useProviderStore } from "@/stores/providerStore";

interface ProviderHealthIndicatorProps {
  className?: string;
}

export function ProviderHealthIndicator({ className }: ProviderHealthIndicatorProps) {
  const [healthMap, setHealthMap] = useState<Map<ProviderId, ProviderHealth>>(new Map());
  const [isChecking, setIsChecking] = useState(false);
  const { providers } = useProviderStore();

  const summary = getHealthSummary();

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const result = await checkAllProviders();
      setHealthMap(new Map(result));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
    
    const interval = setInterval(runHealthCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ProviderHealth['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ProviderHealth['status']) => {
    switch (status) {
      case 'online':
        return 'bg-success/10 text-success';
      case 'offline':
        return 'bg-destructive/10 text-destructive';
      case 'degraded':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getProviderName = (id: ProviderId): string => {
    const provider = providers.find(p => p.id === id);
    return provider?.name || id;
  };

  const healthArray = Array.from(healthMap.entries());
  const onlineCount = healthArray.filter(([_, h]) => h.status === 'online').length;
  const totalCount = healthArray.length || providers.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-2", className)}
        >
          {isChecking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Activity className={cn(
              "w-4 h-4",
              onlineCount === totalCount ? "text-success" :
              onlineCount > 0 ? "text-warning" : "text-destructive"
            )} />
          )}
          <span className="text-xs">
            {onlineCount}/{totalCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Provider Status</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={runHealthCheck}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {healthArray.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No providers checked yet...
              </p>
            ) : (
              healthArray.map(([providerId, health]) => (
                <div
                  key={providerId}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(health.status)}
                    <span className="text-sm font-medium">
                      {getProviderName(providerId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {health.latency !== null && (
                      <span className="text-xs text-muted-foreground">
                        {health.latency}ms
                      </span>
                    )}
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", getStatusColor(health.status))}
                    >
                      {health.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          {healthArray.length > 0 && (
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              Last checked: {healthArray[0]?.[1].lastCheck?.toLocaleTimeString() || 'Never'}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
