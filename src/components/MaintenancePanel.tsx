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
  Loader2,
  Brain,
  Zap,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Power,
  FlaskConical,
  Target,
  TrendingUp
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
import { useSystemBrain, DiagnosisResult, RepairResult, ComponentHealth, BrainMode } from '@/lib/aiBrain';
import { StressTestReport } from '@/lib/stressTest';

export function MaintenancePanel() {
  const [providerStatus, setProviderStatus] = useState<Array<{ provider: string; status: string; message: string }>>([]);
  const [testingProviders, setTestingProviders] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [stressReport, setStressReport] = useState<StressTestReport | null>(null);
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);
  const [isRunningRepair, setIsRunningRepair] = useState(false);
  const [isRunningStress, setIsRunningStress] = useState(false);
  const { toast } = useToast();

  // AI Brain hook
  const { 
    snapshot, 
    mode, 
    components, 
    metrics, 
    diagnose, 
    repair, 
    stressTest,
    isolate,
    restore,
    enterSafeMode,
    exitSafeMode 
  } = useSystemBrain();

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

  // AI Brain handlers
  const handleAIDiagnose = async (useAI: boolean = false) => {
    setIsRunningDiagnosis(true);
    try {
      const result = await diagnose(useAI);
      setDiagnosisResult(result);
      toast({
        title: 'Diagnosis Complete',
        description: `Found ${result.issues.length} issues. Status: ${result.overallStatus}`,
        variant: result.overallStatus === 'healthy' ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({ title: 'Diagnosis Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningDiagnosis(false);
    }
  };

  const handleAIRepair = async () => {
    setIsRunningRepair(true);
    try {
      const result = await repair();
      setRepairResult(result);
      toast({
        title: result.success ? 'Repair Complete' : 'Repair Partial',
        description: `Recovered ${result.componentsRecovered.length} components`,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({ title: 'Repair Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningRepair(false);
    }
  };

  const handleStressTest = async () => {
    setIsRunningStress(true);
    try {
      const result = await stressTest();
      setStressReport(result);
      toast({
        title: 'Stress Test Complete',
        description: `${result.passedTests}/${result.totalTests} tests passed`,
        variant: result.systemStable ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({ title: 'Stress Test Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningStress(false);
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

  const getComponentStatusIcon = (status: ComponentHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'isolated':
        return <ShieldAlert className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getModeLabel = (mode: BrainMode) => {
    switch (mode) {
      case 'normal': return 'Normal';
      case 'safe': return 'Safe Mode';
      case 'recovery': return 'Recovery';
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            System Brain & Maintenance
          </h2>
          <p className="text-muted-foreground">
            Platform: {getPlatform()} • AI-powered diagnostics, self-repair, and monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMaintenanceMode && (
            <Badge variant="destructive" className="animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Maintenance Mode
            </Badge>
          )}
          <Badge variant="outline" className={getModeColor(mode)}>
            <Brain className="w-3 h-3 mr-1" />
            {getModeLabel(mode)}
          </Badge>
          <Badge variant={lastHealthCheck?.overall === 'healthy' ? 'default' : lastHealthCheck?.overall === 'warning' ? 'secondary' : 'destructive'}>
            {lastHealthCheck?.overall?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="brain">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="brain" className="gap-2">
            <Brain className="w-4 h-4" />
            AI Brain
          </TabsTrigger>
          <TabsTrigger value="stress" className="gap-2">
            <FlaskConical className="w-4 h-4" />
            Stress Test
          </TabsTrigger>
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

        {/* AI Brain Tab */}
        <TabsContent value="brain" className="space-y-4">
          {/* Brain Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                System Brain Status
              </CardTitle>
              <CardDescription>
                Intelligent system controller with Circuit Breaker and isolation capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode & Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className={`font-bold ${getModeColor(mode)}`}>{getModeLabel(mode)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Components</p>
                  <p className="font-bold">{components.filter(c => c.status === 'healthy').length}/{components.length}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Errors</p>
                  <p className="font-bold text-destructive">{metrics.totalErrors}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="font-bold">{Math.floor(metrics.uptime / 60000)}m</p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button 
                  onClick={() => handleAIDiagnose(false)} 
                  disabled={isRunningDiagnosis}
                  variant="outline"
                >
                  {isRunningDiagnosis ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                  Quick Diagnose
                </Button>
                <Button 
                  onClick={() => handleAIDiagnose(true)} 
                  disabled={isRunningDiagnosis}
                  variant="outline"
                >
                  {isRunningDiagnosis ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                  AI Diagnose
                </Button>
                <Button 
                  onClick={handleAIRepair} 
                  disabled={isRunningRepair}
                  variant="default"
                >
                  {isRunningRepair ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
                  Auto Repair
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant={mode === 'safe' ? 'default' : 'destructive'}>
                      <Power className="w-4 h-4 mr-2" />
                      {mode === 'safe' ? 'Exit Safe Mode' : 'Safe Mode'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {mode === 'safe' ? 'Exit Safe Mode?' : 'Enter Safe Mode?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {mode === 'safe' 
                          ? 'This will restore all isolated components and return to normal operation.'
                          : 'Safe mode will isolate non-critical components to ensure system stability.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => mode === 'safe' ? exitSafeMode() : enterSafeMode()}>
                        {mode === 'safe' ? 'Exit Safe Mode' : 'Enter Safe Mode'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Component Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Component Status & Circuit Breakers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {components.map((comp) => (
                    <Card key={comp.id} className="border-muted">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getComponentStatusIcon(comp.status)}
                          <div>
                            <p className="font-medium">{comp.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Errors: {comp.errorCount}</span>
                              {comp.circuitBreaker.isOpen && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Circuit Open
                                </Badge>
                              )}
                              {comp.circuitBreaker.failures > 0 && !comp.circuitBreaker.isOpen && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Failures: {comp.circuitBreaker.failures}/3
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            comp.status === 'healthy' ? 'default' :
                            comp.status === 'degraded' ? 'secondary' :
                            comp.status === 'isolated' ? 'outline' : 'destructive'
                          }>
                            {comp.status.toUpperCase()}
                          </Badge>
                          {comp.status === 'isolated' ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => restore(comp.id)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Restore
                            </Button>
                          ) : comp.status === 'failed' ? (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => isolate(comp.id)}
                            >
                              <ShieldAlert className="w-3 h-3 mr-1" />
                              Isolate
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Diagnosis Result */}
          {diagnosisResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {getStatusIcon(diagnosisResult.overallStatus)}
                  Latest Diagnosis Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {diagnosisResult.issues.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {diagnosisResult.issues.map((issue, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{issue.component}</span>
                            <Badge variant={
                              issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' :
                              issue.severity === 'medium' ? 'secondary' : 'outline'
                            }>
                              {issue.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                          <p className="text-xs text-primary mt-1">Fix: {issue.suggestedFix}</p>
                          {issue.autoFixable && (
                            <Badge variant="outline" className="mt-2 text-[10px]">Auto-fixable</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-4 text-success">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No issues found!</p>
                  </div>
                )}

                {diagnosisResult.aiAnalysis && (
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Analysis
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{diagnosisResult.aiAnalysis}</p>
                  </div>
                )}

                {diagnosisResult.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recommendations:</p>
                    <ul className="text-sm list-disc list-inside text-muted-foreground">
                      {diagnosisResult.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Repair Result */}
          {repairResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {repairResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  )}
                  Latest Repair Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {repairResult.actionsPerformed.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-success">Actions Performed:</p>
                      <ul className="text-sm list-disc list-inside">
                        {repairResult.actionsPerformed.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {repairResult.componentsRecovered.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {repairResult.componentsRecovered.map((comp, idx) => (
                        <Badge key={idx} variant="default">{comp}</Badge>
                      ))}
                    </div>
                  )}
                  {repairResult.errors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive">Errors:</p>
                      <ul className="text-sm list-disc list-inside text-destructive">
                        {repairResult.errors.map((err, idx) => (
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

        {/* Stress Test Tab */}
        <TabsContent value="stress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                System Stress Test
              </CardTitle>
              <CardDescription>
                Run maximum load tests to verify system stability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleStressTest} 
                disabled={isRunningStress}
                size="lg"
                className="w-full"
              >
                {isRunningStress ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Running Stress Tests...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Run Full Stress Test
                  </>
                )}
              </Button>

              {stressReport && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold">{stressReport.totalTests}</p>
                      <p className="text-xs text-muted-foreground">Total Tests</p>
                    </div>
                    <div className="p-3 bg-success/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-success">{stressReport.passedTests}</p>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </div>
                    <div className="p-3 bg-destructive/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-destructive">{stressReport.failedTests}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold">{(stressReport.totalDuration / 1000).toFixed(1)}s</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </div>

                  {/* System Stable Badge */}
                  <div className="flex items-center justify-center">
                    <Badge 
                      variant={stressReport.systemStable ? 'default' : 'destructive'}
                      className="text-lg px-4 py-2"
                    >
                      {stressReport.systemStable ? (
                        <>
                          <ShieldCheck className="w-5 h-5 mr-2" />
                          System Stable
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-5 h-5 mr-2" />
                          System Unstable
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Individual Results */}
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {stressReport.results.map((result, idx) => (
                        <Card key={idx} className={result.passed ? 'border-success/30' : 'border-destructive/30'}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {result.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                                <span className="font-medium">{result.testName}</span>
                                <Badge variant="outline" className="text-[10px]">{result.category}</Badge>
                              </div>
                              <Badge variant={result.passed ? 'default' : 'destructive'}>
                                {result.passed ? 'PASS' : 'FAIL'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                              <div>
                                <span className="block text-foreground">{result.iterations}</span>
                                <span>Iterations</span>
                              </div>
                              <div>
                                <span className="block text-foreground">{result.averageLatency.toFixed(1)}ms</span>
                                <span>Avg Latency</span>
                              </div>
                              <div>
                                <span className="block text-foreground">{result.maxLatency.toFixed(1)}ms</span>
                                <span>Max Latency</span>
                              </div>
                              <div>
                                <span className="block text-foreground">{(result.duration / 1000).toFixed(2)}s</span>
                                <span>Duration</span>
                              </div>
                            </div>
                            {result.errors.length > 0 && (
                              <div className="mt-2 text-xs text-destructive">
                                Errors: {result.errors.slice(0, 2).join(', ')}
                                {result.errors.length > 2 && ` (+${result.errors.length - 2} more)`}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Recommendations */}
                  {stressReport.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm space-y-1">
                          {stressReport.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
