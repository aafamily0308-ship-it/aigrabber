import { StatusCard } from "@/components/ui/status-card";
import { 
  Bot, 
  MessageSquare, 
  Cpu, 
  Cloud, 
  Zap,
  TrendingUp,
  Clock,
  Database
} from "lucide-react";
import { useProviderStore } from "@/stores/providerStore";
import { useChatStore } from "@/stores/chatStore";
import { QuickChat } from "@/components/dashboard/QuickChat";
import { RecentConversations } from "@/components/dashboard/RecentConversations";

export default function Dashboard() {
  const { providers } = useProviderStore();
  const { conversations } = useChatStore();

  const localProviders = providers.filter(p => p.type === 'local');
  const cloudProviders = providers.filter(p => p.type === 'cloud');
  const onlineLocal = localProviders.filter(p => p.status === 'online').length;
  const totalMessages = conversations.reduce((acc, c) => acc + c.messages.length, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI Command Center Overview</p>
        </div>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
          <div className="status-online" />
          <span className="text-sm text-foreground">System Active</span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Active Agents"
          value={providers.filter(p => p.isActive).length}
          subtitle={`${onlineLocal} local online`}
          icon={Bot}
          status="online"
        />
        <StatusCard
          title="Local AI Status"
          value={onlineLocal > 0 ? "Connected" : "Offline"}
          subtitle="Ollama / LM Studio"
          icon={Cpu}
          status={onlineLocal > 0 ? "online" : "offline"}
        />
        <StatusCard
          title="Cloud AI"
          value="Available"
          subtitle="Gemini • GPT-5"
          icon={Cloud}
          status="online"
        />
        <StatusCard
          title="Total Messages"
          value={totalMessages}
          subtitle={`${conversations.length} conversations`}
          icon={MessageSquare}
          trend={{ value: 12, isPositive: true }}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Avg Response Time"
          value="1.2s"
          subtitle="Last 24 hours"
          icon={Clock}
        />
        <StatusCard
          title="Tokens Used Today"
          value="12.4K"
          subtitle="Cloud providers"
          icon={Zap}
        />
        <StatusCard
          title="Knowledge Base"
          value="0"
          subtitle="Documents indexed"
          icon={Database}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickChat />
        <RecentConversations />
      </div>
    </div>
  );
}
