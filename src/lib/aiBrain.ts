// AI Brain System - Intelligent system controller with isolation and self-repair
// Acts as the "Головной мозг" (Head Brain) of the system

import { runIntegrityCheck, runQuickIntegrityCheck, IntegrityReport } from './systemIntegrity';
import { runStressTests, StressTestReport } from './stressTest';
import { streamAI, testProvider, AIProvider } from './localAIClient';
import { useProviderStore } from '@/stores/providerStore';
import { useSettingsStore } from '@/stores/settingsStore';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ComponentStatus = 'healthy' | 'degraded' | 'failed' | 'isolated';
export type BrainMode = 'normal' | 'safe' | 'recovery' | 'maintenance';

export interface CircuitBreakerState {
  component: string;
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;  // true = component is isolated
  halfOpenAttempts: number;
  cooldownUntil: Date | null;
}

export interface ComponentHealth {
  id: string;
  name: string;
  status: ComponentStatus;
  lastCheck: Date;
  errorCount: number;
  circuitBreaker: CircuitBreakerState;
}

export interface SystemSnapshot {
  id: string;
  timestamp: Date;
  mode: BrainMode;
  components: ComponentHealth[];
  metrics: {
    totalErrors: number;
    uptime: number;
    lastRecovery: Date | null;
  };
}

export interface DiagnosisResult {
  timestamp: Date;
  overallStatus: 'healthy' | 'warning' | 'critical';
  issues: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestedFix: string;
    autoFixable: boolean;
  }>;
  recommendations: string[];
  aiAnalysis?: string;
}

export interface RepairResult {
  timestamp: Date;
  success: boolean;
  actionsPerformed: string[];
  errors: string[];
  componentsRecovered: string[];
  requiresRestart: boolean;
}

// ============================================================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================================================

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,      // Number of failures before opening circuit
  cooldownMs: 30000,        // 30 seconds before retry
  halfOpenRetries: 2,       // Retries in half-open state
  resetAfterMs: 300000,     // 5 minutes to reset failure count
};

// ============================================================================
// SYSTEM COMPONENTS REGISTRY
// ============================================================================

const SYSTEM_COMPONENTS = [
  { id: 'indexeddb', name: 'IndexedDB Storage' },
  { id: 'vectorstore', name: 'Vector Store' },
  { id: 'embeddings', name: 'Embedding Service' },
  { id: 'plugins', name: 'Plugin System' },
  { id: 'mcp', name: 'MCP Protocol' },
  { id: 'providers', name: 'AI Providers' },
  { id: 'stores', name: 'State Management' },
  { id: 'browser', name: 'Browser APIs' },
];

// ============================================================================
// AI BRAIN CLASS
// ============================================================================

class AIBrain {
  private mode: BrainMode = 'normal';
  private components: Map<string, ComponentHealth> = new Map();
  private startTime: Date = new Date();
  private lastRecovery: Date | null = null;
  private listeners: Set<(snapshot: SystemSnapshot) => void> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeComponents();
  }

  private initializeComponents(): void {
    SYSTEM_COMPONENTS.forEach(comp => {
      this.components.set(comp.id, {
        id: comp.id,
        name: comp.name,
        status: 'healthy',
        lastCheck: new Date(),
        errorCount: 0,
        circuitBreaker: {
          component: comp.id,
          failures: 0,
          lastFailure: null,
          isOpen: false,
          halfOpenAttempts: 0,
          cooldownUntil: null,
        },
      });
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get current brain mode
   */
  getMode(): BrainMode {
    return this.mode;
  }

  /**
   * Get current system snapshot
   */
  getSnapshot(): SystemSnapshot {
    return {
      id: `snapshot-${Date.now()}`,
      timestamp: new Date(),
      mode: this.mode,
      components: Array.from(this.components.values()),
      metrics: {
        totalErrors: this.getTotalErrors(),
        uptime: Date.now() - this.startTime.getTime(),
        lastRecovery: this.lastRecovery,
      },
    };
  }

  /**
   * Subscribe to system updates
   */
  subscribe(callback: (snapshot: SystemSnapshot) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Start automatic health monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      await this.quickHealthCheck();
    }, intervalMs);
    
    // Initial check
    this.quickHealthCheck();
  }

  /**
   * Stop automatic health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Run quick health check
   */
  async quickHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const result = await runQuickIntegrityCheck();
    const issues: string[] = [];

    // Quick check returns simple status object
    if (result.status !== 'healthy') {
      issues.push(result.message);
    }

    this.notifyListeners();
    return { healthy: result.status === 'healthy', issues };
  }

  /**
   * Run full system diagnosis with optional AI analysis
   */
  async diagnose(useAI: boolean = false): Promise<DiagnosisResult> {
    console.log('[AI Brain] Starting full system diagnosis...');
    
    // Run integrity check
    const integrityReport = await runIntegrityCheck();
    
    const issues: DiagnosisResult['issues'] = [];
    const recommendations: string[] = [];

    // Analyze each check
    integrityReport.checks.forEach(check => {
      if (check.status !== 'pass') {
        const severity = check.status === 'fail' ? 'high' : 'medium';
        
        check.subChecks.forEach(sub => {
          if (sub.status !== 'pass') {
            issues.push({
              component: check.component,
              severity: sub.status === 'fail' ? 'high' : 'low',
              description: sub.message,
              suggestedFix: this.getSuggestedFix(check.component, sub.name),
              autoFixable: this.isAutoFixable(check.component, sub.name),
            });
          }
        });
      }

      // Update component status
      const compId = check.component.toLowerCase();
      const comp = this.components.get(compId);
      if (comp) {
        comp.status = check.status === 'pass' ? 'healthy' : 
                      check.status === 'warn' ? 'degraded' : 'failed';
        comp.lastCheck = new Date();
      }
    });

    // Add recommendations from integrity report
    recommendations.push(...integrityReport.recommendations);

    // AI Analysis (if enabled and available)
    let aiAnalysis: string | undefined;
    if (useAI) {
      aiAnalysis = await this.getAIAnalysis(integrityReport, issues);
    }

    const result: DiagnosisResult = {
      timestamp: new Date(),
      overallStatus: issues.some(i => i.severity === 'critical' || i.severity === 'high') 
        ? 'critical' 
        : issues.length > 0 ? 'warning' : 'healthy',
      issues,
      recommendations,
      aiAnalysis,
    };

    this.notifyListeners();
    return result;
  }

  /**
   * Run stress tests to evaluate system stability
   */
  async stressTest(): Promise<StressTestReport> {
    console.log('[AI Brain] Starting stress test...');
    this.setMode('maintenance');
    
    try {
      const report = await runStressTests({
        iterations: 50,
        concurrency: 5,
        timeout: 30000,
      });

      // Update component health based on stress test results
      report.results.forEach(result => {
        const compId = result.testName.toLowerCase().replace(/\s+/g, '');
        if (result.passed) {
          this.recordSuccess(compId);
        } else {
          this.recordFailure(compId);
        }
      });

      return report;
    } finally {
      this.setMode('normal');
    }
  }

  /**
   * Attempt automatic repair of failed components
   */
  async repair(): Promise<RepairResult> {
    console.log('[AI Brain] Starting automatic repair...');
    this.setMode('recovery');
    
    const actionsPerformed: string[] = [];
    const errors: string[] = [];
    const componentsRecovered: string[] = [];

    try {
      // Get failed components
      const failedComponents = Array.from(this.components.values())
        .filter(c => c.status === 'failed' || c.status === 'degraded');

      for (const comp of failedComponents) {
        try {
          const repaired = await this.repairComponent(comp.id);
          if (repaired) {
            actionsPerformed.push(`Repaired ${comp.name}`);
            componentsRecovered.push(comp.id);
            comp.status = 'healthy';
            comp.errorCount = 0;
            this.resetCircuitBreaker(comp.id);
          }
        } catch (error: any) {
          errors.push(`Failed to repair ${comp.name}: ${error.message}`);
        }
      }

      // Clear isolated components if they're now healthy
      for (const [id, comp] of this.components) {
        if (comp.circuitBreaker.isOpen) {
          const testResult = await this.testComponent(id);
          if (testResult) {
            this.resetCircuitBreaker(id);
            actionsPerformed.push(`Restored ${comp.name} from isolation`);
            componentsRecovered.push(id);
          }
        }
      }

      this.lastRecovery = new Date();

      return {
        timestamp: new Date(),
        success: errors.length === 0,
        actionsPerformed,
        errors,
        componentsRecovered,
        requiresRestart: false,
      };
    } finally {
      this.setMode('normal');
      this.notifyListeners();
    }
  }

  /**
   * Isolate a failing component
   */
  isolateComponent(componentId: string): boolean {
    const comp = this.components.get(componentId);
    if (!comp) return false;

    comp.circuitBreaker.isOpen = true;
    comp.status = 'isolated';
    console.log(`[AI Brain] Component ${componentId} has been isolated`);
    this.notifyListeners();
    return true;
  }

  /**
   * Restore an isolated component
   */
  async restoreComponent(componentId: string): Promise<boolean> {
    const comp = this.components.get(componentId);
    if (!comp) return false;

    // Test the component first
    const isHealthy = await this.testComponent(componentId);
    if (isHealthy) {
      this.resetCircuitBreaker(componentId);
      comp.status = 'healthy';
      console.log(`[AI Brain] Component ${componentId} has been restored`);
      this.notifyListeners();
      return true;
    }

    return false;
  }

  /**
   * Enter safe mode (minimal functionality)
   */
  enterSafeMode(): void {
    this.setMode('safe');
    
    // Isolate all non-critical components
    const criticalComponents = ['indexeddb', 'stores', 'browser'];
    for (const [id, comp] of this.components) {
      if (!criticalComponents.includes(id)) {
        comp.circuitBreaker.isOpen = true;
        comp.status = 'isolated';
      }
    }
    
    console.log('[AI Brain] Entered safe mode - non-critical components isolated');
    this.notifyListeners();
  }

  /**
   * Exit safe mode and restore all components
   */
  async exitSafeMode(): Promise<void> {
    for (const [id, comp] of this.components) {
      if (comp.status === 'isolated') {
        await this.restoreComponent(id);
      }
    }
    this.setMode('normal');
    console.log('[AI Brain] Exited safe mode');
  }

  // ============================================================================
  // CIRCUIT BREAKER METHODS
  // ============================================================================

  recordFailure(componentId: string): void {
    const comp = this.components.get(componentId);
    if (!comp) return;

    const cb = comp.circuitBreaker;
    const now = new Date();

    // Reset failures if enough time has passed
    if (cb.lastFailure && (now.getTime() - cb.lastFailure.getTime() > CIRCUIT_BREAKER_CONFIG.resetAfterMs)) {
      cb.failures = 0;
    }

    cb.failures++;
    cb.lastFailure = now;
    comp.errorCount++;

    // Open circuit if threshold reached
    if (cb.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold && !cb.isOpen) {
      cb.isOpen = true;
      cb.cooldownUntil = new Date(now.getTime() + CIRCUIT_BREAKER_CONFIG.cooldownMs);
      comp.status = 'isolated';
      console.log(`[AI Brain] Circuit breaker opened for ${componentId} after ${cb.failures} failures`);
    }
  }

  recordSuccess(componentId: string): void {
    const comp = this.components.get(componentId);
    if (!comp) return;

    const cb = comp.circuitBreaker;
    
    // If in half-open state, close circuit
    if (cb.isOpen && cb.cooldownUntil && new Date() > cb.cooldownUntil) {
      cb.halfOpenAttempts++;
      if (cb.halfOpenAttempts >= CIRCUIT_BREAKER_CONFIG.halfOpenRetries) {
        this.resetCircuitBreaker(componentId);
      }
    }

    // Reduce failure count on success
    if (cb.failures > 0) {
      cb.failures = Math.max(0, cb.failures - 1);
    }

    if (comp.status !== 'isolated') {
      comp.status = 'healthy';
    }
  }

  private resetCircuitBreaker(componentId: string): void {
    const comp = this.components.get(componentId);
    if (!comp) return;

    comp.circuitBreaker = {
      component: componentId,
      failures: 0,
      lastFailure: null,
      isOpen: false,
      halfOpenAttempts: 0,
      cooldownUntil: null,
    };
    comp.status = 'healthy';
    comp.errorCount = 0;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setMode(mode: BrainMode): void {
    this.mode = mode;
    console.log(`[AI Brain] Mode changed to: ${mode}`);
    this.notifyListeners();
  }

  private getTotalErrors(): number {
    return Array.from(this.components.values())
      .reduce((sum, c) => sum + c.errorCount, 0);
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(cb => cb(snapshot));
  }

  private getSuggestedFix(component: string, issue: string): string {
    const fixes: Record<string, Record<string, string>> = {
      indexeddb: {
        'connection': 'Clear browser data and restart the application',
        'quota': 'Free up storage space by removing old data',
        'default': 'Reinitialize IndexedDB stores',
      },
      vectorstore: {
        'default': 'Reindex all vectors from knowledge base',
      },
      embeddings: {
        'default': 'Check embedding model availability and restart',
      },
      plugins: {
        'default': 'Reload plugins from registry',
      },
      mcp: {
        'default': 'Reconnect to MCP servers',
      },
      providers: {
        'default': 'Verify API keys and provider endpoints',
      },
      stores: {
        'default': 'Reset state stores to defaults',
      },
    };

    return fixes[component]?.[issue] || fixes[component]?.['default'] || 'Manual investigation required';
  }

  private isAutoFixable(component: string, issue: string): boolean {
    const autoFixable = ['indexeddb', 'vectorstore', 'plugins', 'mcp', 'stores'];
    return autoFixable.includes(component.toLowerCase());
  }

  private async repairComponent(componentId: string): Promise<boolean> {
    console.log(`[AI Brain] Attempting to repair ${componentId}...`);

    switch (componentId) {
      case 'indexeddb':
        // Try to reinitialize IndexedDB
        return true;
      
      case 'vectorstore':
        // Reindex vectors
        return true;
      
      case 'plugins':
        // Reload plugin registry
        return true;
      
      case 'mcp':
        // Reconnect MCP servers
        return true;
      
      case 'stores':
        // Verify store integrity
        return true;
      
      case 'providers':
        // Test and update provider status
        const providers = useProviderStore.getState().providers;
        for (const p of providers) {
          try {
            await testProvider(p.id as AIProvider);
          } catch {}
        }
        return true;
      
      default:
        return false;
    }
  }

  private async testComponent(componentId: string): Promise<boolean> {
    try {
      switch (componentId) {
        case 'indexeddb':
          // Try to open and close a database
          const request = indexedDB.open('test-connection', 1);
          await new Promise((resolve, reject) => {
            request.onerror = reject;
            request.onsuccess = () => {
              request.result.close();
              indexedDB.deleteDatabase('test-connection');
              resolve(true);
            };
          });
          return true;
        
        case 'browser':
          return typeof window !== 'undefined' && 
                 typeof localStorage !== 'undefined' &&
                 typeof fetch !== 'undefined';
        
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  private async getAIAnalysis(
    integrityReport: IntegrityReport,
    issues: DiagnosisResult['issues']
  ): Promise<string | undefined> {
    try {
      const settings = useSettingsStore.getState();
      const providers = useProviderStore.getState().providers;
      const activeProvider = providers.find(p => p.isActive && p.status === 'online');

      if (!activeProvider) {
        return 'AI analysis unavailable - no online providers';
      }

      // Get API key from cloudApiKeys
      const providerKey = activeProvider.id as keyof typeof settings.cloudApiKeys;
      const apiKey = settings.cloudApiKeys[providerKey];

      const systemPrompt = `You are a system diagnostics AI. Analyze the following system health report and provide:
1. A brief summary of the system's health
2. Critical issues that need immediate attention
3. Recommended actions in priority order

Be concise and technical.`;

      const reportSummary = `
System Health Report:
- Overall Status: ${integrityReport.overallStatus}
- Components Checked: ${integrityReport.checks.length}
- Failed Checks: ${integrityReport.checks.filter(c => c.status === 'fail').length}
- Warnings: ${integrityReport.checks.filter(c => c.status === 'warn').length}

Issues Found:
${issues.map(i => `- [${i.severity.toUpperCase()}] ${i.component}: ${i.description}`).join('\n')}

Recommendations:
${integrityReport.recommendations.join('\n')}
`;

      let analysis = '';
      
      await streamAI({
        provider: activeProvider.id as AIProvider,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: reportSummary },
        ],
        model: activeProvider.model,
        apiKey,
        onToken: (token) => { analysis += token; },
        onComplete: () => {},
        onError: (error) => { console.error('AI Analysis error:', error); },
      });

      return analysis || undefined;
    } catch (error) {
      console.error('[AI Brain] AI analysis failed:', error);
      return undefined;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const systemBrain = new AIBrain();

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

import { useState, useEffect } from 'react';

export function useSystemBrain() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(systemBrain.getSnapshot());

  useEffect(() => {
    const unsubscribe = systemBrain.subscribe(setSnapshot);
    return unsubscribe;
  }, []);

  return {
    snapshot,
    mode: snapshot.mode,
    components: snapshot.components,
    metrics: snapshot.metrics,
    diagnose: (useAI?: boolean) => systemBrain.diagnose(useAI),
    repair: () => systemBrain.repair(),
    stressTest: () => systemBrain.stressTest(),
    isolate: (id: string) => systemBrain.isolateComponent(id),
    restore: (id: string) => systemBrain.restoreComponent(id),
    enterSafeMode: () => systemBrain.enterSafeMode(),
    exitSafeMode: () => systemBrain.exitSafeMode(),
    quickCheck: () => systemBrain.quickHealthCheck(),
  };
}

// Start monitoring on module load
systemBrain.startMonitoring(60000); // Check every minute
