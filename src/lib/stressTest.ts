// Stress Testing System - Maximum load testing for all components
// Tests system stability under heavy load

import { getAllItems, addItem, deleteItem } from './indexedDBStore';
import { storeVector, searchSimilar, clearVectors, getVectorStoreStats } from './vectorStore';
import { generateEmbedding } from './embeddingService';
import { pluginRegistry, executeTool, PluginContext } from './pluginSystem';
import { testProvider, AIProvider } from './localAIClient';
import { useSettingsStore } from '@/stores/settingsStore';

export interface StressTestResult {
  testName: string;
  category: string;
  passed: boolean;
  iterations: number;
  duration: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  errors: string[];
  metrics: Record<string, number>;
}

export interface StressTestReport {
  timestamp: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  results: StressTestResult[];
  systemStable: boolean;
  recommendations: string[];
}

export interface StressTestConfig {
  iterations: number;
  concurrency: number;
  timeout: number;
}

const defaultConfig: StressTestConfig = {
  iterations: 100,
  concurrency: 10,
  timeout: 30000,
};

// Measure latency of async operation
async function measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
  const start = performance.now();
  const result = await fn();
  const latency = performance.now() - start;
  return { result, latency };
}

// Run function multiple times and collect metrics
async function runIterations<T>(
  fn: () => Promise<T>,
  iterations: number,
  label: string
): Promise<{ latencies: number[]; errors: string[]; results: T[] }> {
  const latencies: number[] = [];
  const errors: string[] = [];
  const results: T[] = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const { result, latency } = await measureLatency(fn);
      latencies.push(latency);
      results.push(result);
    } catch (error: any) {
      errors.push(`Iteration ${i}: ${error.message}`);
    }
  }
  
  return { latencies, errors, results };
}

// IndexedDB Stress Test
async function stressTestIndexedDB(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const errors: string[] = [];
  const latencies: number[] = [];
  
  // Test: Write operations using auditLogs store (simpler schema)
  const testIds: string[] = [];
  for (let i = 0; i < config.iterations; i++) {
    const id = `stress-test-${Date.now()}-${i}`;
    testIds.push(id);
    
    try {
      const item = {
        id,
        action: 'stress-test',
        timestamp: new Date(),
        details: `Test data ${i} - ${'x'.repeat(500)}`,
      };
      const { latency } = await measureLatency(() => addItem('auditLogs', item));
      latencies.push(latency);
    } catch (error: any) {
      errors.push(`Write ${i}: ${error.message}`);
    }
  }
  
  // Test: Read operations
  const readLatencies: number[] = [];
  for (let i = 0; i < Math.min(config.iterations, 50); i++) {
    try {
      const { latency } = await measureLatency(() => getAllItems('auditLogs'));
      readLatencies.push(latency);
    } catch (error: any) {
      errors.push(`Read ${i}: ${error.message}`);
    }
  }
  
  // Cleanup: Delete test items
  for (const id of testIds) {
    try {
      await deleteItem('auditLogs', id);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  const allLatencies = [...latencies, ...readLatencies];
  const avgLatency = allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0;
  const maxLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;
  const minLatency = allLatencies.length > 0 ? Math.min(...allLatencies) : 0;
  
  return {
    testName: 'IndexedDB Operations',
    category: 'Storage',
    passed: errors.length < config.iterations * 0.1, // 90% success rate
    iterations: config.iterations,
    duration: performance.now() - start,
    averageLatency: avgLatency,
    maxLatency,
    minLatency,
    errors: errors.slice(0, 10), // Limit error output
    metrics: {
      writeOperations: latencies.length,
      readOperations: readLatencies.length,
      successRate: ((config.iterations - errors.length) / config.iterations) * 100,
    },
  };
}

// Embedding Generation Stress Test
async function stressTestEmbeddings(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const latencies: number[] = [];
  const errors: string[] = [];
  
  const testTexts = [
    'Short text',
    'Medium length text for testing embedding generation performance',
    'Longer text that simulates a more realistic document chunk. This text contains multiple sentences and should test the embedding system more thoroughly. It includes various words and concepts to ensure comprehensive testing.',
    'Максимально длинный текст для стресс-тестирования системы эмбеддингов. Этот текст содержит множество предложений на разных языках, включая русский, чтобы проверить поддержку многоязычности. The system should handle mixed language content appropriately.',
  ];
  
  const iterations = Math.min(config.iterations, 50); // Limit for embedding tests
  
  for (let i = 0; i < iterations; i++) {
    const text = testTexts[i % testTexts.length];
    try {
      const { latency } = await measureLatency(() => Promise.resolve(generateEmbedding(text)));
      latencies.push(latency);
    } catch (error: any) {
      errors.push(`Embedding ${i}: ${error.message}`);
    }
  }
  
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  
  return {
    testName: 'Embedding Generation',
    category: 'AI/ML',
    passed: errors.length < iterations * 0.1,
    iterations,
    duration: performance.now() - start,
    averageLatency: avgLatency,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    errors: errors.slice(0, 10),
    metrics: {
      successfulEmbeddings: latencies.length,
      avgDimensions: 100, // Our TF-IDF embedding dimension
      throughput: latencies.length / ((performance.now() - start) / 1000),
    },
  };
}

// Vector Store Stress Test
async function stressTestVectorStore(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const writeLatencies: number[] = [];
  const searchLatencies: number[] = [];
  const errors: string[] = [];
  
  const testVectorIds: string[] = [];
  const iterations = Math.min(config.iterations, 100);
  
  // Generate and store test vectors
  for (let i = 0; i < iterations; i++) {
    const id = `stress-vector-${Date.now()}-${i}`;
    testVectorIds.push(id);
    
    try {
      const embedding = generateEmbedding(`Test document ${i} for vector store stress test`);
      const { latency } = await measureLatency(() => 
        storeVector(id, embedding.vector, `Content ${i}`, 'document', `doc-${i}`, { testIndex: i })
      );
      writeLatencies.push(latency);
    } catch (error: any) {
      errors.push(`Store ${i}: ${error.message}`);
    }
  }
  
  // Test search operations
  const searchIterations = Math.min(20, iterations);
  for (let i = 0; i < searchIterations; i++) {
    try {
      const queryEmbedding = generateEmbedding(`Search query ${i}`);
      const { latency } = await measureLatency(() => 
        searchSimilar(queryEmbedding.vector, { limit: 10 })
      );
      searchLatencies.push(latency);
    } catch (error: any) {
      errors.push(`Search ${i}: ${error.message}`);
    }
  }
  
  // Get final stats
  const stats = await getVectorStoreStats().catch(() => ({ totalVectors: 0 }));
  
  const allLatencies = [...writeLatencies, ...searchLatencies];
  const avgLatency = allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0;
  
  return {
    testName: 'Vector Store Operations',
    category: 'Storage',
    passed: errors.length < iterations * 0.1,
    iterations,
    duration: performance.now() - start,
    averageLatency: avgLatency,
    maxLatency: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
    minLatency: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
    errors: errors.slice(0, 10),
    metrics: {
      vectorsStored: writeLatencies.length,
      searchOperations: searchLatencies.length,
      totalVectorsInStore: stats.totalVectors,
      avgWriteLatency: writeLatencies.length > 0 ? writeLatencies.reduce((a, b) => a + b, 0) / writeLatencies.length : 0,
      avgSearchLatency: searchLatencies.length > 0 ? searchLatencies.reduce((a, b) => a + b, 0) / searchLatencies.length : 0,
    },
  };
}

// Plugin System Stress Test
async function stressTestPlugins(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const latencies: number[] = [];
  const errors: string[] = [];
  
  const mockContext: PluginContext = {
    conversation: { id: 'stress-test', messages: [] },
    tools: {
      toast: () => {},
      log: () => {},
    },
  };
  
  const plugins = pluginRegistry.getEnabledPlugins();
  const iterations = Math.min(config.iterations, 50);
  
  // Test tool execution
  for (let i = 0; i < iterations; i++) {
    // Rotate through safe tools
    const testCalls = [
      { name: 'get_current_time', args: { format: 'iso' } },
      { name: 'calculate', args: { expression: `${i} + ${i * 2}` } },
      { name: 'word_count', args: { text: `Test text ${i} for word counting stress test with multiple words` } },
    ];
    
    const call = testCalls[i % testCalls.length];
    
    try {
      const { latency } = await measureLatency(() => 
        executeTool(call.name, call.args, mockContext)
      );
      latencies.push(latency);
    } catch (error: any) {
      errors.push(`Tool ${call.name}: ${error.message}`);
    }
  }
  
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  
  return {
    testName: 'Plugin Tool Execution',
    category: 'Plugins',
    passed: errors.length < iterations * 0.1,
    iterations,
    duration: performance.now() - start,
    averageLatency: avgLatency,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    errors: errors.slice(0, 10),
    metrics: {
      toolExecutions: latencies.length,
      pluginsAvailable: plugins.length,
      throughput: latencies.length / ((performance.now() - start) / 1000),
    },
  };
}

// Memory Stress Test
async function stressTestMemory(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const errors: string[] = [];
  const memoryReadings: number[] = [];
  
  const getMemoryUsage = (): number => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  };
  
  const initialMemory = getMemoryUsage();
  
  // Allocate and release large arrays
  const iterations = Math.min(config.iterations, 20);
  
  for (let i = 0; i < iterations; i++) {
    try {
      // Allocate ~1MB of data
      const largeArray = new Array(250000).fill({ data: `Item ${i}`, value: Math.random() });
      memoryReadings.push(getMemoryUsage());
      
      // Simulate processing
      const sum = largeArray.reduce((acc, item) => acc + item.value, 0);
      
      // Release
      largeArray.length = 0;
    } catch (error: any) {
      errors.push(`Allocation ${i}: ${error.message}`);
    }
  }
  
  // Force garbage collection hint
  if ((window as any).gc) {
    (window as any).gc();
  }
  
  const finalMemory = getMemoryUsage();
  const peakMemory = memoryReadings.length > 0 ? Math.max(...memoryReadings) : 0;
  
  return {
    testName: 'Memory Allocation',
    category: 'Performance',
    passed: errors.length === 0 && (finalMemory - initialMemory) < 50 * 1024 * 1024, // <50MB leak
    iterations,
    duration: performance.now() - start,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: 0,
    errors,
    metrics: {
      initialMemoryMB: initialMemory / 1024 / 1024,
      peakMemoryMB: peakMemory / 1024 / 1024,
      finalMemoryMB: finalMemory / 1024 / 1024,
      memoryDeltaMB: (finalMemory - initialMemory) / 1024 / 1024,
    },
  };
}

// Concurrent Operations Stress Test
async function stressTestConcurrency(config: StressTestConfig): Promise<StressTestResult> {
  const start = performance.now();
  const errors: string[] = [];
  const latencies: number[] = [];
  
  const concurrentOps = config.concurrency;
  const batches = Math.ceil(config.iterations / concurrentOps);
  
  for (let batch = 0; batch < Math.min(batches, 10); batch++) {
    const promises = [];
    
    for (let i = 0; i < concurrentOps; i++) {
      const opIndex = batch * concurrentOps + i;
      promises.push(
        (async () => {
          const opStart = performance.now();
          try {
            // Mix of operations
            const ops = [
              () => Promise.resolve(generateEmbedding(`Concurrent test ${opIndex}`)),
              () => getAllItems('documents'),
              () => executeTool('get_current_time', {}, {
                conversation: { id: 'test', messages: [] },
                tools: { toast: () => {}, log: () => {} },
              }),
            ];
            
            await ops[opIndex % ops.length]();
            latencies.push(performance.now() - opStart);
          } catch (error: any) {
            errors.push(`Concurrent op ${opIndex}: ${error.message}`);
          }
        })()
      );
    }
    
    await Promise.all(promises);
  }
  
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  
  return {
    testName: 'Concurrent Operations',
    category: 'Performance',
    passed: errors.length < config.iterations * 0.15, // 85% success rate for concurrent
    iterations: Math.min(batches * concurrentOps, config.iterations),
    duration: performance.now() - start,
    averageLatency: avgLatency,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    errors: errors.slice(0, 10),
    metrics: {
      concurrencyLevel: concurrentOps,
      successfulOps: latencies.length,
      throughputOpsPerSec: latencies.length / ((performance.now() - start) / 1000),
    },
  };
}

// Generate recommendations based on test results
function generateStressRecommendations(results: StressTestResult[]): string[] {
  const recommendations: string[] = [];
  
  for (const result of results) {
    if (!result.passed) {
      switch (result.category) {
        case 'Storage':
          recommendations.push(`Storage issue in ${result.testName}: Consider clearing old data or optimizing storage usage.`);
          break;
        case 'AI/ML':
          recommendations.push(`AI processing issue: ${result.testName} showed degraded performance. Check system resources.`);
          break;
        case 'Performance':
          recommendations.push(`Performance issue: ${result.testName} failed. System may be under heavy load.`);
          break;
        case 'Plugins':
          recommendations.push(`Plugin issue: Check plugin configurations and dependencies.`);
          break;
      }
    } else if (result.averageLatency > 100) {
      recommendations.push(`${result.testName}: High average latency (${result.averageLatency.toFixed(0)}ms). Consider optimization.`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All stress tests passed. System is stable under load.');
  }
  
  return recommendations;
}

// Run full stress test suite
export async function runStressTests(config: Partial<StressTestConfig> = {}): Promise<StressTestReport> {
  const fullConfig = { ...defaultConfig, ...config };
  const start = performance.now();
  
  const results: StressTestResult[] = [];
  
  // Run tests sequentially to avoid overwhelming the system
  results.push(await stressTestIndexedDB(fullConfig));
  results.push(await stressTestEmbeddings(fullConfig));
  results.push(await stressTestVectorStore(fullConfig));
  results.push(await stressTestPlugins(fullConfig));
  results.push(await stressTestMemory(fullConfig));
  results.push(await stressTestConcurrency(fullConfig));
  
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  
  return {
    timestamp: new Date(),
    totalTests: results.length,
    passedTests,
    failedTests,
    totalDuration: performance.now() - start,
    results,
    systemStable: failedTests === 0,
    recommendations: generateStressRecommendations(results),
  };
}

// Run quick stress test (lighter version)
export async function runQuickStressTest(): Promise<{ passed: boolean; summary: string }> {
  const quickConfig: StressTestConfig = {
    iterations: 10,
    concurrency: 3,
    timeout: 10000,
  };
  
  try {
    const results: boolean[] = [];
    
    // Quick IndexedDB test
    const items = await getAllItems('documents');
    results.push(true);
    
    // Quick embedding test
    const embedding = generateEmbedding('Quick stress test');
    results.push(embedding.vector.length > 0);
    
    // Quick plugin test
    const context = {
      conversation: { id: 'test', messages: [] },
      tools: { toast: () => {}, log: () => {} },
    };
    const toolResult = await executeTool('get_current_time', {}, context);
    results.push(toolResult.success);
    
    const passed = results.every(r => r);
    
    return {
      passed,
      summary: passed 
        ? 'Quick stress test passed: All core systems operational'
        : 'Quick stress test failed: Some systems need attention',
    };
  } catch (error: any) {
    return {
      passed: false,
      summary: `Quick stress test error: ${error.message}`,
    };
  }
}
