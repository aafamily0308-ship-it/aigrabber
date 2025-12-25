import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: "online" | "offline" | "pending";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatusCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  status,
  trend,
  className 
}: StatusCardProps) {
  return (
    <div className={cn(
      "glass rounded-xl p-5 hover:border-primary/40 transition-all duration-300 group",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          status === "online" ? "bg-success/20" : 
          status === "offline" ? "bg-destructive/20" : 
          status === "pending" ? "bg-warning/20" : "bg-primary/20"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            status === "online" ? "text-success" : 
            status === "offline" ? "text-destructive" : 
            status === "pending" ? "text-warning" : "text-primary"
          )} />
        </div>
        {status && (
          <div className={cn(
            "flex items-center gap-2 text-xs font-medium",
            status === "online" ? "text-success" : 
            status === "offline" ? "text-destructive" : "text-warning"
          )}>
            <span className={cn(
              status === "online" ? "status-online" : 
              status === "offline" ? "status-offline" : "status-pending"
            )} />
            {status === "online" ? "Online" : status === "offline" ? "Offline" : "Pending"}
          </div>
        )}
      </div>
      
      <h3 className="text-muted-foreground text-sm font-medium mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {trend && (
          <span className={cn(
            "text-xs font-medium mb-1",
            trend.isPositive ? "text-success" : "text-destructive"
          )}>
            {trend.isPositive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
