import { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Cloud,
  Cpu,
  Shield,
  AlertTriangle,
  Clock,
  Zap,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuditStore, AuditEntry } from '@/stores/auditStore';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const actionIcons = {
  chat_request: Cloud,
  document_upload: Database,
  export: Download,
  settings_change: Shield,
  provider_change: Cpu,
};

const actionColors = {
  chat_request: 'text-blue-400',
  document_upload: 'text-purple-400',
  export: 'text-green-400',
  settings_change: 'text-yellow-400',
  provider_change: 'text-orange-400',
};

export default function AuditLog() {
  const { entries, clearEntries, getStats } = useAuditStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  const stats = useMemo(() => getStats(), [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filterAction !== 'all' && entry.action !== filterAction) return false;
      if (filterProvider !== 'all' && entry.providerType !== filterProvider) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.action.toLowerCase().includes(query) ||
          entry.provider?.toLowerCase().includes(query) ||
          entry.details?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [entries, filterAction, filterProvider, searchQuery]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleExport = () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Track all AI requests and data transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Audit Log?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all audit entries. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearEntries} className="bg-destructive text-destructive-foreground">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalRequests}</p>
              <p className="text-sm text-muted-foreground">Total Requests</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.localRequests}</p>
              <p className="text-sm text-muted-foreground">Local (Private)</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.cloudRequests}</p>
              <p className="text-sm text-muted-foreground">Cloud</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{(stats.totalTokens / 1000).toFixed(1)}K</p>
              <p className="text-sm text-muted-foreground">Tokens Used</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatBytes(stats.totalDataSent)}</p>
              <p className="text-sm text-muted-foreground">Data Sent (Cloud)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="chat_request">Chat Request</SelectItem>
            <SelectItem value="document_upload">Document Upload</SelectItem>
            <SelectItem value="export">Export</SelectItem>
            <SelectItem value="settings_change">Settings</SelectItem>
            <SelectItem value="provider_change">Provider</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProvider} onValueChange={setFilterProvider}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            <SelectItem value="local">Local Only</SelectItem>
            <SelectItem value="cloud">Cloud Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Entries */}
      <div className="glass rounded-xl overflow-hidden">
        <ScrollArea className="h-[500px]">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No audit entries</p>
              <p className="text-sm mt-1">Activity will appear here as you use the system</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEntries.map((entry) => {
                const Icon = actionIcons[entry.action];
                return (
                  <div key={entry.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        entry.providerType === 'local' ? 'bg-green-500/20' : 'bg-purple-500/20'
                      )}>
                        <Icon className={cn('w-5 h-5', actionColors[entry.action])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground capitalize">
                            {entry.action.replace('_', ' ')}
                          </span>
                          {entry.provider && (
                            <Badge variant="outline" className="text-xs">
                              {entry.provider}
                            </Badge>
                          )}
                          {entry.providerType === 'local' && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Shield className="w-3 h-3" />
                              Private
                            </Badge>
                          )}
                          {entry.sensitiveDataDetected && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Sensitive
                            </Badge>
                          )}
                        </div>
                        {entry.details && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {entry.details}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                          </span>
                          {entry.tokensUsed && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {entry.tokensUsed} tokens
                            </span>
                          )}
                          {entry.dataSize && (
                            <span className="flex items-center gap-1">
                              <Database className="w-3 h-3" />
                              {formatBytes(entry.dataSize)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
