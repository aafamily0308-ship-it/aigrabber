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
    execute: (_, context) => {
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
    execute: (_, context) => {
      context.clearHistory();
      return '🗑️ История очищена';
    },
  }],
  
  ['export', {
    name: 'export',
    description: 'Экспортировать историю чата',
    usage: '/export',
    execute: (_, context) => {
      const history = context.history.join('\n---\n');
      navigator.clipboard.writeText(history);
      return '📋 История скопирована в буфер обмена';
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
    execute: async (_, context) => {
      const start = Date.now();
      // Simulate ping - in real implementation would call provider.test()
      await new Promise(r => setTimeout(r, 100));
      const latency = Date.now() - start;
      return `🏓 Пинг ${context.currentProvider}: ${latency}ms`;
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
