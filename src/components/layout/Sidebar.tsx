import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  MessageSquare, 
  BookOpen, 
  Server, 
  Settings,
  Bot,
  ChevronLeft,
  ChevronRight,
  History,
  FileText,
  Puzzle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "AI Chat" },
  { to: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { to: "/prompts", icon: FileText, label: "Prompts" },
  { to: "/plugins", icon: Puzzle, label: "Plugins & MCP" },
  { to: "/providers", icon: Server, label: "Providers" },
  { to: "/audit", icon: History, label: "Audit Log" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-lg text-foreground glow-text">AI Command</h1>
            <p className="text-xs text-muted-foreground">Center</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/30" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )
            }
          >
            <item.icon className={cn(
              "w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110",
            )} />
            {!collapsed && (
              <span className="font-medium text-sm">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed && (
          <div className="text-xs text-muted-foreground">
            <p>Version 2.0.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}