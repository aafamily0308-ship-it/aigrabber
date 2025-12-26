// System Health Indicator - Live status indicator for sidebar
import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, XCircle, Shield, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystemBrain, BrainMode, ComponentStatus } from '@/lib/aiBrain';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface SystemHealthIndicatorProps {
  collapsed?: boolean;
  onClick?: () => void;
}

export function SystemHealthIndicator({ collapsed = false, onClick }: SystemHealthIndicatorProps) {
  const { snapshot, mode, components, metrics } = useSystemBrain();
  const [pulse, setPulse] = useState(false);

  // Pulse animation when status changes
  useEffect(() => {
    setPulse(true);
    const timeout = setTimeout(() => setPulse(false), 1000);
    return () => clearTimeout(timeout);
  }, [snapshot.timestamp]);

  // Calculate overall status
  const getOverallStatus = (): ComponentStatus => {
    const statuses = components.map(c => c.status);
    if (statuses.some(s => s === 'failed')) return 'failed';
    if (statuses.some(s => s === 'isolated')) return 'isolated';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();
  const healthyCount = components.filter(c => c.status === 'healthy').length;
  const issueCount = components.filter(c => c.status !== 'healthy').length;

  const getStatusColor = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'degraded': return 'text-warning';
      case 'failed': return 'text-destructive';
      case 'isolated': return 'text-muted-foreground';
    }
  };

  const getStatusBg = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy': return 'bg-success/20';
      case 'degraded': return 'bg-warning/20';
      case 'failed': return 'bg-destructive/20';
      case 'isolated': return 'bg-muted/20';
    }
  };

  const getStatusIcon = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy': return CheckCircle2;
      case 'degraded': return AlertTriangle;
      case 'failed': return XCircle;
      case 'isolated': return Shield;
    }
  };

  const getModeLabel = (mode: BrainMode) => {
    switch (mode) {
      case 'normal': return 'Normal';
      case 'safe': return 'Safe Mode';
      case 'recovery': return 'Recovering';
      case 'maintenance': return 'Maintenance';
    }
  };

  const getModeColor = (mode: BrainMode) => {
    switch (mode) {
      case 'normal': return 'text-success';
      case 'safe': return 'text-warning';
      case 'recovery': return 'text-primary';
      case 'maintenance': return 'text-muted-foreground';
    }
  };

  const StatusIcon = getStatusIcon(overallStatus);

  const content = (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
        getStatusBg(overallStatus),
        "hover:opacity-80",
        pulse && "animate-pulse"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Brain className={cn("w-5 h-5", getStatusColor(overallStatus))} />
        {mode !== 'normal' && (
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning animate-pulse" />
        )}
      </div>
      
      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">System Brain</span>
            <StatusIcon className={cn("w-3 h-3", getStatusColor(overallStatus))} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[10px]", getModeColor(mode))}>
              {getModeLabel(mode)}
            </span>
            {issueCount > 0 && (
              <Badge variant="destructive" className="h-4 text-[10px] px-1">
                {issueCount} issues
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("w-4 h-4", getStatusColor(overallStatus))} />
            <span className="font-medium">System Brain</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Mode: <span className={getModeColor(mode)}>{getModeLabel(mode)}</span></p>
            <p>Components: {healthyCount}/{components.length} healthy</p>
            <p>Total Errors: {metrics.totalErrors}</p>
            {metrics.lastRecovery && (
              <p>Last Recovery: {new Date(metrics.lastRecovery).toLocaleTimeString()}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

// Compact version for inline use
export function SystemHealthBadge() {
  const { components } = useSystemBrain();
  
  const getOverallStatus = (): ComponentStatus => {
    const statuses = components.map(c => c.status);
    if (statuses.some(s => s === 'failed')) return 'failed';
    if (statuses.some(s => s === 'isolated')) return 'isolated';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const status = getOverallStatus();
  const healthyCount = components.filter(c => c.status === 'healthy').length;

  const getVariant = () => {
    switch (status) {
      case 'healthy': return 'default' as const;
      case 'degraded': return 'secondary' as const;
      case 'failed': 
      case 'isolated': return 'destructive' as const;
    }
  };

  return (
    <Badge variant={getVariant()} className="gap-1">
      <Activity className="w-3 h-3" />
      {healthyCount}/{components.length}
    </Badge>
  );
}
