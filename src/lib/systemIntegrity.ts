// System Integrity Checker - Comprehensive verification of all system components
// Runs after updates to ensure system stability

import { getAllItems, getStorageEstimate } from './indexedDBStore';
import { getVectorStoreStats, searchSimilar } from './vectorStore';
import { pluginRegistry, executeTool } from './pluginSystem';
import { mcpClient } from './mcpClient';
import { testProvider, AIProvider } from './localAIClient';
import { generateEmbedding } from './embeddingService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';

export interface IntegrityCheck {
  component: string;
  subChecks: SubCheck[];
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  details: string;
}

export interface SubCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  data?: unknown;
}

export interface IntegrityReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  checks: IntegrityCheck[];
  totalDuration: number;
  recommendations: string[];
}

// Deep check of IndexedDB stores
async function checkIndexedDBIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  // Check each store
  const stores = ['documents', 'messages', 'auditLogs', 'backups', 'vectors'];
  
  for (const storeName of stores) {
    try {
      const items = await getAllItems(storeName as any);
      subChecks.push({
        name: `Store: ${storeName}`,
        status: 'pass',
        message: `${items.length} items accessible`,
        data: { count: items.length },
      });
    } catch (error: any) {
      subChecks.push({
        name: `Store: ${storeName}`,
        status: 'fail',
        message: `Error: ${error.message}`,
      });
    }
  }
  
  // Check storage quota
  const storage = await getStorageEstimate();
  const usagePercent = storage.quota > 0 ? (storage.used / storage.quota) * 100 : 0;
  subChecks.push({
    name: 'Storage Quota',
    status: usagePercent > 90 ? 'fail' : usagePercent > 70 ? 'warn' : 'pass',
    message: `${usagePercent.toFixed(1)}% used (${(storage.used / 1024 / 1024).toFixed(2)} MB)`,
    data: storage,
  });
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'IndexedDB Storage',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: `Checked ${stores.length} stores and storage quota`,
  };
}

// Check vector store and embedding system
async function checkEmbeddingIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  // Check vector store stats
  try {
    const stats = await getVectorStoreStats();
    subChecks.push({
      name: 'Vector Store Stats',
      status: 'pass',
      message: `${stats.totalVectors} vectors, ${stats.byType.document} from documents`,
      data: stats,
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Vector Store Stats',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  // Test embedding creation
  try {
    const testText = 'Test embedding generation for integrity check';
    const embedding = generateEmbedding(testText);
    subChecks.push({
      name: 'Embedding Generation',
      status: embedding.vector.length > 0 ? 'pass' : 'fail',
      message: `Generated ${embedding.dimensions}-dimensional vector`,
      data: { dimensions: embedding.dimensions },
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Embedding Generation',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  // Test semantic search
  try {
    const testEmbedding = generateEmbedding('test query');
    const results = await searchSimilar(testEmbedding.vector, { limit: 1 });
    subChecks.push({
      name: 'Semantic Search',
      status: 'pass',
      message: `Search functional, found ${results.length} results`,
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Semantic Search',
      status: 'warn',
      message: `Search may be degraded: ${error.message}`,
    });
  }
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'Embedding & RAG System',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: 'Checked vector store, embedding generation, and semantic search',
  };
}

// Check plugin system
async function checkPluginIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  // Check plugin registry
  const allPlugins = pluginRegistry.getAllPlugins();
  const enabledPlugins = pluginRegistry.getEnabledPlugins();
  
  subChecks.push({
    name: 'Plugin Registry',
    status: allPlugins.length > 0 ? 'pass' : 'warn',
    message: `${enabledPlugins.length}/${allPlugins.length} plugins active`,
    data: { total: allPlugins.length, enabled: enabledPlugins.length },
  });
  
  // Test each enabled plugin's tools
  for (const plugin of enabledPlugins) {
    if (plugin.tools && plugin.tools.length > 0) {
      const tool = plugin.tools[0];
      try {
        // Try to execute with minimal args if possible
        const context = {
          conversation: { id: 'test', messages: [] },
          tools: {
            toast: () => {},
            log: () => {},
          },
        };
        
        // Only test safe tools
        if (['get_current_time', 'get_system_info'].includes(tool.name)) {
          const result = await executeTool(tool.name, {}, context);
          subChecks.push({
            name: `Plugin: ${plugin.metadata.name}`,
            status: result.success ? 'pass' : 'warn',
            message: result.success ? 'Tool execution verified' : `Warning: ${result.error}`,
          });
        } else {
          subChecks.push({
            name: `Plugin: ${plugin.metadata.name}`,
            status: 'pass',
            message: 'Plugin registered and enabled',
          });
        }
      } catch (error: any) {
        subChecks.push({
          name: `Plugin: ${plugin.metadata.name}`,
          status: 'warn',
          message: `Tool test failed: ${error.message}`,
        });
      }
    }
  }
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'Plugin System',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: `Checked ${allPlugins.length} plugins`,
  };
}

// Check MCP system
async function checkMCPIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  const servers = mcpClient.getServers();
  const connected = mcpClient.getConnectedServers();
  
  subChecks.push({
    name: 'MCP Server Registry',
    status: 'pass',
    message: `${servers.length} servers registered, ${connected.length} connected`,
    data: { total: servers.length, connected: connected.length },
  });
  
  // Check each server
  for (const server of servers) {
    const isConnected = connected.some(s => s.id === server.id);
    subChecks.push({
      name: `Server: ${server.name}`,
      status: isConnected ? 'pass' : 'warn',
      message: isConnected ? 'Connected and ready' : 'Not connected',
    });
  }
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'MCP Protocol',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: `Checked ${servers.length} MCP servers`,
  };
}

// Check AI providers
async function checkProviderIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  const settingsStore = useSettingsStore.getState();
  
  const localProviders: AIProvider[] = ['local-ollama', 'local-lmstudio'];
  const cloudProviders: { provider: AIProvider; keyName: keyof typeof settingsStore.cloudApiKeys }[] = [
    { provider: 'cloud-openai', keyName: 'openai' },
    { provider: 'cloud-google', keyName: 'google' },
    { provider: 'cloud-anthropic', keyName: 'anthropic' },
  ];
  
  // Check local providers
  for (const provider of localProviders) {
    try {
      const result = await testProvider(provider);
      subChecks.push({
        name: `Provider: ${provider}`,
        status: result.success ? 'pass' : 'warn',
        message: result.message,
      });
    } catch (error: any) {
      subChecks.push({
        name: `Provider: ${provider}`,
        status: 'warn',
        message: `Not available: ${error.message}`,
      });
    }
  }
  
  // Check cloud providers (only if API key exists)
  for (const { provider, keyName } of cloudProviders) {
    const apiKey = settingsStore.cloudApiKeys[keyName];
    if (apiKey) {
      try {
        const result = await testProvider(provider, apiKey);
        subChecks.push({
          name: `Provider: ${provider}`,
          status: result.success ? 'pass' : 'warn',
          message: result.message,
        });
      } catch (error: any) {
        subChecks.push({
          name: `Provider: ${provider}`,
          status: 'warn',
          message: `Error: ${error.message}`,
        });
      }
    } else {
      subChecks.push({
        name: `Provider: ${provider}`,
        status: 'pass',
        message: 'No API key configured (optional)',
      });
    }
  }
  
  const onlineCount = subChecks.filter(c => c.status === 'pass' && c.message.includes('running')).length;
  const hasFailures = subChecks.some(c => c.status === 'fail');
  
  return {
    component: 'AI Providers',
    subChecks,
    status: onlineCount === 0 && hasFailures ? 'fail' : onlineCount === 0 ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: `Checked ${localProviders.length + cloudProviders.length} providers`,
  };
}

// Check Zustand stores
async function checkStoreIntegrity(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  // Check chat store
  try {
    const chatStore = useChatStore.getState();
    subChecks.push({
      name: 'Chat Store',
      status: 'pass',
      message: `${chatStore.conversations.length} conversations loaded`,
      data: { conversations: chatStore.conversations.length },
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Chat Store',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  // Check settings store
  try {
    const settingsStore = useSettingsStore.getState();
    subChecks.push({
      name: 'Settings Store',
      status: 'pass',
      message: `Theme: ${settingsStore.theme}, Accent: ${settingsStore.accentColor}`,
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Settings Store',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  // Check knowledge store
  try {
    const knowledgeStore = useKnowledgeStore.getState();
    subChecks.push({
      name: 'Knowledge Store',
      status: 'pass',
      message: `${knowledgeStore.documents.length} documents in knowledge base`,
      data: { documents: knowledgeStore.documents.length },
    });
  } catch (error: any) {
    subChecks.push({
      name: 'Knowledge Store',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  // Check localStorage persistence
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ai-command'));
    subChecks.push({
      name: 'LocalStorage Persistence',
      status: keys.length > 0 ? 'pass' : 'warn',
      message: `${keys.length} persisted stores found`,
      data: { keys },
    });
  } catch (error: any) {
    subChecks.push({
      name: 'LocalStorage Persistence',
      status: 'fail',
      message: `Error: ${error.message}`,
    });
  }
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'State Management',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: 'Checked Zustand stores and persistence',
  };
}

// Check browser APIs
async function checkBrowserAPIs(): Promise<IntegrityCheck> {
  const start = Date.now();
  const subChecks: SubCheck[] = [];
  
  // IndexedDB API
  subChecks.push({
    name: 'IndexedDB API',
    status: 'indexedDB' in window ? 'pass' : 'fail',
    message: 'indexedDB' in window ? 'Available' : 'Not supported',
  });
  
  // Web Crypto API
  subChecks.push({
    name: 'Web Crypto API',
    status: 'crypto' in window ? 'pass' : 'warn',
    message: 'crypto' in window ? 'Available' : 'Limited functionality',
  });
  
  // Fetch API
  subChecks.push({
    name: 'Fetch API',
    status: 'fetch' in window ? 'pass' : 'fail',
    message: 'fetch' in window ? 'Available' : 'Not supported',
  });
  
  // Web Workers
  subChecks.push({
    name: 'Web Workers',
    status: 'Worker' in window ? 'pass' : 'warn',
    message: 'Worker' in window ? 'Available' : 'Not supported',
  });
  
  // Performance API
  subChecks.push({
    name: 'Performance API',
    status: 'performance' in window ? 'pass' : 'warn',
    message: 'performance' in window ? 'Available' : 'Not supported',
  });
  
  // Storage Estimate API
  const hasStorageEstimate = navigator.storage && 'estimate' in navigator.storage;
  subChecks.push({
    name: 'Storage Estimate API',
    status: hasStorageEstimate ? 'pass' : 'warn',
    message: hasStorageEstimate ? 'Available' : 'Limited storage info',
  });
  
  const hasFailures = subChecks.some(c => c.status === 'fail');
  const hasWarnings = subChecks.some(c => c.status === 'warn');
  
  return {
    component: 'Browser APIs',
    subChecks,
    status: hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass',
    duration: Date.now() - start,
    details: 'Checked required browser APIs',
  };
}

// Generate recommendations based on check results
function generateRecommendations(checks: IntegrityCheck[]): string[] {
  const recommendations: string[] = [];
  
  for (const check of checks) {
    if (check.status === 'fail') {
      switch (check.component) {
        case 'IndexedDB Storage':
          recommendations.push('Critical: Database issues detected. Consider clearing and rebuilding data.');
          break;
        case 'Embedding & RAG System':
          recommendations.push('RAG system needs attention. Try reindexing documents.');
          break;
        case 'AI Providers':
          recommendations.push('No AI providers available. Start Ollama or LM Studio for local AI.');
          break;
        case 'Browser APIs':
          recommendations.push('Critical browser APIs missing. Try using a modern browser.');
          break;
      }
    } else if (check.status === 'warn') {
      for (const subCheck of check.subChecks) {
        if (subCheck.status === 'warn' && subCheck.name.includes('Storage Quota')) {
          recommendations.push('Storage usage is high. Consider cleaning up old backups.');
        }
      }
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All systems operating normally. No action required.');
  }
  
  return recommendations;
}

// Run full integrity check
export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const start = Date.now();
  
  const checks = await Promise.all([
    checkIndexedDBIntegrity(),
    checkEmbeddingIntegrity(),
    checkPluginIntegrity(),
    checkMCPIntegrity(),
    checkProviderIntegrity(),
    checkStoreIntegrity(),
    checkBrowserAPIs(),
  ]);
  
  const passedChecks = checks.filter(c => c.status === 'pass').length;
  const warningChecks = checks.filter(c => c.status === 'warn').length;
  const failedChecks = checks.filter(c => c.status === 'fail').length;
  
  const hasFailures = failedChecks > 0;
  const hasWarnings = warningChecks > 0;
  
  return {
    timestamp: new Date(),
    overallStatus: hasFailures ? 'critical' : hasWarnings ? 'degraded' : 'healthy',
    totalChecks: checks.length,
    passedChecks,
    warningChecks,
    failedChecks,
    checks,
    totalDuration: Date.now() - start,
    recommendations: generateRecommendations(checks),
  };
}

// Quick integrity check (faster, fewer tests)
export async function runQuickIntegrityCheck(): Promise<{ status: 'healthy' | 'degraded' | 'critical'; message: string }> {
  try {
    // Quick checks only
    const storage = await getStorageEstimate();
    const storageOk = storage.quota === 0 || (storage.used / storage.quota) < 0.9;
    
    const chatStore = useChatStore.getState();
    const storeOk = chatStore.conversations !== undefined;
    
    const plugins = pluginRegistry.getAllPlugins();
    const pluginsOk = plugins.length > 0;
    
    if (!storageOk || !storeOk) {
      return { status: 'critical', message: 'Critical system issues detected' };
    }
    
    if (!pluginsOk) {
      return { status: 'degraded', message: 'Some systems need attention' };
    }
    
    return { status: 'healthy', message: 'All systems operational' };
  } catch (error: any) {
    return { status: 'critical', message: `Check failed: ${error.message}` };
  }
}
