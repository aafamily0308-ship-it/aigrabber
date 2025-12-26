// Web Search Service - Независимый поиск через публичные API и CORS-прокси
// Работает полностью автономно без Lovable Edge Functions

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SearchOptions {
  maxResults?: number;
  language?: string;
  safeSearch?: boolean;
  timeout?: number;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  source: string;
  error?: string;
  cached?: boolean;
}

// Публичные CORS-прокси (в порядке приоритета)
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://proxy.cors.sh/',
  'https://cors-anywhere.herokuapp.com/',
];

// Кэш результатов поиска (в памяти)
const searchCache = new Map<string, { results: SearchResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Получить рабочий CORS-прокси
 */
async function getWorkingProxy(): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const testUrl = proxy + encodeURIComponent('https://www.google.com');
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (response.ok || response.status === 405) {
        console.log(`[WebSearch] Используем прокси: ${proxy}`);
        return proxy;
      }
    } catch {
      // Попробуем следующий прокси
    }
  }
  return null;
}

/**
 * Поиск через DuckDuckGo HTML (парсинг)
 */
async function searchDuckDuckGo(query: string, options: SearchOptions, proxy: string): Promise<SearchResult[]> {
  const maxResults = options.maxResults || 5;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(proxy + encodeURIComponent(url), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(options.timeout || 10000),
  });
  
  if (!response.ok) {
    throw new Error(`DuckDuckGo returned ${response.status}`);
  }
  
  const html = await response.text();
  const results: SearchResult[] = [];
  
  // Парсинг HTML результатов DuckDuckGo
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    
    // Декодируем URL DuckDuckGo redirect
    let url = rawUrl;
    try {
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }
    } catch {
      // Оставляем оригинальный URL
    }
    
    if (title && url && url.startsWith('http')) {
      results.push({
        title,
        url,
        snippet: snippet || '',
        source: 'DuckDuckGo',
      });
    }
  }
  
  // Fallback парсинг если основной не сработал
  if (results.length === 0) {
    const simpleRegex = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
    while ((match = simpleRegex.exec(html)) !== null && results.length < maxResults) {
      const url = match[1];
      if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
        results.push({
          title: new URL(url).hostname,
          url,
          snippet: '',
          source: 'DuckDuckGo',
        });
      }
    }
  }
  
  return results;
}

/**
 * Поиск через SearXNG публичные инстансы
 */
async function searchSearXNG(query: string, options: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options.maxResults || 5;
  
  // Публичные SearXNG инстансы
  const instances = [
    'https://searx.be',
    'https://search.ononoki.org',
    'https://searx.tiekoetter.com',
  ];
  
  for (const instance of instances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(options.timeout || 8000),
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.results && Array.isArray(data.results)) {
        return data.results.slice(0, maxResults).map((r: any) => ({
          title: r.title || r.url,
          url: r.url,
          snippet: r.content || '',
          source: 'SearXNG',
        }));
      }
    } catch (error) {
      console.log(`[WebSearch] SearXNG ${instance} failed:`, error);
    }
  }
  
  return [];
}

/**
 * Поиск через Google (с прокси)
 */
async function searchGoogle(query: string, options: SearchOptions, proxy: string): Promise<SearchResult[]> {
  const maxResults = options.maxResults || 5;
  const lang = options.language || 'en';
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${lang}&num=${maxResults + 5}`;
  
  const response = await fetch(proxy + encodeURIComponent(url), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(options.timeout || 10000),
  });
  
  if (!response.ok) {
    throw new Error(`Google returned ${response.status}`);
  }
  
  const html = await response.text();
  const results: SearchResult[] = [];
  
  // Парсинг Google результатов
  const resultRegex = /<a[^>]*href="\/url\?q=([^"&]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?(?:<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;
  
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    try {
      const url = decodeURIComponent(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3] ? match[3].replace(/<[^>]+>/g, '').trim() : '';
      
      if (url.startsWith('http') && !url.includes('google.com')) {
        results.push({
          title,
          url,
          snippet,
          source: 'Google',
        });
      }
    } catch {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Основная функция поиска
 */
export async function webSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  if (!query.trim()) {
    return {
      success: false,
      results: [],
      query,
      source: 'none',
      error: 'Пустой поисковый запрос',
    };
  }
  
  // Проверяем кэш
  const cacheKey = `${query}_${options.maxResults || 5}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[WebSearch] Результаты из кэша для: ${query}`);
    return { ...cached.results, cached: true };
  }
  
  console.log(`[WebSearch] Поиск: ${query}`);
  
  // Стратегия 1: SearXNG (без прокси, JSON API)
  try {
    const results = await searchSearXNG(query, options);
    if (results.length > 0) {
      const response: SearchResponse = {
        success: true,
        results,
        query,
        source: 'SearXNG',
      };
      searchCache.set(cacheKey, { results: response, timestamp: Date.now() });
      return response;
    }
  } catch (error) {
    console.log('[WebSearch] SearXNG failed, trying DuckDuckGo...');
  }
  
  // Стратегия 2: DuckDuckGo через прокси
  const proxy = await getWorkingProxy();
  if (proxy) {
    try {
      const results = await searchDuckDuckGo(query, options, proxy);
      if (results.length > 0) {
        const response: SearchResponse = {
          success: true,
          results,
          query,
          source: 'DuckDuckGo',
        };
        searchCache.set(cacheKey, { results: response, timestamp: Date.now() });
        return response;
      }
    } catch (error) {
      console.log('[WebSearch] DuckDuckGo failed, trying Google...');
    }
    
    // Стратегия 3: Google через прокси
    try {
      const results = await searchGoogle(query, options, proxy);
      if (results.length > 0) {
        const response: SearchResponse = {
          success: true,
          results,
          query,
          source: 'Google',
        };
        searchCache.set(cacheKey, { results: response, timestamp: Date.now() });
        return response;
      }
    } catch (error) {
      console.log('[WebSearch] Google failed:', error);
    }
  }
  
  return {
    success: false,
    results: [],
    query,
    source: 'none',
    error: 'Все поисковые провайдеры недоступны. Проверьте интернет-соединение.',
  };
}

/**
 * Получить содержимое страницы
 */
export async function fetchPageContent(url: string, options: { maxLength?: number } = {}): Promise<string> {
  const maxLength = options.maxLength || 5000;
  const proxy = await getWorkingProxy();
  
  if (!proxy) {
    throw new Error('Нет доступных CORS-прокси');
  }
  
  const response = await fetch(proxy + encodeURIComponent(url), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  
  if (!response.ok) {
    throw new Error(`Не удалось загрузить страницу: ${response.status}`);
  }
  
  const html = await response.text();
  
  // Извлекаем текст из HTML
  const text = html
    // Удаляем скрипты и стили
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Удаляем комментарии
    .replace(/<!--[\s\S]*?-->/g, '')
    // Удаляем теги
    .replace(/<[^>]+>/g, ' ')
    // Декодируем HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Нормализуем пробелы
    .replace(/\s+/g, ' ')
    .trim();
  
  return text.slice(0, maxLength);
}

/**
 * Очистить кэш поиска
 */
export function clearSearchCache(): void {
  searchCache.clear();
  console.log('[WebSearch] Кэш очищен');
}

/**
 * Получить статус сервиса
 */
export async function getSearchServiceStatus(): Promise<{
  available: boolean;
  proxy: string | null;
  searxng: boolean;
  cacheSize: number;
}> {
  const proxy = await getWorkingProxy();
  
  // Проверяем SearXNG
  let searxng = false;
  try {
    const results = await searchSearXNG('test', { maxResults: 1, timeout: 5000 });
    searxng = results.length > 0;
  } catch {
    // SearXNG недоступен
  }
  
  return {
    available: proxy !== null || searxng,
    proxy,
    searxng,
    cacheSize: searchCache.size,
  };
}

/**
 * Форматировать результаты для AI контекста
 */
export function formatSearchResultsForAI(response: SearchResponse): string {
  if (!response.success || response.results.length === 0) {
    return `❌ Поиск не дал результатов: ${response.error || 'Нет данных'}`;
  }
  
  let formatted = `🔍 Результаты веб-поиска по запросу "${response.query}" (${response.source}):\n\n`;
  
  response.results.forEach((result, index) => {
    formatted += `${index + 1}. **${result.title}**\n`;
    formatted += `   📎 ${result.url}\n`;
    if (result.snippet) {
      formatted += `   ${result.snippet}\n`;
    }
    formatted += '\n';
  });
  
  return formatted;
}
