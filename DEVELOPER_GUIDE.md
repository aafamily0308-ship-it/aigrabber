# AI Command Center - Developer Guide

## Полная документация для разработчика

---

## 📋 Содержание

1. [Архитектура системы](#архитектура-системы)
2. [Структура файлов](#структура-файлов)
3. [Фазы разработки](#фазы-разработки)
4. [Установка и запуск](#установка-и-запуск)
5. [Настройка AI провайдеров](#настройка-ai-провайдеров)
6. [API Reference](#api-reference)
7. [Хранение данных](#хранение-данных)
8. [Плагины и MCP](#плагины-и-mcp)
9. [Техническое обслуживание](#техническое-обслуживание)
10. [Troubleshooting](#troubleshooting)

---

## 🏗 Архитектура системы

### Принципы
- **Полностью автономная работа** - никаких внешних зависимостей кроме AI провайдеров
- **Offline-first** - все данные хранятся локально в IndexedDB
- **Кроссплатформенность** - работает в любом современном браузере (Chrome, Firefox, Edge)
- **Без симуляций** - все функции работают с реальными данными

### Технологический стек
```
Frontend:
├── React 18 + TypeScript
├── Vite (сборщик)
├── TailwindCSS + shadcn/ui
├── Zustand (state management)
└── IndexedDB (хранение данных)

AI Providers (все опциональны):
├── Ollama (локальный, http://localhost:11434)
├── LM Studio (локальный, http://localhost:1234)
├── OpenAI API (облачный, требует API ключ)
├── Google AI (облачный, требует API ключ)
└── Anthropic (облачный, требует API ключ)
```

---

## 📁 Структура файлов

### Core Libraries (`src/lib/`)

| Файл | Описание | Фаза |
|------|----------|------|
| `localAIClient.ts` | Унифицированный клиент для всех AI провайдеров | 1 |
| `indexedDBStore.ts` | IndexedDB хранилище для документов, сообщений, бэкапов | 1 |
| `dataManager.ts` | Экспорт/импорт данных, очистка | 1 |
| `modelOrchestrator.ts` | Автоматический выбор лучшего AI провайдера | 2 |
| `contextManager.ts` | Управление контекстом диалога | 2 |
| `responseProcessor.ts` | Обработка и форматирование ответов AI | 2 |
| `providerHealthMonitor.ts` | Мониторинг доступности провайдеров | 2 |
| `embeddingService.ts` | Оффлайн эмбеддинги (TF-IDF + n-gram) | 3 |
| `vectorStore.ts` | Векторное хранилище для семантического поиска | 3 |
| `conversationMemory.ts` | Долгосрочная память разговоров | 3 |
| `ragPipeline.ts` | RAG (Retrieval Augmented Generation) | 3 |
| `pluginSystem.ts` | Система плагинов и инструментов | 4 |
| `mcpClient.ts` | Model Context Protocol клиент | 4 |
| `toolExecutor.ts` | Исполнитель инструментов | 4 |
| `maintenanceSystem.ts` | Диагностика, бэкапы, самовосстановление | 4 |

### Stores (`src/stores/`)

| Файл | Описание |
|------|----------|
| `chatStore.ts` | Состояние чата, разговоры, сообщения |
| `settingsStore.ts` | Настройки приложения, API ключи |
| `knowledgeStore.ts` | База знаний, документы |
| `auditStore.ts` | Аудит лог, режим паранойи |
| `providerStore.ts` | Конфигурация провайдеров |
| `promptsStore.ts` | Библиотека системных промптов |
| `pluginStore.ts` | Настройки плагинов и MCP |
| `maintenanceStore.ts` | Состояние техобслуживания |

### Pages (`src/pages/`)

| Страница | URL | Описание |
|----------|-----|----------|
| Dashboard | `/` | Главная панель со статистикой |
| Chat | `/chat` | Основной чат с AI |
| Knowledge | `/knowledge` | База знаний (документы) |
| Prompts | `/prompts` | Библиотека промптов |
| Plugins | `/plugins` | Управление плагинами и MCP |
| Maintenance | `/maintenance` | Техническое обслуживание |
| Providers | `/providers` | Настройка AI провайдеров |
| Audit | `/audit` | Журнал аудита |
| Settings | `/settings` | Общие настройки |

---

## 🔄 Фазы разработки

### Фаза 1: Полная автономность
**Цель:** Приложение работает полностью локально без внешних сервисов

**Реализовано:**
- ✅ Унифицированный AI клиент (`localAIClient.ts`)
- ✅ IndexedDB хранилище без лимитов localStorage
- ✅ Экспорт/импорт всех данных
- ✅ Детекция онлайн/оффлайн статуса

### Фаза 2: Интеллектуальное ядро
**Цель:** Умный выбор провайдера и оптимизация контекста

**Реализовано:**
- ✅ Автоматический выбор модели по типу задачи
- ✅ Мониторинг здоровья провайдеров
- ✅ Управление окном контекста
- ✅ Fallback цепочки при недоступности

### Фаза 3: Память и RAG
**Цель:** Долгосрочная память и семантический поиск

**Реализовано:**
- ✅ Оффлайн эмбеддинги (без внешних API)
- ✅ Векторное хранилище в IndexedDB
- ✅ Семантический поиск по базе знаний
- ✅ RAG для обогащения запросов контекстом

### Фаза 4: Плагины и MCP
**Цель:** Расширяемость через плагины и внешние инструменты

**Реализовано:**
- ✅ Система плагинов с реальными инструментами
- ✅ MCP клиент для внешних серверов
- ✅ Унифицированный исполнитель инструментов
- ✅ Режим техобслуживания с бэкапами

---

## 🚀 Установка и запуск

### Требования
- Node.js 18+ или Bun
- Современный браузер (Chrome 90+, Firefox 88+, Edge 90+)

### Установка
```bash
# Клонировать репозиторий
git clone <repository-url>
cd ai-command-center

# Установить зависимости
npm install
# или
bun install

# Запустить dev сервер
npm run dev
# или
bun dev
```

### Сборка для продакшена
```bash
npm run build
# Результат в папке dist/
```

### Запуск на сервере
```bash
# Любой статический сервер
npx serve dist
# или
python -m http.server 3000 -d dist
```

---

## 🤖 Настройка AI провайдеров

### Локальные провайдеры (рекомендуется)

#### Ollama
```bash
# Установка (Linux/macOS)
curl -fsSL https://ollama.com/install.sh | sh

# Установка модели
ollama pull llama3.2

# Ollama запустится автоматически на http://localhost:11434
```

#### LM Studio
1. Скачать с https://lmstudio.ai
2. Загрузить модель (например, Mistral, Llama)
3. Запустить Local Server (по умолчанию http://localhost:1234)

### Облачные провайдеры

#### OpenAI
1. Получить API ключ на https://platform.openai.com
2. Ввести ключ в Settings → Cloud API Keys → OpenAI

#### Google AI (Gemini)
1. Получить API ключ на https://makersuite.google.com/app/apikey
2. Ввести ключ в Settings → Cloud API Keys → Google AI

#### Anthropic (Claude)
1. Получить API ключ на https://console.anthropic.com
2. Ввести ключ в Settings → Cloud API Keys → Anthropic

---

## 📚 API Reference

### localAIClient.ts

```typescript
// Стриминг ответа от AI
import { streamAI, AIProvider } from '@/lib/localAIClient';

await streamAI({
  provider: 'local-ollama',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  maxTokens: 4096,
  onToken: (token) => console.log(token),
  onComplete: () => console.log('Done'),
  onError: (error) => console.error(error),
});

// Проверка доступности провайдера
import { testProvider } from '@/lib/localAIClient';
const result = await testProvider('local-ollama');
// { success: true, message: 'Ollama is running' }
```

### vectorStore.ts

```typescript
import { storeVector, searchSimilar } from '@/lib/vectorStore';

// Сохранить вектор
await storeVector(
  'doc-1-chunk-1',
  [0.1, 0.2, ...], // embedding vector
  'Text content',
  'document',
  'doc-1',
  { page: 1 }
);

// Семантический поиск
const results = await searchSimilar(queryVector, {
  type: 'document',
  limit: 5,
  minScore: 0.3,
});
```

### ragPipeline.ts

```typescript
import { ragAugment, indexDocument } from '@/lib/ragPipeline';

// Индексировать документ
await indexDocument({
  id: 'doc-1',
  name: 'guide.pdf',
  content: 'Full text content...',
  metadata: { type: 'pdf' },
});

// Обогатить запрос контекстом
const result = await ragAugment('What is X?', 'conv-1', {
  maxDocumentChunks: 5,
  maxMemories: 3,
  includeMemory: true,
});
// result.augmentedQuery содержит запрос + релевантный контекст
```

### maintenanceSystem.ts

```typescript
import { 
  runHealthChecks, 
  createBackup, 
  runMaintenance 
} from '@/lib/maintenanceSystem';

// Проверка здоровья системы
const health = await runHealthChecks();
// health.overall: 'healthy' | 'warning' | 'critical'
// health.checks: массив результатов проверок

// Создать бэкап
const backup = await createBackup();
// backup.backupId: идентификатор бэкапа

// Запустить техобслуживание
const result = await runMaintenance({
  createBackup: true,
  autoFix: true,
  clearOldData: false,
});
```

---

## 💾 Хранение данных

### IndexedDB Stores

| Store | Данные | Индексы |
|-------|--------|---------|
| `documents` | Загруженные документы | name, createdAt |
| `messages` | История сообщений | conversationId, timestamp |
| `auditLogs` | Журнал аудита | timestamp, action |
| `backups` | Резервные копии | timestamp |
| `vectors` | Эмбеддинги для RAG | type, sourceId, createdAt |

### LocalStorage (Zustand persist)

| Ключ | Данные |
|------|--------|
| `ai-command-chat` | Разговоры, выбранный провайдер |
| `ai-command-settings` | Настройки, API ключи |
| `ai-command-audit` | Настройки аудита |
| `ai-command-plugins` | Включенные плагины |
| `ai-command-maintenance` | Настройки авто-бэкапа |

### Экспорт/Импорт

```typescript
import { exportAllData, importAllData } from '@/lib/dataManager';

// Экспорт в JSON
const data = await exportAllData();
// Скачивается файл ai-command-center-backup-*.json

// Импорт
await importAllData(jsonData);
```

---

## 🔌 Плагины и MCP

### Встроенные плагины

| ID | Название | Функции |
|----|----------|---------|
| `datetime` | Date & Time | get_current_time |
| `calculator` | Calculator | calculate |
| `text-utils` | Text Utilities | word_count, text_transform |
| `system-info` | System Info | get_system_info |
| `web-search` | Web Search | web_search (DuckDuckGo API) |

### Создание плагина

```typescript
import { pluginRegistry, Plugin } from '@/lib/pluginSystem';

const myPlugin: Plugin = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Description',
    category: 'tools',
    icon: '🔧',
  },
  capabilities: [
    { type: 'function', name: 'myFunction', description: 'Does something' },
  ],
  tools: [
    {
      name: 'my_tool',
      description: 'Tool description',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input text' },
        },
        required: ['input'],
      },
      execute: async (args) => {
        return { result: args.input.toUpperCase() };
      },
    },
  ],
};

pluginRegistry.register(myPlugin);
pluginRegistry.enable('my-plugin');
```

### MCP серверы

```typescript
import { mcpClient } from '@/lib/mcpClient';

// Добавить сервер
mcpClient.registerServer({
  id: 'my-server',
  name: 'My MCP Server',
  url: 'ws://localhost:8080/mcp',
  protocol: 'ws',
});

// Подключиться
await mcpClient.connect('my-server');

// Вызвать инструмент
const result = await mcpClient.callTool('my-server', 'tool_name', { arg: 'value' });
```

---

## 🔧 Техническое обслуживание

### Страница Maintenance

Доступна по адресу `/maintenance`. Функции:

1. **Health Checks** - диагностика всех компонентов
2. **Backups** - ручное и автоматическое создание бэкапов
3. **Maintenance** - автоматическое исправление проблем
4. **Providers** - тестирование всех AI провайдеров

### Автоматические бэкапы

```typescript
import { useMaintenanceStore } from '@/stores/maintenanceStore';

const store = useMaintenanceStore.getState();

// Включить авто-бэкап каждые 24 часа
store.setAutoBackup(true, 24);

// Создать бэкап вручную
await store.createManualBackup();
```

### Диагностика

```typescript
import { exportDiagnostics } from '@/lib/maintenanceSystem';

// Экспорт полной диагностики
const diagnostics = await exportDiagnostics();
// JSON с информацией о системе, провайдерах, хранилище
```

---

## ❓ Troubleshooting

### Провайдер показывает "offline"

**Причина:** Провайдер недоступен или не запущен

**Решение:**
1. Для Ollama: проверить `ollama serve` или `systemctl status ollama`
2. Для LM Studio: проверить что Local Server запущен
3. Для облачных: проверить API ключ в Settings

### Ошибка CORS при подключении к Ollama

**Решение:** Ollama по умолчанию разрешает localhost. Если запускаете на другом хосте:
```bash
OLLAMA_ORIGINS=* ollama serve
```

### Данные не сохраняются

**Причина:** Проблема с IndexedDB

**Решение:**
1. Проверить в DevTools → Application → IndexedDB
2. Запустить Health Check на странице Maintenance
3. Очистить и пересоздать: Settings → Clear All Data

### RAG не находит документы

**Решение:**
1. Проверить что документы загружены в Knowledge Base
2. Проверить что RAG включен (кнопка "RAG" в чате)
3. Переиндексировать: Maintenance → Reindex Vectors

---

## 📊 Метрики производительности

| Операция | Типичное время |
|----------|---------------|
| Инициализация IndexedDB | <50ms |
| Создание эмбеддинга | 5-20ms |
| Семантический поиск (1000 векторов) | <100ms |
| Создание бэкапа | 100-500ms |
| Health check всех провайдеров | 2-5s |

---

## 🔐 Безопасность

- **API ключи** хранятся только в localStorage браузера
- **Paranoid Mode** блокирует отправку данных в облако
- **Audit Log** записывает все операции с данными
- **Sensitive Data Detection** предупреждает о персональных данных

---

## 🔌 Расширенная система провайдеров (v2.0)

### Поддерживаемые провайдеры

| ID | Название | Тип | Endpoint | API формат |
|----|----------|-----|----------|------------|
| `ollama` | Ollama | local | localhost:11434 | ollama |
| `lmstudio` | LM Studio | local | localhost:1234 | openai |
| `llamacpp` | llama.cpp | local | localhost:8080 | openai |
| `koboldcpp` | KoboldCpp | local | localhost:5001 | koboldcpp |
| `localai` | LocalAI | local | localhost:8080 | openai |
| `textgenweb` | Text Gen WebUI | local | localhost:5000 | openai |
| `vllm` | vLLM | local | localhost:8000 | openai |
| `google` | Google Gemini | cloud | googleapis.com | google |
| `openai` | OpenAI | cloud | api.openai.com | openai |
| `anthropic` | Claude | cloud | api.anthropic.com | anthropic |

### Добавление custom провайдера

```typescript
// src/lib/providers/myProvider.ts
import { createProvider, streamOpenAICompatible } from './providerInterface';

export const myProvider = createProvider({
  id: 'myprovider',
  name: 'My Provider',
  type: 'local',
  apiFormat: 'openai',
  defaultEndpoint: 'http://localhost:9000',
  defaultPort: 9000,
  requiresApiKey: false,
  
  test: async (endpoint) => {
    const res = await fetch(`${endpoint}/v1/models`);
    return { online: res.ok, latency: 0 };
  },
  
  stream: (options) => streamOpenAICompatible(options),
  
  getModels: async (endpoint) => ['model-1', 'model-2'],
  
  configFields: [
    { key: 'endpoint', label: 'Endpoint', type: 'text', required: true }
  ],
});

// Регистрация в providerRegistry.ts
builtinProviders.set('myprovider', myProvider);
```

---

## 🖥️ Консольный режим

Доступен по `/console`. Терминальный интерфейс для работы с AI:

```
/help          - Список команд
/status        - Статус всех провайдеров
/provider <id> - Сменить провайдер
/model <name>  - Сменить модель
/clear         - Очистить историю
/export        - Экспорт в буфер обмена
/history [n]   - Последние n команд
/theme         - Переключить тему
/ping          - Тест соединения
```

Горячие клавиши:
- `Ctrl+L` — очистить экран
- `↑/↓` — навигация по истории
- `Tab` — автодополнение команд

---

## 🔧 Headless API

Доступ через `window.AiCommand` для программного управления:

```javascript
// Отправить сообщение
const response = await window.AiCommand.chat("Привет!");

// Стриминг с колбэком
await window.AiCommand.stream("Напиши код", (token) => {
  process.stdout.write(token);
});

// Управление провайдерами
window.AiCommand.setProvider("ollama");
window.AiCommand.setModel("llama3.2");
window.AiCommand.getProviders(); // Список всех
window.AiCommand.getProvider();  // Текущий

// История
window.AiCommand.getHistory();
window.AiCommand.clearHistory();

// Диагностика
const ping = await window.AiCommand.ping("ollama"); 
// { success: true, latency: 45 }
```

---

## 🚨 Исправление сбоев

### Приложение не запускается

```bash
# Очистить кэш
rm -rf node_modules/.vite
npm run dev

# Переустановить зависимости
rm -rf node_modules
npm install
```

### Провайдер не подключается

```bash
# Проверить Ollama
curl http://localhost:11434/api/tags

# Проверить LM Studio
curl http://localhost:1234/v1/models

# Разрешить CORS для Ollama
OLLAMA_ORIGINS="*" ollama serve
```

### Сброс состояния

```javascript
// В консоли браузера (F12)
localStorage.clear();
indexedDB.deleteDatabase('ai-command-center');
indexedDB.deleteDatabase('ai-command-center-vectors');
location.reload();
```

### Восстановление из бэкапа

1. Перейти в Maintenance → Backups
2. Выбрать бэкап → Restore
3. Или импортировать JSON: Settings → Import Data

### Диагностика системы

1. Перейти на `/maintenance`
2. Нажать "Run Health Checks"
3. При проблемах — "Run Maintenance"
4. aiBrain автоматически изолирует сбойные компоненты

---

## 📝 Лицензия

MIT License. Свободное использование и модификация.

---

*Документация актуальна для версии 2.0.0*
