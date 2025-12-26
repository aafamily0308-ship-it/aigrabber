import { StatusCard } from "@/components/ui/status-card";
import { 
  Bot, 
  MessageSquare, 
  Cpu, 
  Cloud, 
  Zap,
  Clock,
  Database,
  Shield,
  TrendingUp
} from "lucide-react";
import { useProviderStore } from "@/stores/providerStore";
import { useChatStore } from "@/stores/chatStore";
import { useAuditStore } from "@/stores/auditStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { QuickChat } from "@/components/dashboard/QuickChat";
import { RecentConversations } from "@/components/dashboard/RecentConversations";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { useMemo } from "react";
import { format, subDays, startOfDay } from "date-fns";

export default function Dashboard() {
  const { providers } = useProviderStore();
  const { conversations } = useChatStore();
  const { entries, getStats } = useAuditStore();
  const { documents } = useKnowledgeStore();

  const localProviders = providers.filter(p => p.type === 'local');
  const onlineLocal = localProviders.filter(p => p.status === 'online').length;
  const totalMessages = conversations.reduce((acc, c) => acc + c.messages.length, 0);
  
  const stats = getStats();

  // Prepare chart data
  const usageByDay = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(date, 'MMM dd'),
        local: 0,
        cloud: 0,
        tokens: 0,
      };
    });

    entries.forEach(entry => {
      if (entry.action !== 'chat_request') return;
      const entryDate = startOfDay(new Date(entry.timestamp));
      const dayIndex = last7Days.findIndex(d => d.date === format(entryDate, 'MMM dd'));
      if (dayIndex >= 0) {
        if (entry.providerType === 'local') {
          last7Days[dayIndex].local++;
        } else {
          last7Days[dayIndex].cloud++;
        }
        last7Days[dayIndex].tokens += entry.tokensUsed || 0;
      }
    });

    return last7Days;
  }, [entries]);

  const providerDistribution = useMemo(() => [
    { name: 'Local', value: stats.localRequests, color: 'hsl(var(--success))' },
    { name: 'Cloud', value: stats.cloudRequests, color: 'hsl(var(--secondary))' },
  ], [stats]);

  const dataPrivacyStats = useMemo(() => {
    const sensitiveCount = entries.filter(e => e.sensitiveDataDetected).length;
    const totalRequests = entries.filter(e => e.action === 'chat_request').length;
    return {
      sensitiveCount,
      totalRequests,
      privatePercent: totalRequests > 0 
        ? Math.round((stats.localRequests / totalRequests) * 100) 
        : 100,
    };
  }, [entries, stats]);

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Usage Over Time */}
        <div className="glass rounded-xl p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-foreground mb-4">Usage Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="local" 
                  name="Local Requests"
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cloud" 
                  name="Cloud Requests"
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--secondary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Provider Distribution */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Provider Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {providerDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard
          title="Total Tokens"
          value={stats.totalTokens.toLocaleString()}
          subtitle="Estimated usage"
          icon={Zap}
        />
        <StatusCard
          title="Data Sent to Cloud"
          value={`${(stats.totalDataSent / 1024).toFixed(1)} KB`}
          subtitle="Total bytes"
          icon={Cloud}
        />
        <StatusCard
          title="Privacy Score"
          value={`${dataPrivacyStats.privatePercent}%`}
          subtitle="Local processing"
          icon={Shield}
          status={dataPrivacyStats.privatePercent >= 50 ? "online" : "offline"}
        />
        <StatusCard
          title="Knowledge Base"
          value={documents.length}
          subtitle="Documents indexed"
          icon={Database}
        />
      </div>

      {/* Token Usage Bar Chart */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Token Usage by Day</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar 
                dataKey="tokens" 
                name="Tokens"
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickChat />
        <RecentConversations />
      </div>
    </div>
  );
}
