import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NetworkStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function NetworkStatusIndicator({ className, showLabel = false }: NetworkStatusIndicatorProps) {
  const { isOnline, wasOffline, lastOnline } = useNetworkStatus();

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: "Offline",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        description: "No internet connection. Using local AI only.",
      };
    }
    if (wasOffline) {
      return {
        icon: AlertTriangle,
        label: "Reconnected",
        color: "text-warning",
        bgColor: "bg-warning/10",
        description: `Back online. Was offline since ${lastOnline?.toLocaleTimeString() || 'recently'}.`,
      };
    }
    return {
      icon: Wifi,
      label: "Online",
      color: "text-success",
      bgColor: "bg-success/10",
      description: "Connected. All providers available.",
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
              status.bgColor,
              className
            )}
          >
            <Icon className={cn("w-4 h-4", status.color)} />
            {showLabel && (
              <span className={cn("text-xs font-medium", status.color)}>
                {status.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{status.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
