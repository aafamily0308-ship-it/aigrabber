// Provider Health Monitor - Real-time monitoring with auto-failover
// Phase 2: Intelligent Core

import { useProviderStore, Provider } from '@/stores/providerStore';
import { providerRegistry } from '@/lib/providers';

export type ProviderId = string;

export interface ProviderHealth {
  providerId: ProviderId;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  latency: number | null;
  lastCheck: Date | null;
  lastSuccess: Date | null;
  failureCount: number;
  successRate: number;
  message: string;
}

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  timeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  historySize: number;
}

export const defaultHealthConfig: HealthMonitorConfig = {
  checkIntervalMs: 30000,
  timeoutMs: 5000,
  failureThreshold: 3,
  recoveryThreshold: 2,
  historySize: 10,
};

// Store health history per provider
const healthHistory: Map<ProviderId, boolean[]> = new Map();
const healthState: Map<ProviderId, ProviderHealth> = new Map();

function initProvider(providerId: ProviderId): ProviderHealth {
  if (!healthState.has(providerId)) {
    healthState.set(providerId, {
      providerId,
      status: 'unknown',
      latency: null,
      lastCheck: null,
      lastSuccess: null,
      failureCount: 0,
      successRate: 0,
      message: 'Not checked yet',
    });
    healthHistory.set(providerId, []);
  }
  return healthState.get(providerId)!;
}

function updateHealth(
  providerId: ProviderId,
  success: boolean,
  latency: number | null,
  message: string,
  config: HealthMonitorConfig = defaultHealthConfig
): ProviderHealth {
  const health = initProvider(providerId);
  const history = healthHistory.get(providerId) || [];

  history.push(success);
  if (history.length > config.historySize) {
    history.shift();
  }
  healthHistory.set(providerId, history);

  const successCount = history.filter(Boolean).length;
  health.successRate = history.length > 0 
    ? Math.round((successCount / history.length) * 100) 
    : 0;

  health.lastCheck = new Date();
  health.latency = latency;
  health.message = message;

  if (success) {
    health.lastSuccess = new Date();
    health.failureCount = 0;
    
    const recentSuccesses = history.slice(-config.recoveryThreshold).filter(Boolean).length;
    if (recentSuccesses >= config.recoveryThreshold || health.status === 'unknown') {
      health.status = 'online';
    } else if (health.status === 'offline') {
      health.status = 'degraded';
    }
  } else {
    health.failureCount++;
    
    if (health.failureCount >= config.failureThreshold) {
      health.status = 'offline';
    } else if (health.status === 'online') {
      health.status = 'degraded';
    }
  }

  healthState.set(providerId, health);
  return health;
}

export async function checkProviderHealth(
  providerId: ProviderId,
  endpoint?: string,
  apiKey?: string,
  config: HealthMonitorConfig = defaultHealthConfig
): Promise<ProviderHealth> {
  const startTime = Date.now();
  
  try {
    const plugin = providerRegistry.get(providerId);
    if (!plugin) {
      return updateHealth(providerId, false, null, 'Provider plugin not found', config);
    }
    
    const testEndpoint = endpoint || plugin.defaultEndpoint;
    const result = await plugin.test(testEndpoint, apiKey);
    const latency = Date.now() - startTime;
    
    return updateHealth(
      providerId, 
      result.online, 
      latency, 
      result.error || (result.online ? 'Connected' : 'Connection failed'),
      config
    );
  } catch (error) {
    const latency = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Check failed';
    
    return updateHealth(providerId, false, latency, message, config);
  }
}

export async function checkAllProviders(
  config: HealthMonitorConfig = defaultHealthConfig
): Promise<Map<ProviderId, ProviderHealth>> {
  const providers = useProviderStore.getState().providers;
  
  const checks = providers.map(provider =>
    checkProviderHealth(
      provider.id, 
      provider.endpoint, 
      provider.apiKey,
      config
    )
  );

  await Promise.all(checks);
  
  // Update store with health statuses
  const store = useProviderStore.getState();
  healthState.forEach((health, id) => {
    const storeStatus = health.status === 'unknown' ? 'checking' : 
                        health.status === 'degraded' ? 'online' : health.status;
    store.updateProviderStatus(id, storeStatus, health.latency || undefined);
  });
  
  return healthState;
}

export function getProviderHealth(providerId: ProviderId): ProviderHealth {
  return initProvider(providerId);
}

export function getAllProviderHealth(): Map<ProviderId, ProviderHealth> {
  return healthState;
}

export function getOnlineProviders(): ProviderId[] {
  const storeProviders = useProviderStore.getState().providers;
  return storeProviders
    .filter(p => p.status === 'online' && p.isActive)
    .map(p => p.id);
}

export function getBestProvider(preferLocal: boolean = true): ProviderId | null {
  const providers = useProviderStore.getState().providers
    .filter(p => p.status === 'online' && p.isActive);
  
  if (providers.length === 0) return null;
  
  const sorted = providers.sort((a, b) => {
    if (preferLocal) {
      if (a.type === 'local' && b.type !== 'local') return -1;
      if (a.type !== 'local' && b.type === 'local') return 1;
    }
    
    const aLatency = a.latency ?? Infinity;
    const bLatency = b.latency ?? Infinity;
    return aLatency - bLatency;
  });

  return sorted[0]?.id || null;
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthMonitor(
  config: HealthMonitorConfig = defaultHealthConfig,
  onUpdate?: (health: Map<ProviderId, ProviderHealth>) => void
): void {
  stopHealthMonitor();
  
  checkAllProviders(config).then(health => {
    onUpdate?.(health);
  });
  
  healthCheckInterval = setInterval(async () => {
    const health = await checkAllProviders(config);
    onUpdate?.(health);
  }, config.checkIntervalMs);
}

export function stopHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

export function getHealthSummary(): {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  unknown: number;
} {
  const providers = useProviderStore.getState().providers;
  
  return {
    total: providers.length,
    online: providers.filter(p => p.status === 'online').length,
    offline: providers.filter(p => p.status === 'offline').length,
    degraded: 0,
    unknown: providers.filter(p => p.status === 'checking').length,
  };
}

// Helper for backward compatibility
export function isLocalProvider(providerId: ProviderId): boolean {
  const provider = useProviderStore.getState().providers.find(p => p.id === providerId);
  return provider?.type === 'local';
}
