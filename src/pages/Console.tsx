import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProviderStore } from '@/stores/providerStore';
import { useChatStore } from '@/stores/chatStore';
import { 
  parseCommand, 
  executeCommand, 
  navigateHistory, 
  getAutocompleteSuggestions,
  type ConsoleContext 
} from '@/lib/consoleMode';
import { providerRegistry } from '@/lib/providers';
import { cn } from '@/lib/utils';

interface ConsoleLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'ai';
  content: string;
  timestamp: Date;
}

const Console: React.FC = () => {
  const [lines, setLines] = useState<ConsoleLine[]>([
    {
      id: '0',
      type: 'system',
      content: `╔══════════════════════════════════════════════════════════════╗
║                    AI COMMAND CONSOLE                        ║
║                     Lite Mode v1.0                           ║
╚══════════════════════════════════════════════════════════════╝

Введите /help для списка команд или просто напишите сообщение.
Hotkeys: Ctrl+L очистить, ↑/↓ история, Tab автодополнение`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const { providers } = useProviderStore();
  const { 
    conversations, 
    activeConversationId, 
    addMessage, 
    clearConversations,
    createConversation,
    setActiveConversation 
  } = useChatStore();
  
  const currentConversation = conversations.find(c => c.id === activeConversationId);
  
  const [currentProvider, setCurrentProvider] = useState(() => {
    const online = providers.find(p => p.status === 'online' && p.isActive);
    return online?.id || providers[0]?.id || 'ollama';
  });
  
  const [currentModel, setCurrentModel] = useState(() => {
    const provider = providers.find(p => p.id === currentProvider);
    return provider?.model || 'llama3.2';
  });
  
  // Add line to console
  const addLine = useCallback((type: ConsoleLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    }]);
  }, []);
  
  // Scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);
  
  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Console context for commands
  const context: ConsoleContext = {
    currentProvider,
    currentModel,
    isStreaming,
    history: currentConversation?.messages.map(m => `[${m.role}] ${m.content}`) || [],
    setProvider: (id: string) => {
      const provider = providers.find(p => p.id === id);
      if (provider) {
        setCurrentProvider(id);
        setCurrentModel(provider.model || 'default');
      }
    },
    setModel: (model: string) => setCurrentModel(model),
    sendMessage: async (message: string) => {
      await handleSendMessage(message);
    },
    clearHistory: () => {
      clearConversations();
    },
    getProviders: () => providers.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
    })),
  };
  
  // Send message to AI
  const handleSendMessage = async (message: string) => {
    addLine('input', `> ${message}`);
    setIsStreaming(true);
    
    try {
      const provider = providerRegistry.get(currentProvider);
      if (!provider) {
        addLine('error', `Провайдер не найден: ${currentProvider}`);
        return;
      }
      
      // Check if provider is online
      const providerState = providers.find(p => p.id === currentProvider);
      if (providerState?.status !== 'online') {
        addLine('error', `Провайдер ${currentProvider} не подключён. Проверьте статус: /status`);
        return;
      }
      
      // Add user message to store
      let convId = activeConversationId;
      if (!convId) {
        convId = createConversation();
      }
      addMessage(convId, {
        role: 'user',
        content: message,
      });
      
      // Stream response
      let response = '';
      const lineId = Date.now().toString();
      
      setLines(prev => [...prev, {
        id: lineId,
        type: 'ai',
        content: '▊',
        timestamp: new Date(),
      }]);
      
      await provider.stream({
        endpoint: providerState?.endpoint || provider.defaultEndpoint,
        model: currentModel,
        messages: [
          ...(currentConversation?.messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })) || []),
          { role: 'user' as const, content: message },
        ],
        onToken: (token) => {
          response += token;
          setLines(prev => prev.map(line => 
            line.id === lineId 
              ? { ...line, content: response + '▊' }
              : line
          ));
        },
        onComplete: () => {
          setLines(prev => prev.map(line => 
            line.id === lineId 
              ? { ...line, content: response }
              : line
          ));
          
          // Add assistant message to store
          if (convId) {
            addMessage(convId, {
              role: 'assistant',
              content: response,
            });
          }
        },
        onError: (error) => {
          setLines(prev => prev.map(line => 
            line.id === lineId 
              ? { ...line, type: 'error', content: `Ошибка: ${error.message}` }
              : line
          ));
        },
      });
    } catch (error) {
      addLine('error', `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStreaming(false);
    }
  };
  
  // Handle input submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    const trimmedInput = input.trim();
    setInput('');
    setSuggestions([]);
    
    // Check if it's a command
    if (parseCommand(trimmedInput)) {
      const result = await executeCommand(trimmedInput, context);
      if (result) {
        addLine('output', result);
      }
    } else {
      // Regular message
      await handleSendMessage(trimmedInput);
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+L - clear
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setLines([{
        id: Date.now().toString(),
        type: 'system',
        content: '🗑️ Консоль очищена',
        timestamp: new Date(),
      }]);
      return;
    }
    
    // Arrow up/down - history navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        if (e.key === 'ArrowUp') {
          setSelectedSuggestion(prev => Math.max(0, prev - 1));
        } else {
          setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
        }
        return;
      }
      
      e.preventDefault();
      const historical = navigateHistory(e.key === 'ArrowUp' ? 'up' : 'down');
      if (historical) setInput(historical);
      return;
    }
    
    // Tab - autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const selected = suggestions[Math.max(0, selectedSuggestion)];
        setInput(selected + ' ');
        setSuggestions([]);
        setSelectedSuggestion(-1);
      }
      return;
    }
    
    // Enter with suggestion
    if (e.key === 'Enter' && selectedSuggestion >= 0 && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[selectedSuggestion] + ' ');
      setSuggestions([]);
      setSelectedSuggestion(-1);
      return;
    }
    
    // Escape - close suggestions
    if (e.key === 'Escape') {
      setSuggestions([]);
      setSelectedSuggestion(-1);
    }
  };
  
  // Update suggestions on input change
  useEffect(() => {
    if (input.startsWith('/')) {
      const newSuggestions = getAutocompleteSuggestions(input);
      setSuggestions(newSuggestions);
      setSelectedSuggestion(-1);
    } else {
      setSuggestions([]);
    }
  }, [input]);
  
  // Get line color based on type
  const getLineColor = (type: ConsoleLine['type']) => {
    switch (type) {
      case 'input': return 'text-primary';
      case 'output': return 'text-muted-foreground';
      case 'error': return 'text-destructive';
      case 'system': return 'text-accent-foreground';
      case 'ai': return 'text-foreground';
      default: return 'text-foreground';
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-background font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Provider:</span>
          <span className="text-primary">{currentProvider}</span>
          <span className="text-muted-foreground">Model:</span>
          <span className="text-primary">{currentModel}</span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="text-yellow-500 animate-pulse">● Streaming...</span>
          )}
          <span className="text-muted-foreground text-xs">
            {providers.filter(p => p.status === 'online').length}/{providers.length} online
          </span>
        </div>
      </div>
      
      {/* Output area */}
      <div 
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div 
            key={line.id} 
            className={cn('whitespace-pre-wrap break-words', getLineColor(line.type))}
          >
            {line.content}
          </div>
        ))}
      </div>
      
      {/* Input area */}
      <div className="relative border-t border-border">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 bg-popover border border-border rounded-t-md shadow-lg">
            {suggestions.map((suggestion, i) => (
              <div
                key={suggestion}
                className={cn(
                  'px-4 py-1 cursor-pointer hover:bg-accent',
                  i === selectedSuggestion && 'bg-accent'
                )}
                onClick={() => {
                  setInput(suggestion + ' ');
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex items-center px-4 py-3">
          <span className="text-primary mr-2">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Ожидание ответа...' : 'Введите сообщение или /help'}
            disabled={isStreaming}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
};

export default Console;
