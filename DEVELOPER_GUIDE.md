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

## 🚀 Полная установка системы

### Требования
- **Node.js 18+** или **Bun** (рекомендуется)
- Современный браузер (Chrome 90+, Firefox 88+, Edge 90+)
- **Git** для клонирования репозитория
- Минимум 4 GB RAM для локальных AI моделей

### Шаг 1: Скачивание проекта

**Вариант A: Через Lovable (экспорт)**
1. В Lovable открыть проект
2. Нажать **Export to GitHub** в настройках
3. Клонировать свой репозиторий:
```bash
git clone https://github.com/ваш-username/ai-command-center.git
cd ai-command-center
```

**Вариант B: Прямое клонирование**
```bash
git clone <repository-url>
cd ai-command-center
```

### Шаг 2: Установка зависимостей

```bash
# NPM
npm install

# или Bun (быстрее)
bun install
```

### Шаг 3: Запуск приложения

```bash
# Development режим с hot-reload
npm run dev
# или
bun dev

# Приложение откроется на http://localhost:5173
```

### Шаг 4: Сборка для продакшена

```bash
# Сборка
npm run build

# Результат в папке dist/

# Запуск на любом статическом сервере
npx serve dist
# или
python -m http.server 3000 -d dist
# или
docker run -p 3000:80 -v $(pwd)/dist:/usr/share/nginx/html nginx
```

### Шаг 5: Подключение AI провайдера

**Ollama (рекомендуется для начала):**
```bash
# Установка (Linux/macOS)
curl -fsSL https://ollama.com/install.sh | sh

# Windows - скачать установщик с ollama.com

# Загрузить модель
ollama pull llama3.2
# или для кода
ollama pull codellama

# Проверить что работает
curl http://localhost:11434/api/tags
```

**LM Studio:**
1. Скачать с https://lmstudio.ai
2. Загрузить любую модель (Mistral, Llama, Phi)
3. Нажать **Start Server** (порт 1234)
4. Проверить: `curl http://localhost:1234/v1/models`

**llama.cpp:**
```bash
# Клонировать и собрать
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp && make

# Скачать модель (например, Mistral 7B GGUF)
# Запустить сервер
./server -m ./models/mistral-7b.gguf --port 8080

# Проверить
curl http://localhost:8080/v1/models
```

---

## 🔍 Полный аудит системы через локальный AI

После установки и подключения провайдера выполните аудит системы.

### Метод 1: Консольный режим (рекомендуется)

Перейдите на `/console` и выполните:

```bash
# 1. Проверить статус всех провайдеров
/status
# ✅ ollama: online (llama3.2, codellama, mistral)
# ✅ lmstudio: online (mistral-7b-instruct)
# ❌ openai: offline (no API key)

# 2. Реальный пинг к провайдеру (без симуляции!)
/ping
# 🏓 Пинг Ollama: 45ms ✅
# Модели: llama3.2, codellama, mistral...

# 3. Получить список доступных моделей
/models
# 📋 Модели Ollama (5):
#   • llama3.2
#   • codellama
#   • mistral
#   • ...

# 4. Полная конфигурация системы
/config
# ⚙️ Конфигурация системы:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 Провайдеры: 5 активных, 2 онлайн
# 🌡️ Temperature: 0.7
# 📝 Max Tokens: 4096
# 🔑 API Keys: OpenAI ❌, Google ❌, Anthropic ❌
# ...

# 5. Версия и информация о системе
/version
# 🤖 AI Command Center v2.0.0
# 📅 Build: 2024-01-15
# ...

# 6. Полный аудит системы (NEW!)
/audit
# 🔍 ПОЛНЫЙ АУДИТ СИСТЕМЫ
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 ПРОВАЙДЕРЫ AI: 5 активных, 2 онлайн
# 💾 ХРАНИЛИЩЕ: IndexedDB ✅, LocalStorage ✅
# 💬 ДАННЫЕ: 150 сообщений, 3 разговора
# 🌐 ВЕБ-ПОИСК: ✅ Доступен (SearXNG, Proxy)
# ⚙️ НАСТРОЙКИ: Temperature 0.7, Max Tokens 4096
# 🔑 API КЛЮЧИ: OpenAI ❌, Google ✅, Anthropic ❌

# 7. Веб-поиск (NEW!)
/search React hooks tutorial
# 🔍 Результаты веб-поиска по запросу "React hooks tutorial" (SearXNG):
# 1. **React Hooks Tutorial** 📎 https://reactjs.org/...
# 2. **Learn React Hooks** 📎 https://...
```

### Метод 2: Страница Maintenance

1. Перейти на `/maintenance`
2. **Health Checks** — диагностика всех компонентов:
   - IndexedDB storage
   - Vector store
   - Provider connections
   - Plugin system
   - Memory usage
3. **Maintenance** — автоматическое исправление проблем
4. **Backups** — создание резервных копий

### Метод 3: Headless API (DevTools)

Откройте консоль браузера (`F12`) и выполните:

```javascript
// Проверить статус
console.log(await window.AiCommand.ping());

// Получить список провайдеров
console.log(window.AiCommand.getProviders());

// Текущий провайдер
console.log(window.AiCommand.getProvider());

// Отправить тестовое сообщение
const response = await window.AiCommand.chat("Привет! Ты работаешь?");
console.log(response);

// История чата
console.log(window.AiCommand.getHistory());

// Полная диагностика
const diagnostics = await window.AiCommand.diagnostics?.();
console.log(diagnostics);
```

### Метод 4: Аудит через AI чат

Откройте `/chat` и спросите AI:

```
Выполни аудит своей системы:
1. Какие провайдеры доступны?
2. Какие модели загружены?
3. Сколько сообщений в истории?
4. Какие плагины активны?
5. Есть ли проблемы со здоровьем системы?
```

AI использует встроенные инструменты (`system-info` плагин) для диагностики.

---

## 🛠️ Расширенное исправление сбоев

### Приложение не запускается

**Симптом:** Белый экран или ошибка при загрузке

**Решения:**
```bash
# 1. Очистить кэш Vite
rm -rf node_modules/.vite
npm run dev

# 2. Переустановить зависимости
rm -rf node_modules
npm install
npm run dev

# 3. Проверить версию Node.js
node --version  # должно быть 18+

# 4. Проверить порт
lsof -i :5173  # не занят ли порт
```

### Провайдер показывает "offline"

**Симптом:** Провайдер не отвечает, статус offline

**Диагностика:**
```bash
# Проверить Ollama
curl http://localhost:11434/api/tags
# Должен вернуть JSON со списком моделей

# Проверить LM Studio
curl http://localhost:1234/v1/models
# Должен вернуть JSON с моделями

# Проверить llama.cpp
curl http://localhost:8080/v1/models
```

**Решения:**
```bash
# Ollama не запущен
ollama serve
# или
systemctl start ollama

# CORS проблема
OLLAMA_ORIGINS="*" ollama serve

# LM Studio - проверить что сервер запущен
# В LM Studio нажать "Start Server"

# Неправильный порт - проверить в Settings → Providers
```

### Данные не сохраняются

**Симптом:** Сообщения/настройки пропадают после перезагрузки

**Диагностика (в консоли браузера):**
```javascript
// Проверить IndexedDB
const dbs = await indexedDB.databases();
console.log(dbs);
// Должны быть: ai-command-center, ai-command-center-vectors

// Проверить localStorage
console.log(Object.keys(localStorage));
// Должны быть ключи ai-command-*
```

**Решения:**
1. DevTools → Application → IndexedDB → проверить данные
2. Перейти на `/maintenance` → Run Health Checks
3. Очистить и пересоздать: Settings → Clear All Data

### RAG не находит документы

**Симптом:** AI не видит загруженные документы

**Проверки:**
1. Документы загружены? (`/knowledge`)
2. RAG включен? (кнопка RAG в чате)
3. Векторы созданы? (Maintenance → Health Checks)

**Решение:**
1. Maintenance → Reindex Vectors
2. Или в консоли браузера:
```javascript
import { reindexAllDocuments } from '@/lib/ragPipeline';
await reindexAllDocuments();
```

### Полный сброс системы

**Когда:** Критические ошибки, повреждённые данные

```javascript
// В консоли браузера (F12)
// ⚠️ ВНИМАНИЕ: Удалит ВСЕ данные!

localStorage.clear();
indexedDB.deleteDatabase('ai-command-center');
indexedDB.deleteDatabase('ai-command-center-vectors');
location.reload();
```

---

## 💾 Резервное копирование и восстановление

### Экспорт данных

**Через UI:**
1. Settings → Export All Data
2. Сохранит JSON файл со всеми данными

**Через консоль:**
```bash
/export
# Копирует конфигурацию провайдеров в буфер обмена
```

**Программно:**
```javascript
import { exportAllData } from '@/lib/dataManager';
const data = await exportAllData();
// Скачает файл ai-command-center-backup-*.json
```

### Импорт данных

**Через UI:**
1. Settings → Import Data
2. Выбрать JSON файл бэкапа

**Через консоль:**
```bash
/import [{"name":"Provider","endpoint":"http://..."}]
```

### Автоматические бэкапы

```typescript
import { useMaintenanceStore } from '@/stores/maintenanceStore';

// Включить авто-бэкап каждые 24 часа
useMaintenanceStore.getState().setAutoBackup(true, 24);
```

---

## ✅ Чеклист после установки

Выполните все проверки после установки:

- [ ] `npm run dev` запускается без ошибок
- [ ] Браузер открывает http://localhost:5173
- [ ] Хотя бы один провайдер показывает "online"
- [ ] `/ping` в консоли возвращает реальный latency
- [ ] `/models` показывает список моделей
- [ ] Тестовое сообщение в чате получает ответ
- [ ] Health Checks на `/maintenance` проходят
- [ ] Документ загружается в Knowledge Base
- [ ] Экспорт данных работает

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
| `web-search` | Web Search | web_search, fetch_page |

### Веб-поиск (независимый от Lovable)

Система имеет **полностью автономный веб-поиск** без зависимостей от Lovable Cloud или Edge Functions.

#### Архитектура
```
Клиент → SearXNG API (прямой) → Результаты
       → CORS-прокси → DuckDuckGo HTML → Парсинг
       → CORS-прокси → Google → Парсинг
```

#### Поддерживаемые источники (в порядке приоритета):
1. **SearXNG** - публичные инстансы (без прокси, JSON API)
2. **DuckDuckGo** - HTML парсинг через CORS-прокси
3. **Google** - HTML парсинг через CORS-прокси

#### CORS-прокси (автоматический выбор):
- `corsproxy.io`
- `allorigins.win`
- `cors-anywhere.herokuapp.com`

#### Использование через консоль:
```bash
# Веб-поиск
/search React hooks tutorial

# Результат:
🔍 Результаты веб-поиска по запросу "React hooks tutorial" (SearXNG):

1. **React Hooks Tutorial**
   📎 https://reactjs.org/docs/hooks-intro.html
   Learn how to use hooks in React...
```

#### Использование через API:
```typescript
import { webSearch, fetchPageContent } from '@/lib/webSearchService';

// Поиск
const results = await webSearch('React hooks', { maxResults: 5 });
if (results.success) {
  results.results.forEach(r => console.log(r.title, r.url));
}

// Загрузка страницы
const content = await fetchPageContent('https://example.com', { maxLength: 5000 });
```

#### Использование через AI плагин:
```javascript
// AI может вызвать через плагин web-search:
{
  tool: 'web_search',
  args: { query: 'latest React 19 features', max_results: 5 }
}

{
  tool: 'fetch_page',
  args: { url: 'https://react.dev/blog/2024', max_length: 3000 }
}
```

#### Кэширование:
- Результаты кэшируются на 5 минут
- Очистка: `clearSearchCache()` или перезагрузка страницы

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

Доступен по `/console`. Терминальный интерфейс для работы с AI.

### Все команды

| Команда | Описание |
|---------|----------|
| `/help [cmd]` | Показать список команд или справку по конкретной |
| `/status` | Статус всех провайдеров (онлайн/офлайн) |
| `/provider [id]` | Показать или сменить текущий провайдер |
| `/model [name]` | Показать или сменить текущую модель |
| `/models` | Получить список моделей текущего провайдера |
| `/ping` | Реальная проверка соединения с провайдером |
| `/config` | Показать полную конфигурацию системы |
| `/export` | Экспорт кастомных провайдеров в буфер обмена (JSON) |
| `/import <json>` | Импорт провайдеров из JSON |
| `/clear` | Очистить историю чата |
| `/history [n]` | Показать последние n команд |
| `/theme [dark/light]` | Переключить тему оформления |
| `/version` | Информация о версии системы |

### Горячие клавиши

| Клавиши | Действие |
|---------|----------|
| `↑` / `↓` | Навигация по истории команд |
| `Tab` | Автодополнение команды |
| `Ctrl+L` | Очистить консоль |
| `Enter` | Отправить команду/сообщение |

### Примеры использования

```bash
# Проверить соединение с текущим провайдером
/ping
# 🏓 Пинг Ollama: 45ms ✅
# Модели: llama3.2, codellama, mistral...

# Получить список моделей
/models
# 📋 Модели Ollama (12):
#   • llama3.2
#   • codellama
#   • mistral...

# Посмотреть конфигурацию
/config
# ⚙️ Конфигурация системы:
# 📊 Провайдеры: 5 активных, 2 онлайн
# 🌡️ Temperature: 0.7
# ...

# Экспорт/импорт провайдеров
/export
# 📤 Конфигурация экспортирована в буфер обмена!

/import [{"name":"MyAPI","endpoint":"http://localhost:8080","apiFormat":"openai"}]
# 📥 Успешно импортировано 1 провайдеров!
```

### Регистрация своих команд

```typescript
import { registerCommand } from '@/lib/consoleMode';

registerCommand({
  name: 'mycommand',
  description: 'Моя кастомная команда',
  usage: '/mycommand [args]',
  execute: async (args, context) => {
    // args - массив аргументов
    // context - доступ к провайдерам, моделям, истории
    return `Выполнено с аргументами: ${args.join(', ')}`;
  },
});
```

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
