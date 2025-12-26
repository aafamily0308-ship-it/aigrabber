// Maintenance Panel - UI for system maintenance and health monitoring
import { useState, useEffect } from 'react';
import {
  Shield,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Upload,
  Trash2,
  Clock,
  Cpu,
  Database,
  Wrench,
  Activity,
  Settings2,
  FileDown,
  Play,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useMaintenanceStore } from '@/stores/maintenanceStore';
import { getPlatform, SystemHealth } from '@/lib/maintenanceSystem';
import { formatDistanceToNow } from 'date-fns';

export function MaintenancePanel() {
  const [providerStatus, setProviderStatus] = useState<Array<{ provider: string; status: string; message: string }>>([]);
  const [testingProviders, setTestingProviders] = useState(false);
  const { toast } = useToast();

  const {
    isMaintenanceMode,
    lastHealthCheck,
    lastMaintenanceResult,
    backups,
    isRunning,
    autoBackupEnabled,
    autoBackupIntervalHours,
    setMaintenanceMode,
    runHealthCheck,
    runFullMaintenance,
    createManualBackup,
    refreshBackupList,
    setAutoBackup,
    exportSystemDiagnostics,
    testProviders,
  } = useMaintenanceStore();

  // Load initial data
  useEffect(() => {
    refreshBackupList();
    if (!lastHealthCheck) {
      runHealthCheck();
    }
  }, []);

  const handleRunHealthCheck = async () => {
    try {
      await runHealthCheck();
      toast({ title: 'Health Check Complete', description: 'System diagnostics updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRunMaintenance = async (options: { autoFix?: boolean; clearOldData?: boolean; reindexVectors?: boolean }) => {
    try {
      const result = await runFullMaintenance(options);
      if (result.success) {
        toast({
          title: 'Maintenance Complete',
          description: `Applied ${result.fixesApplied.length} fixes in ${(result.duration / 1000).toFixed(1)}s`,
        });
      } else {
        toast({
          title: 'Maintenance Completed with Errors',
          description: result.errors.join(', '),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({ title: 'Maintenance Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateBackup = async () => {
    const result = await createManualBackup();
    if (result.success) {
      toast({ title: 'Backup Created', description: `ID: ${result.backupId?.slice(0, 16)}...` });
    } else {
      toast({ title: 'Backup Failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleTestProviders = async () => {
    setTestingProviders(true);
    try {
      const results = await testProviders();
      setProviderStatus(results);
      toast({ title: 'Provider Test Complete', description: `Tested ${results.length} providers` });
    } catch (error: any) {
      toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
    } finally {
      setTestingProviders(false);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const diagnostics = await exportSystemDiagnostics();
      const blob = new Blob([diagnostics], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Diagnostics Exported', description: 'File downloaded' });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusIcon = (status: 'pass' | 'warn' | 'fail' | 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'warn':
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'fail':
      case 'critical':
        return <XCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: 'pass' | 'warn' | 'fail') => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pass: 'default',
      warn: 'secondary',
      fail: 'destructive',
    };
    return (
      <Badge variant={variants[status]} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            System Maintenance
          </h2>
          <p className="text-muted-foreground">
            Platform: {getPlatform()} • Health monitoring, backups, and self-repair
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMaintenanceMode && (
            <Badge variant="destructive" className="animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Maintenance Mode
            </Badge>
          )}
          <Badge variant={lastHealthCheck?.overall === 'healthy' ? 'default' : lastHealthCheck?.overall === 'warning' ? 'secondary' : 'destructive'}>
            {lastHealthCheck?.overall?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="health">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health" className="gap-2">
            <Activity className="w-4 h-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <HardDrive className="w-4 h-4" />
            Backups ({backups.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="w-4 h-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2">
            <Cpu className="w-4 h-4" />
            Providers
          </TabsTrigger>
        </TabsList>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Health Checks</h3>
            <Button onClick={handleRunHealthCheck} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Run Check
            </Button>
          </div>

          {lastHealthCheck && (
            <>
              {/* Overall Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(lastHealthCheck.overall)}
                      <div>
                        <p className="font-semibold">Overall System Status</p>
                        <p className="text-sm text-muted-foreground">
                          Last checked: {formatDistanceToNow(new Date(lastHealthCheck.timestamp))} ago
                        </p>
                      </div>
                    </div>
                    <Badge variant={lastHealthCheck.overall === 'healthy' ? 'default' : 'destructive'}>
                      {lastHealthCheck.overall.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Storage</span>
                    </div>
                    <Progress value={lastHealthCheck.metrics.storagePercent} className="h-2 mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {(lastHealthCheck.metrics.storageUsed / 1024 / 1024).toFixed(1)} MB used
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileDown className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Documents</span>
                    </div>
                    <p className="text-2xl font-bold">{lastHealthCheck.metrics.documentCount}</p>
                    <p className="text-xs text-muted-foreground">In knowledge base</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Messages</span>
                    </div>
                    <p className="text-2xl font-bold">{lastHealthCheck.metrics.messageCount}</p>
                    <p className="text-xs text-muted-foreground">{lastHealthCheck.metrics.conversationCount} conversations</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Backups</span>
                    </div>
                    <p className="text-2xl font-bold">{lastHealthCheck.metrics.backupCount}</p>
                    <p className="text-xs text-muted-foreground">Saved checkpoints</p>
                  </CardContent>
                </Card>
              </div>

              {/* Individual Checks */}
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {lastHealthCheck.checks.map((check, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(check.status)}
                          <div>
                            <p className="font-medium">{check.name}</p>
                            <p className="text-sm text-muted-foreground">{check.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(check.status)}
                          {check.fixable && check.status !== 'pass' && (
                            <Badge variant="outline" className="text-xs">Fixable</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Backups</h3>
            <Button onClick={handleCreateBackup} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Create Backup
            </Button>
          </div>

          {/* Auto-backup Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Auto-Backup Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Backup</Label>
                  <p className="text-sm text-muted-foreground">Automatically create backups periodically</p>
                </div>
                <Switch
                  checked={autoBackupEnabled}
                  onCheckedChange={(checked) => setAutoBackup(checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Backup Interval</Label>
                <Select
                  value={String(autoBackupIntervalHours)}
                  onValueChange={(v) => setAutoBackup(autoBackupEnabled, Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="168">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Backup List */}
          <ScrollArea className="h-[250px]">
            <div className="space-y-2">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No backups yet</p>
                  <p className="text-sm">Create a backup to protect your data</p>
                </div>
              ) : (
                backups.map((backup) => (
                  <Card key={backup.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HardDrive className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{backup.id.slice(0, 20)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(backup.timestamp))} ago • {(backup.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Run Maintenance
              </CardTitle>
              <CardDescription>
                Perform system maintenance with automatic error fixing and cleanup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" size="lg" disabled={isRunning}>
                    {isRunning ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 mr-2" />
                    )}
                    Start Full Maintenance
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Run System Maintenance?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Create a backup before any changes</li>
                        <li>Run all health checks</li>
                        <li>Automatically fix detected issues</li>
                        <li>Clean up old backup files</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRunMaintenance({ autoFix: true, clearOldData: true })}>
                      Run Maintenance
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleRunMaintenance({ autoFix: true })} disabled={isRunning}>
                  <Wrench className="w-4 h-4 mr-2" />
                  Auto-Fix Only
                </Button>
                <Button variant="outline" onClick={() => handleRunMaintenance({ clearOldData: true })} disabled={isRunning}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clean Old Data
                </Button>
                <Button variant="outline" onClick={() => handleRunMaintenance({ reindexVectors: true })} disabled={isRunning}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reindex Vectors
                </Button>
                <Button variant="outline" onClick={handleExportDiagnostics}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export Diagnostics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Last Maintenance Result */}
          {lastMaintenanceResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last Maintenance Result</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {lastMaintenanceResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <span className="font-medium">
                      {lastMaintenanceResult.success ? 'Completed Successfully' : 'Completed with Errors'}
                    </span>
                    <Badge variant="outline">{(lastMaintenanceResult.duration / 1000).toFixed(1)}s</Badge>
                  </div>
                  {lastMaintenanceResult.fixesApplied.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fixes Applied:</p>
                      <ul className="text-sm list-disc list-inside">
                        {lastMaintenanceResult.fixesApplied.map((fix, idx) => (
                          <li key={idx}>{fix}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lastMaintenanceResult.errors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive">Errors:</p>
                      <ul className="text-sm list-disc list-inside text-destructive">
                        {lastMaintenanceResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">AI Provider Status</h3>
            <Button onClick={handleTestProviders} disabled={testingProviders}>
              {testingProviders ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Test All
            </Button>
          </div>

          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {providerStatus.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Test All" to check provider status</p>
                </div>
              ) : (
                providerStatus.map((p, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          p.status === 'online' ? 'bg-success' :
                          p.status === 'offline' ? 'bg-muted' :
                          'bg-destructive'
                        }`} />
                        <div>
                          <p className="font-medium">{p.provider}</p>
                          <p className="text-sm text-muted-foreground">{p.message}</p>
                        </div>
                      </div>
                      <Badge variant={p.status === 'online' ? 'default' : p.status === 'offline' ? 'secondary' : 'destructive'}>
                        {p.status.toUpperCase()}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
