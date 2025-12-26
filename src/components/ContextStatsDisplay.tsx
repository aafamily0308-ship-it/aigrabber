import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ContextStatsDisplayProps {
  usedTokens: number;
  maxTokens: number;
  messageCount: number;
  className?: string;
}

export function ContextStatsDisplay({ 
  usedTokens, 
  maxTokens, 
  messageCount,
  className 
}: ContextStatsDisplayProps) {
  const percentage = Math.min((usedTokens / maxTokens) * 100, 100);
  
  const getStatusColor = () => {
    if (percentage < 50) return "text-success";
    if (percentage < 80) return "text-warning";
    return "text-destructive";
  };

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <Info className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-medium", getStatusColor())}>
                {formatTokens(usedTokens)}
              </span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs text-muted-foreground">
                {formatTokens(maxTokens)}
              </span>
            </div>
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  percentage < 50 ? "bg-success" :
                  percentage < 80 ? "bg-warning" : "bg-destructive"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p>Context: {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens</p>
            <p>Messages in context: {messageCount}</p>
            <p className="text-muted-foreground">
              {percentage >= 80 
                ? "Consider starting a new conversation" 
                : "Plenty of context space available"
              }
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
