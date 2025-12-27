// Plugin System - Extensible architecture for adding new AI capabilities
// Phase 4: MCP & Plugins

// Safe math expression evaluator (no eval/Function)
function safeEvaluateMath(expression: string): number {
  // Remove whitespace
  const expr = expression.replace(/\s+/g, '');
  
  // Validate: only allow numbers, operators, parentheses, decimal points
  if (!/^[0-9+\-*/.()%]+$/.test(expr)) {
    throw new Error('Invalid characters in expression');
  }
  
  // Simple recursive descent parser for basic math
  let pos = 0;
  
  function parseNumber(): number {
    let numStr = '';
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
      numStr += expr[pos++];
    }
    if (numStr === '') throw new Error('Expected number');
    return parseFloat(numStr);
  }
  
  function parseFactor(): number {
    if (expr[pos] === '(') {
      pos++; // skip '('
      const result = parseExpression();
      if (expr[pos] !== ')') throw new Error('Missing closing parenthesis');
      pos++; // skip ')'
      return result;
    }
    if (expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    return parseNumber();
  }
  
  function parseTerm(): number {
    let result = parseFactor();
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/' || expr[pos] === '%')) {
      const op = expr[pos++];
      const right = parseFactor();
      if (op === '*') result *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      }
      else if (op === '%') result %= right;
    }
    return result;
  }
  
  function parseExpression(): number {
    let result = parseTerm();
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos++];
      const right = parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }
    return result;
  }
  
  const result = parseExpression();
  if (pos < expr.length) throw new Error('Unexpected character at position ' + pos);
  return result;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  icon?: string;
  category: 'tools' | 'providers' | 'processors' | 'integrations';
}

export interface PluginCapability {
  type: 'function' | 'hook' | 'middleware';
  name: string;
  description: string;
  schema?: Record<string, unknown>;
}

export interface PluginContext {
  conversation: {
    id: string;
    messages: Array<{ role: string; content: string }>;
  };
  user?: {
    preferences: Record<string, unknown>;
  };
  tools: {
    toast: (options: { title: string; description?: string; variant?: string }) => void;
    log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  };
}

export interface PluginHooks {
  onMessageSend?: (message: string, context: PluginContext) => Promise<string>;
  onMessageReceive?: (message: string, context: PluginContext) => Promise<string>;
  onConversationStart?: (context: PluginContext) => Promise<void>;
  onConversationEnd?: (context: PluginContext) => Promise<void>;
  onToolCall?: (toolName: string, args: unknown, context: PluginContext) => Promise<unknown>;
}

export interface Plugin {
  metadata: PluginMetadata;
  capabilities: PluginCapability[];
  hooks?: PluginHooks;
  tools?: PluginTool[];
  initialize?: (context: PluginContext) => Promise<void>;
  cleanup?: () => Promise<void>;
}

export interface PluginTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, context: PluginContext) => Promise<unknown>;
}

// Plugin Registry
class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private listeners: Set<(plugins: Plugin[]) => void> = new Set();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.metadata.id)) {
      console.warn(`Plugin ${plugin.metadata.id} already registered, replacing...`);
    }
    this.plugins.set(plugin.metadata.id, plugin);
    this.notifyListeners();
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin?.cleanup) {
      plugin.cleanup().catch(console.error);
    }
    this.plugins.delete(pluginId);
    this.enabledPlugins.delete(pluginId);
    this.notifyListeners();
  }

  enable(pluginId: string): boolean {
    if (!this.plugins.has(pluginId)) return false;
    this.enabledPlugins.add(pluginId);
    this.notifyListeners();
    return true;
  }

  disable(pluginId: string): void {
    this.enabledPlugins.delete(pluginId);
    this.notifyListeners();
  }

  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(p => this.enabledPlugins.has(p.metadata.id));
  }

  getAllTools(): PluginTool[] {
    return this.getEnabledPlugins()
      .flatMap(p => p.tools || []);
  }

  subscribe(listener: (plugins: Plugin[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const plugins = this.getAllPlugins();
    this.listeners.forEach(l => l(plugins));
  }
}

export const pluginRegistry = new PluginRegistry();

// Hook runner
export async function runHook<K extends keyof PluginHooks>(
  hookName: K,
  context: PluginContext,
  ...args: Parameters<NonNullable<PluginHooks[K]>>
): Promise<ReturnType<NonNullable<PluginHooks[K]>> | undefined> {
  const plugins = pluginRegistry.getEnabledPlugins();
  let result: unknown = args[0];

  for (const plugin of plugins) {
    const hook = plugin.hooks?.[hookName];
    if (hook) {
      try {
        // @ts-ignore - dynamic hook calling
        result = await hook(result, context);
      } catch (error) {
        console.error(`Plugin ${plugin.metadata.id} hook ${hookName} failed:`, error);
      }
    }
  }

  return result as ReturnType<NonNullable<PluginHooks[K]>>;
}

// Tool executor
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: PluginContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const tools = pluginRegistry.getAllTools();
  const tool = tools.find(t => t.name === toolName);

  if (!tool) {
    return { success: false, error: `Tool "${toolName}" not found` };
  }

  try {
    const result = await tool.execute(args, context);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Tool execution failed' };
  }
}

// Built-in plugins (only real, functional tools - no simulations)
export const builtInPlugins: Plugin[] = [
  {
    metadata: {
      id: 'datetime',
      name: 'Date & Time',
      version: '1.0.0',
      description: 'Provides current date and time information',
      category: 'tools',
      icon: '🕐',
    },
    capabilities: [
      { type: 'function', name: 'getCurrentTime', description: 'Get current date and time' },
    ],
    tools: [
      {
        name: 'get_current_time',
        description: 'Get the current date and time in various formats',
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'Output format (iso, locale, unix)',
              enum: ['iso', 'locale', 'unix'],
            },
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., UTC, America/New_York)',
            },
          },
        },
        execute: async (args) => {
          const now = new Date();
          const format = args.format as string || 'locale';
          
          switch (format) {
            case 'iso':
              return { time: now.toISOString() };
            case 'unix':
              return { time: Math.floor(now.getTime() / 1000) };
            default:
              return { 
                time: now.toLocaleString(),
                date: now.toLocaleDateString(),
                dayOfWeek: now.toLocaleDateString('en', { weekday: 'long' }),
              };
          }
        },
      },
    ],
  },
  {
    metadata: {
      id: 'calculator',
      name: 'Calculator',
      version: '1.0.0',
      description: 'Perform mathematical calculations',
      category: 'tools',
      icon: '🔢',
    },
    capabilities: [
      { type: 'function', name: 'calculate', description: 'Evaluate mathematical expressions' },
    ],
    tools: [
      {
        name: 'calculate',
        description: 'Evaluate a mathematical expression',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate (e.g., "2 + 2 * 3")',
              required: true,
            },
          },
          required: ['expression'],
        },
        execute: async (args) => {
          const expr = args.expression as string;
          // Safe math evaluation using safe parser
          const result = safeEvaluateMath(expr);
          return { expression: expr, result };
        },
      },
    ],
  },
  {
    metadata: {
      id: 'text-utils',
      name: 'Text Utilities',
      version: '1.0.0',
      description: 'Text manipulation and analysis tools',
      category: 'tools',
      icon: '📝',
    },
    capabilities: [
      { type: 'function', name: 'wordCount', description: 'Count words in text' },
      { type: 'function', name: 'transform', description: 'Transform text' },
    ],
    tools: [
      {
        name: 'word_count',
        description: 'Count words, characters, and sentences in text',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to analyze',
              required: true,
            },
          },
          required: ['text'],
        },
        execute: async (args) => {
          const text = args.text as string;
          const words = text.trim().split(/\s+/).filter(Boolean).length;
          const characters = text.length;
          const sentences = text.split(/[.!?]+/).filter(Boolean).length;
          const paragraphs = text.split(/\n\n+/).filter(Boolean).length;
          
          return { words, characters, sentences, paragraphs };
        },
      },
      {
        name: 'text_transform',
        description: 'Transform text (uppercase, lowercase, title case, reverse)',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to transform',
              required: true,
            },
            operation: {
              type: 'string',
              description: 'Transformation to apply',
              enum: ['uppercase', 'lowercase', 'titlecase', 'reverse'],
              required: true,
            },
          },
          required: ['text', 'operation'],
        },
        execute: async (args) => {
          const text = args.text as string;
          const op = args.operation as string;
          
          switch (op) {
            case 'uppercase':
              return { result: text.toUpperCase() };
            case 'lowercase':
              return { result: text.toLowerCase() };
            case 'titlecase':
              return { result: text.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()) };
            case 'reverse':
              return { result: text.split('').reverse().join('') };
            default:
              return { result: text };
          }
        },
      },
    ],
  },
  {
    metadata: {
      id: 'system-info',
      name: 'System Info',
      version: '1.0.0',
      description: 'Get browser and system information',
      category: 'tools',
      icon: '💻',
    },
    capabilities: [
      { type: 'function', name: 'getSystemInfo', description: 'Get system information' },
    ],
    tools: [
      {
        name: 'get_system_info',
        description: 'Get current browser and system information',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            colorDepth: window.screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            memory: (performance as any).memory ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            } : 'Not available',
          };
        },
      },
    ],
  },
  {
    metadata: {
      id: 'web-search',
      name: 'Web Search',
      version: '2.0.0',
      description: 'Полноценный веб-поиск через SearXNG/DuckDuckGo/Google с CORS-прокси',
      category: 'tools',
      icon: '🔍',
    },
    capabilities: [
      { type: 'function', name: 'search', description: 'Search the web for information' },
      { type: 'function', name: 'fetch_page', description: 'Fetch content from a web page' },
    ],
    tools: [
      {
        name: 'web_search',
        description: 'Поиск в интернете. Возвращает релевантные результаты с заголовками, URL и описаниями.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Поисковый запрос',
              required: true,
            },
            max_results: {
              type: 'number',
              description: 'Максимальное количество результатов (по умолчанию 5)',
            },
          },
          required: ['query'],
        },
        execute: async (args) => {
          const query = args.query as string;
          const maxResults = (args.max_results as number) || 5;
          
          if (!query.trim()) {
            throw new Error('Поисковый запрос не может быть пустым');
          }
          
          try {
            const { webSearch, formatSearchResultsForAI } = await import('@/lib/webSearchService');
            const response = await webSearch(query, { maxResults });
            
            if (!response.success) {
              return {
                success: false,
                query,
                error: response.error,
                suggestion: 'Попробуйте другой поисковый запрос или проверьте интернет-соединение.',
              };
            }
            
            return {
              success: true,
              query,
              source: response.source,
              resultsCount: response.results.length,
              results: response.results,
              formatted: formatSearchResultsForAI(response),
            };
          } catch (error: any) {
            throw new Error(`Ошибка поиска: ${error.message}`);
          }
        },
      },
      {
        name: 'fetch_page',
        description: 'Получить текстовое содержимое веб-страницы по URL.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL страницы для загрузки',
              required: true,
            },
            max_length: {
              type: 'number',
              description: 'Максимальная длина контента (по умолчанию 5000 символов)',
            },
          },
          required: ['url'],
        },
        execute: async (args) => {
          const url = args.url as string;
          const maxLength = (args.max_length as number) || 5000;
          
          if (!url.trim()) {
            throw new Error('URL не может быть пустым');
          }
          
          try {
            const { fetchPageContent } = await import('@/lib/webSearchService');
            const content = await fetchPageContent(url, { maxLength });
            
            return {
              success: true,
              url,
              contentLength: content.length,
              content,
            };
          } catch (error: any) {
            throw new Error(`Ошибка загрузки страницы: ${error.message}`);
          }
        },
      },
    ],
  },
];

// Initialize built-in plugins
builtInPlugins.forEach(plugin => {
  pluginRegistry.register(plugin);
  pluginRegistry.enable(plugin.metadata.id);
});

// Export for use in components
export function getAvailableTools(): { name: string; description: string }[] {
  return pluginRegistry.getAllTools().map(t => ({
    name: t.name,
    description: t.description,
  }));
}

export function getPluginCount(): { total: number; enabled: number } {
  return {
    total: pluginRegistry.getAllPlugins().length,
    enabled: pluginRegistry.getEnabledPlugins().length,
  };
}
