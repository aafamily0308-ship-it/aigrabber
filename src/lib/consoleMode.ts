// Console Mode - Command parsing and history management

export interface ConsoleCommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: string[], context: ConsoleContext) => Promise<string> | string;
}

export interface ConsoleContext {
  currentProvider: string;
  currentModel: string;
  isStreaming: boolean;
  history: string[];
  setProvider: (id: string) => void;
  setModel: (model: string) => void;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  getProviders: () => Array<{ id: string; name: string; status: string }>;
}

// Command history
const commandHistory: string[] = [];
let historyIndex = -1;

export const consoleCommands: Map<string, ConsoleCommand> = new Map([
  ['help', {
    name: 'help',
    description: 'Показать список команд',
    usage: '/help [command]',
    execute: (args) => {
      if (args[0]) {
        const cmd = consoleCommands.get(args[0]);
        if (cmd) {
          return `📖 ${cmd.name}\n   ${cmd.description}\n   Использование: ${cmd.usage}`;
        }
        return `❌ Команда не найдена: ${args[0]}`;
      }
      
      const commands = Array.from(consoleCommands.values());
      return `📋 Доступные команды:\n${commands.map(c => 
        `  /${c.name.padEnd(12)} - ${c.description}`
      ).join('\n')}\n\nИспользуйте /help <команда> для подробностей`;
    },
  }],
  
  ['model', {
    name: 'model',
    description: 'Показать или изменить текущую модель',
    usage: '/model [model_name]',
    execute: (args, context) => {
      if (args[0]) {
        context.setModel(args[0]);
        return `✅ Модель изменена на: ${args[0]}`;
      }
      return `🤖 Текущая модель: ${context.currentModel}`;
    },
  }],
  
  ['provider', {
    name: 'provider',
    description: 'Показать или изменить провайдер',
    usage: '/provider [provider_id]',
    execute: (args, context) => {
      if (args[0]) {
        context.setProvider(args[0]);
        return `✅ Провайдер изменён на: ${args[0]}`;
      }
      return `🔌 Текущий провайдер: ${context.currentProvider}`;
    },
  }],
  
  ['status', {
    name: 'status',
    description: 'Показать статус всех провайдеров',
    usage: '/status',
    execute: (_args, context) => {
      const providers = context.getProviders();
      const statusIcon = (s: string) => s === 'online' ? '🟢' : s === 'checking' ? '🟡' : '🔴';
      return `📊 Статус провайдеров:\n${providers.map(p => 
        `  ${statusIcon(p.status)} ${p.name.padEnd(15)} [${p.id}]`
      ).join('\n')}`;
    },
  }],
  
  ['clear', {
    name: 'clear',
    description: 'Очистить историю чата',
    usage: '/clear',
    execute: (_args, context) => {
      context.clearHistory();
      return '🗑️ История очищена';
    },
  }],
  
  ['history', {
    name: 'history',
    description: 'Показать историю команд',
    usage: '/history [count]',
    execute: (args) => {
      const count = parseInt(args[0]) || 10;
      const recent = commandHistory.slice(-count);
      if (recent.length === 0) {
        return '📜 История команд пуста';
      }
      return `📜 Последние ${recent.length} команд:\n${recent.map((c, i) => 
        `  ${i + 1}. ${c}`
      ).join('\n')}`;
    },
  }],
  
  ['theme', {
    name: 'theme',
    description: 'Переключить тему (dark/light)',
    usage: '/theme [dark|light]',
    execute: (args) => {
      const theme = args[0] || (document.documentElement.classList.contains('dark') ? 'light' : 'dark');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return `🎨 Тема изменена на: ${theme}`;
    },
  }],
  
  ['ping', {
    name: 'ping',
    description: 'Проверить соединение с провайдером',
    usage: '/ping',
    execute: async (_args, context) => {
      const { providerRegistry } = await import('@/lib/providers');
      const { useProviderStore } = await import('@/stores/providerStore');
      
      const provider = useProviderStore.getState().providers.find(p => p.id === context.currentProvider);
      if (!provider) {
        return `❌ Провайдер ${context.currentProvider} не найден`;
      }
      
      const plugin = providerRegistry.get(context.currentProvider);
      if (!plugin) {
        return `❌ Плагин провайдера ${context.currentProvider} не найден`;
      }
      
      const start = Date.now();
      try {
        const result = await plugin.test(provider.endpoint, provider.apiKey);
        const latency = Date.now() - start;
        
        if (result.online) {
          const modelsInfo = result.models?.length ? `\nМодели: ${result.models.slice(0, 5).join(', ')}${result.models.length > 5 ? '...' : ''}` : '';
          return `🏓 Пинг ${provider.name}: ${latency}ms ✅${modelsInfo}`;
        } else {
          return `❌ ${provider.name} недоступен: ${result.error || 'Connection failed'}`;
        }
      } catch (error: any) {
        const latency = Date.now() - start;
        return `❌ Ошибка пинга ${provider.name} (${latency}ms): ${error.message}`;
      }
    },
  }],
  
  ['models', {
    name: 'models',
    description: 'Показать доступные модели текущего провайдера',
    usage: '/models',
    execute: async (_args, context) => {
      const { providerRegistry } = await import('@/lib/providers');
      const { useProviderStore } = await import('@/stores/providerStore');
      
      const provider = useProviderStore.getState().providers.find(p => p.id === context.currentProvider);
      if (!provider) {
        return `❌ Провайдер ${context.currentProvider} не найден`;
      }
      
      const plugin = providerRegistry.get(context.currentProvider);
      if (!plugin?.getModels) {
        return `❌ Провайдер ${provider.name} не поддерживает список моделей`;
      }
      
      try {
        const models = await plugin.getModels(provider.endpoint, provider.apiKey);
        if (models.length === 0) {
          return `📋 ${provider.name}: модели не найдены`;
        }
        return `📋 Модели ${provider.name} (${models.length}):\n${models.map(m => `  • ${m}`).join('\n')}`;
      } catch (error: any) {
        return `❌ Ошибка получения моделей: ${error.message}`;
      }
    },
  }],
  
  ['config', {
    name: 'config',
    description: 'Показать текущую конфигурацию системы',
    usage: '/config',
    execute: async (_args) => {
      const { useProviderStore } = await import('@/stores/providerStore');
      const { useSettingsStore } = await import('@/stores/settingsStore');
      
      const providers = useProviderStore.getState().providers;
      const settings = useSettingsStore.getState();
      const activeProviders = providers.filter(p => p.isActive);
      const onlineProviders = providers.filter(p => p.status === 'online');
      
      const apiStatus = (key: string | undefined) => key ? '✅' : '❌';
      
      return `⚙️ Конфигурация системы:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Провайдеры: ${activeProviders.length} активных, ${onlineProviders.length} онлайн
🌡️ Temperature: ${settings.temperature}
📝 Max Tokens: ${settings.maxTokens}
🔑 API Keys: OpenAI ${apiStatus(settings.cloudApiKeys?.openai)}, Google ${apiStatus(settings.cloudApiKeys?.google)}, Anthropic ${apiStatus(settings.cloudApiKeys?.anthropic)}

Провайдеры онлайн:
${onlineProviders.length > 0 ? onlineProviders.map(p => `  🟢 ${p.name} (${p.latency || '?'}ms)`).join('\n') : '  Нет доступных'}

Активные провайдеры:
${activeProviders.map(p => `  ${p.status === 'online' ? '🟢' : '🔴'} ${p.name}`).join('\n')}`;
    },
  }],
  
  ['export', {
    name: 'export',
    description: 'Экспортировать конфигурацию провайдеров',
    usage: '/export',
    execute: async (_args) => {
      const { providerRegistry } = await import('@/lib/providers');
      const config = providerRegistry.exportConfig();
      
      try {
        await navigator.clipboard.writeText(config);
        const parsed = JSON.parse(config);
        return `📤 Конфигурация экспортирована в буфер обмена!\n\n${parsed.length} кастомных провайдеров (${config.length} символов)`;
      } catch {
        return `📤 Конфигурация:\n\n${config}`;
      }
    },
  }],
  
  ['import', {
    name: 'import',
    description: 'Импортировать конфигурацию провайдеров',
    usage: '/import <json>',
    execute: async (args) => {
      if (args.length === 0) {
        return `❌ Использование: /import <json>\n\nВставьте JSON конфигурацию после команды.\nПример: /import [{"name":"MyProvider","endpoint":"http://localhost:8080"}]`;
      }
      
      const { providerRegistry } = await import('@/lib/providers');
      try {
        const json = args.join(' ');
        const count = providerRegistry.importConfig(json);
        return `📥 Успешно импортировано ${count} провайдеров!`;
      } catch (error: any) {
        return `❌ Ошибка импорта: ${error.message}\n\nУбедитесь что JSON валидный.`;
      }
    },
  }],
  
  ['version', {
    name: 'version',
    description: 'Показать версию системы',
    usage: '/version',
    execute: (_args) => {
      return `🚀 AI Command Center v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 React 18 + TypeScript + Vite
🎨 TailwindCSS + shadcn/ui
💾 IndexedDB + Zustand
🤖 10 AI Providers supported
🔌 Plugin System + MCP Client
📊 RAG Pipeline + Vector Store`;
    },
  }],
  
  ['audit', {
    name: 'audit',
    description: 'Полный аудит системы',
    usage: '/audit',
    execute: async (_args) => {
      const { useProviderStore } = await import('@/stores/providerStore');
      const { useSettingsStore } = await import('@/stores/settingsStore');
      const { useChatStore } = await import('@/stores/chatStore');
      const { usePluginStore } = await import('@/stores/pluginStore');
      const { getSearchServiceStatus } = await import('@/lib/webSearchService');
      
      const providers = useProviderStore.getState().providers;
      const settings = useSettingsStore.getState();
      const conversations = useChatStore.getState().conversations;
      const enabledPluginIds = usePluginStore.getState().enabledPluginIds;
      
      const activeProviders = providers.filter(p => p.isActive);
      const onlineProviders = providers.filter(p => p.status === 'online');
      const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
      
      // Проверка IndexedDB
      let indexedDBStatus = '❌ Недоступен';
      try {
        const dbs = await indexedDB.databases();
        const hasDB = dbs.some(db => db.name?.includes('ai-command'));
        indexedDBStatus = hasDB ? '✅ Работает' : '⚠️ Пустая база';
      } catch {
        indexedDBStatus = '❌ Ошибка доступа';
      }
      
      // Проверка localStorage
      let localStorageStatus = '❌ Недоступен';
      try {
        const keys = Object.keys(localStorage).filter(k => k.includes('ai-command'));
        localStorageStatus = keys.length > 0 ? `✅ ${keys.length} ключей` : '⚠️ Пусто';
      } catch {
        localStorageStatus = '❌ Ошибка доступа';
      }
      
      // Проверка веб-поиска
      let webSearchStatus = '⏳ Проверка...';
      try {
        const searchStatus = await getSearchServiceStatus();
        if (searchStatus.available) {
          const methods: string[] = [];
          if (searchStatus.searxng) methods.push('SearXNG');
          if (searchStatus.proxy) methods.push('Proxy');
          webSearchStatus = `✅ Доступен (${methods.join(', ')})`;
        } else {
          webSearchStatus = '❌ Недоступен';
        }
      } catch {
        webSearchStatus = '⚠️ Не удалось проверить';
      }
      
      // Проверка памяти
      let memoryStatus = 'N/A';
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        const usedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
        memoryStatus = `${usedMB}MB / ${totalMB}MB`;
      }
      
      return `🔍 ПОЛНЫЙ АУДИТ СИСТЕМЫ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ПРОВАЙДЕРЫ AI
  Активные: ${activeProviders.length}
  Онлайн: ${onlineProviders.length}
  ${onlineProviders.map(p => `  🟢 ${p.name} (${p.latency || '?'}ms)`).join('\n') || '  Нет онлайн провайдеров'}

💾 ХРАНИЛИЩЕ
  IndexedDB: ${indexedDBStatus}
  LocalStorage: ${localStorageStatus}
  Память: ${memoryStatus}

💬 ДАННЫЕ
  Сообщений: ${totalMessages}
  Разговоров: ${conversations.length}
  Плагинов: ${enabledPluginIds.length} активно

🌐 ВЕБ-ПОИСК
  Статус: ${webSearchStatus}

⚙️ НАСТРОЙКИ
  Temperature: ${settings.temperature}
  Max Tokens: ${settings.maxTokens}
  Тема: ${settings.theme}

🔑 API КЛЮЧИ
  OpenAI: ${settings.cloudApiKeys?.openai ? '✅' : '❌'}
  Google: ${settings.cloudApiKeys?.google ? '✅' : '❌'}
  Anthropic: ${settings.cloudApiKeys?.anthropic ? '✅' : '❌'}

📅 Время аудита: ${new Date().toLocaleString()}`;
    },
  }],
  
  ['search', {
    name: 'search',
    description: 'Веб-поиск',
    usage: '/search <запрос>',
    execute: async (args) => {
      if (args.length === 0) {
        return '❌ Использование: /search <запрос>\n\nПример: /search React hooks tutorial';
      }
      
      const { webSearch, formatSearchResultsForAI } = await import('@/lib/webSearchService');
      const query = args.join(' ');
      
      try {
        const results = await webSearch(query, { maxResults: 5 });
        return formatSearchResultsForAI(results);
      } catch (error: any) {
        return `❌ Ошибка поиска: ${error.message}`;
      }
    },
  }],
]);

// Parse command from input
export function parseCommand(input: string): { command: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  return { command, args };
}

// Execute a command
export async function executeCommand(
  input: string,
  context: ConsoleContext
): Promise<string | null> {
  const parsed = parseCommand(input);
  if (!parsed) return null;
  
  const cmd = consoleCommands.get(parsed.command);
  if (!cmd) {
    return `❌ Неизвестная команда: /${parsed.command}\nИспользуйте /help для списка команд`;
  }
  
  // Add to history
  commandHistory.push(input);
  historyIndex = commandHistory.length;
  
  return cmd.execute(parsed.args, context);
}

// Navigate command history
export function navigateHistory(direction: 'up' | 'down'): string {
  if (commandHistory.length === 0) return '';
  
  if (direction === 'up') {
    historyIndex = Math.max(0, historyIndex - 1);
  } else {
    historyIndex = Math.min(commandHistory.length, historyIndex + 1);
  }
  
  return commandHistory[historyIndex] || '';
}

// Get autocomplete suggestions
export function getAutocompleteSuggestions(input: string): string[] {
  if (!input.startsWith('/')) return [];
  
  const partial = input.slice(1).toLowerCase();
  const commands = Array.from(consoleCommands.keys());
  
  return commands
    .filter(cmd => cmd.startsWith(partial))
    .map(cmd => `/${cmd}`);
}

// Register a custom command
export function registerCommand(command: ConsoleCommand): void {
  consoleCommands.set(command.name, command);
}
