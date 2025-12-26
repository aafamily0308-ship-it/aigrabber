// Provider Health Monitor - Real-time monitoring with auto-failover
// Phase 2: Intelligent Core

import { AIProvider, testProvider, isLocalProvider } from './localAIClient';
import { CloudApiKeys } from '@/stores/settingsStore';

export interface ProviderHealth {
  provider: AIProvider;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  latency: number | null;        // ms
  lastCheck: Date | null;
  lastSuccess: Date | null;
  failureCount: number;
  successRate: number;           // 0-100%
  message: string;
}

export interface HealthMonitorConfig {
  checkIntervalMs: number;       // How often to check
  timeoutMs: number;             // Request timeout
  failureThreshold: number;      // Failures before marking offline
  recoveryThreshold: number;     // Successes before marking online
  historySize: number;           // Number of checks to keep for rate
}

export const defaultHealthConfig: HealthMonitorConfig = {
  checkIntervalMs: 30000,        // 30 seconds
  timeoutMs: 5000,               // 5 seconds
  failureThreshold: 3,
  recoveryThreshold: 2,
  historySize: 10,
};

// Store health history per provider
const healthHistory: Map<AIProvider, boolean[]> = new Map();
const healthState: Map<AIProvider, ProviderHealth> = new Map();

// Initialize health state for a provider
function initProvider(provider: AIProvider): ProviderHealth {
  if (!healthState.has(provider)) {
    healthState.set(provider, {
      provider,
      status: 'unknown',
      latency: null,
      lastCheck: null,
      lastSuccess: null,
      failureCount: 0,
      successRate: 0,
      message: 'Not checked yet',
    });
    healthHistory.set(provider, []);
  }
  return healthState.get(provider)!;
}

// Update provider health
function updateHealth(
  provider: AIProvider,
  success: boolean,
  latency: number | null,
  message: string,
  config: HealthMonitorConfig = defaultHealthConfig
): ProviderHealth {
  const health = initProvider(provider);
  const history = healthHistory.get(provider) || [];

  // Update history
  history.push(success);
  if (history.length > config.historySize) {
    history.shift();
  }
  healthHistory.set(provider, history);

  // Calculate success rate
  const successCount = history.filter(Boolean).length;
  health.successRate = history.length > 0 
    ? Math.round((successCount / history.length) * 100) 
    : 0;

  // Update state
  health.lastCheck = new Date();
  health.latency = latency;
  health.message = message;

  if (success) {
    health.lastSuccess = new Date();
    health.failureCount = 0;
    
    // Check if we should mark as online
    const recentSuccesses = history.slice(-config.recoveryThreshold).filter(Boolean).length;
    if (recentSuccesses >= config.recoveryThreshold || health.status === 'unknown') {
      health.status = 'online';
    } else if (health.status === 'offline') {
      health.status = 'degraded';
    }
  } else {
    health.failureCount++;
    
    // Check if we should mark as offline
    if (health.failureCount >= config.failureThreshold) {
      health.status = 'offline';
    } else if (health.status === 'online') {
      health.status = 'degraded';
    }
  }

  healthState.set(provider, health);
  return health;
}

// Check single provider health
export async function checkProviderHealth(
  provider: AIProvider,
  apiKey?: string,
  config: HealthMonitorConfig = defaultHealthConfig
): Promise<ProviderHealth> {
  const startTime = Date.now();
  
  try {
    const result = await testProvider(provider, apiKey);
    const latency = Date.now() - startTime;
    
    return updateHealth(provider, result.success, latency, result.message, config);
  } catch (error) {
    const latency = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Check failed';
    
    return updateHealth(provider, false, latency, message, config);
  }
}

// Check all providers
export async function checkAllProviders(
  cloudApiKeys: CloudApiKeys = {},
  config: HealthMonitorConfig = defaultHealthConfig
): Promise<Map<AIProvider, ProviderHealth>> {
  const providers: { provider: AIProvider; apiKey?: string }[] = [
    { provider: 'local-ollama' },
    { provider: 'local-lmstudio' },
    { provider: 'cloud-openai', apiKey: cloudApiKeys.openai },
    { provider: 'cloud-google', apiKey: cloudApiKeys.google },
    { provider: 'cloud-anthropic', apiKey: cloudApiKeys.anthropic },
  ];

  const checks = providers.map(({ provider, apiKey }) =>
    checkProviderHealth(provider, apiKey, config)
  );

  await Promise.all(checks);
  return healthState;
}

// Get current health for a provider
export function getProviderHealth(provider: AIProvider): ProviderHealth {
  return initProvider(provider);
}

// Get all provider health statuses
export function getAllProviderHealth(): Map<AIProvider, ProviderHealth> {
  return healthState;
}

// Get online providers
export function getOnlineProviders(): AIProvider[] {
  return Array.from(healthState.entries())
    .filter(([_, health]) => health.status === 'online' || health.status === 'degraded')
    .map(([provider]) => provider);
}

// Get best available provider
export function getBestProvider(preferLocal: boolean = true): AIProvider | null {
  const online = getOnlineProviders();
  
  if (online.length === 0) return null;
  
  // Sort by latency and preference
  const sorted = online
    .map(provider => ({
      provider,
      health: healthState.get(provider)!,
      isLocal: isLocalProvider(provider),
    }))
    .sort((a, b) => {
      // Prefer local if configured
      if (preferLocal) {
        if (a.isLocal && !b.isLocal) return -1;
        if (!a.isLocal && b.isLocal) return 1;
      }
      
      // Then by status (online > degraded)
      if (a.health.status === 'online' && b.health.status === 'degraded') return -1;
      if (a.health.status === 'degraded' && b.health.status === 'online') return 1;
      
      // Then by latency
      const aLatency = a.health.latency ?? Infinity;
      const bLatency = b.health.latency ?? Infinity;
      return aLatency - bLatency;
    });

  return sorted[0]?.provider || null;
}

// Health check interval management
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthMonitor(
  cloudApiKeys: CloudApiKeys = {},
  config: HealthMonitorConfig = defaultHealthConfig,
  onUpdate?: (health: Map<AIProvider, ProviderHealth>) => void
): void {
  stopHealthMonitor();
  
  // Initial check
  checkAllProviders(cloudApiKeys, config).then(health => {
    onUpdate?.(health);
  });
  
  // Periodic checks
  healthCheckInterval = setInterval(async () => {
    const health = await checkAllProviders(cloudApiKeys, config);
    onUpdate?.(health);
  }, config.checkIntervalMs);
}

export function stopHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// Get health summary for UI
export function getHealthSummary(): {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  unknown: number;
} {
  const statuses = Array.from(healthState.values()).map(h => h.status);
  
  return {
    total: statuses.length,
    online: statuses.filter(s => s === 'online').length,
    offline: statuses.filter(s => s === 'offline').length,
    degraded: statuses.filter(s => s === 'degraded').length,
    unknown: statuses.filter(s => s === 'unknown').length,
  };
}
