import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Send, 
  Loader2, 
  Plus, 
  Trash2, 
  Copy, 
  Check,
  Cpu,
  Cloud,
  Shield,
  ChevronDown,
  FileText,
  Settings2,
  Zap,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore, ProviderType } from "@/stores/chatStore";
import { usePromptsStore } from "@/stores/promptsStore";
import { useAuditStore } from "@/stores/auditStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { VoiceInput } from "@/components/chat/VoiceInput";
import { DocumentAttach } from "@/components/chat/DocumentAttach";
import { DataPreviewModal } from "@/components/chat/DataPreviewModal";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { detectSensitiveData } from "@/lib/sensitiveDetector";
import { estimateTokens } from "@/lib/documentParser";
import { streamAI, isLocalProvider, needsApiKey, AIProvider } from "@/lib/localAIClient";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { ProviderHealthIndicator } from "@/components/ProviderHealthIndicator";
import { ContextStatsDisplay } from "@/components/ContextStatsDisplay";
import { orchestrate } from "@/lib/modelOrchestrator";
import { buildContextWindow, ContextMessage, getContextStats } from "@/lib/contextManager";
import { getOnlineProviders } from "@/lib/providerHealthMonitor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const providerOptions: { id: ProviderType; name: string; icon: typeof Cloud; type: 'local' | 'cloud' }[] = [
  { id: 'local-ollama', name: 'Ollama (Local)', icon: Cpu, type: 'local' },
  { id: 'local-lmstudio', name: 'LM Studio (Local)', icon: Cpu, type: 'local' },
  { id: 'cloud-gemini', name: 'Google AI (Gemini)', icon: Cloud, type: 'cloud' },
  { id: 'cloud-gpt5', name: 'OpenAI (GPT-4o)', icon: Cloud, type: 'cloud' },
  { id: 'cloud-anthropic' as ProviderType, name: 'Anthropic (Claude)', icon: Cloud, type: 'cloud' },
];

export default function Chat() {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [autoSelectProvider, setAutoSelectProvider] = useState(true);
  const [lastOrchestration, setLastOrchestration] = useState<{ taskType: string; reasoning: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const {
    conversations,
    activeConversationId,
    isStreaming,
    selectedProvider,
    createConversation,
    setActiveConversation,
    addMessage,
    updateLastMessage,
    setIsStreaming,
    setSelectedProvider,
    deleteConversation,
  } = useChatStore();

  const { prompts } = usePromptsStore();
  const { addEntry, paranoidMode, showDataPreview: alwaysShowPreview } = useAuditStore();
  const { temperature, maxTokens, cloudApiKeys } = useSettingsStore();
  const { documents } = useKnowledgeStore();
  const { isOnline } = useNetworkStatus();

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
  const isCloudProvider = !selectedProvider.startsWith('local-');
  const providerNeedsKey = needsApiKey(selectedProvider as any);
  const hasRequiredKey = !providerNeedsKey || 
    (selectedProvider.includes('openai') || selectedProvider === 'cloud-gpt5' ? cloudApiKeys.openai :
     selectedProvider.includes('google') || selectedProvider === 'cloud-gemini' ? cloudApiKeys.google :
     selectedProvider.includes('anthropic') ? cloudApiKeys.anthropic : false);

  // Calculate context stats
  const contextStats = useMemo(() => {
    if (!activeConversation?.messages.length) {
      return { usedTokens: 0, maxTokens: maxTokens || 4096, messageCount: 0 };
    }
    
    const contextMessages: ContextMessage[] = activeConversation.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()),
      priority: msg.role === 'system' ? 'high' as const : 'medium' as const,
    }));
    
    const lastUserMessage = activeConversation.messages.filter(m => m.role === 'user').pop();
    const contextWindow = buildContextWindow(
      contextMessages, 
      lastUserMessage?.content || '', 
      selectedPrompt?.content
    );
    const stats = getContextStats(contextWindow);
    
    return {
      usedTokens: stats.used,
      maxTokens: contextWindow.maxTokens,
      messageCount: stats.messageCount,
    };
  }, [activeConversation?.messages, selectedPrompt?.content, maxTokens]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  useEffect(() => {
    if (conversations.length === 0) {
      createConversation();
    } else if (!activeConversationId) {
      setActiveConversation(conversations[0].id);
    }
  }, []);

  // Block cloud providers if paranoid mode is on
  useEffect(() => {
    if (paranoidMode && isCloudProvider) {
      setSelectedProvider('local-ollama');
      toast({
        title: "Paranoid Mode Active",
        description: "Switched to local provider. Cloud providers are disabled.",
        variant: "default",
      });
    }
  }, [paranoidMode, isCloudProvider]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVoiceTranscript = (text: string) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
  };

  const buildContextFromDocs = () => {
    if (attachedDocIds.length === 0) return '';
    
    const attachedDocs = documents.filter(d => attachedDocIds.includes(d.id));
    if (attachedDocs.length === 0) return '';

    let context = '\n\n---\n**Attached Documents:**\n';
    attachedDocs.forEach(doc => {
      if (doc.content) {
        context += `\n### ${doc.name}\n${doc.content.slice(0, 4000)}\n`;
      }
    });
    return context;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    
    // Check if cloud provider and show preview
    if (isCloudProvider && alwaysShowPreview) {
      setPendingMessage(userMessage);
      setShowDataPreview(true);
      return;
    }

    await sendMessage(userMessage);
  };

  const sendMessage = async (userMessage: string) => {
    setInput("");
    setPendingMessage(null);

    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation();
    }

    // Add document context if attached
    const docContext = buildContextFromDocs();
    const fullMessage = userMessage + docContext;

    // Determine provider - use orchestrator if auto-select is enabled
    let providerToUse = selectedProvider;
    const conversationHistory = activeConversation?.messages.map(m => m.content) || [];
    
    if (autoSelectProvider && !paranoidMode) {
      // Get available providers (online ones)
      const onlineProviders = getOnlineProviders();
      const availableProviders = onlineProviders.length > 0 
        ? onlineProviders 
        : ['local-ollama', 'local-lmstudio'] as AIProvider[];
      
      // Use orchestrator to select best provider
      const orchestration = orchestrate(fullMessage, conversationHistory, availableProviders, {
        preferLocal: true,
        fallbackToCloud: isOnline,
      });
      
      providerToUse = orchestration.selectedProvider as ProviderType;
      setSelectedProvider(providerToUse);
      setLastOrchestration({
        taskType: orchestration.taskType,
        reasoning: orchestration.reasoning,
      });
      
      // Show toast with selection info
      toast({
        title: `🧠 ${orchestration.taskType} detected`,
        description: orchestration.reasoning,
      });
    } else {
      setLastOrchestration(null);
    }

    const isCloudProviderSelected = !providerToUse.startsWith('local-');
    addMessage(convId, { role: 'user', content: userMessage, provider: providerToUse });
    setIsStreaming(true);

    // Log to audit
    const sensitiveData = detectSensitiveData(fullMessage);
    addEntry({
      action: 'chat_request',
      provider: providerToUse,
      providerType: isCloudProviderSelected ? 'cloud' : 'local',
      tokensUsed: estimateTokens(fullMessage),
      dataSize: new Blob([fullMessage]).size,
      sensitiveDataDetected: sensitiveData.length > 0,
      details: `Provider: ${providerToUse}, Auto: ${autoSelectProvider}, Docs: ${attachedDocIds.length}`,
    });

    try {
      const currentConv = useChatStore.getState().conversations.find(c => c.id === convId);
      const messagesToSend = currentConv?.messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })) || [];
      messagesToSend.push({ role: 'user', content: fullMessage });

      addMessage(convId!, { role: 'assistant', content: '', provider: providerToUse });

      // Determine API key for cloud providers
      let apiKey: string | undefined;
      if (providerToUse === 'cloud-gemini' || providerToUse === 'cloud-google' as any) {
        apiKey = cloudApiKeys.google;
      } else if (providerToUse === 'cloud-gpt5' || providerToUse === 'cloud-openai' as any) {
        apiKey = cloudApiKeys.openai;
      } else if (providerToUse === 'cloud-anthropic' as any) {
        apiKey = cloudApiKeys.anthropic;
      }

      let assistantContent = "";

      await streamAI({
        provider: providerToUse as any,
        messages: messagesToSend,
        apiKey,
        temperature,
        maxTokens,
        systemPrompt: selectedPrompt?.content,
        onToken: (token) => {
          assistantContent += token;
          updateLastMessage(convId!, assistantContent);
        },
        onError: (error) => {
          updateLastMessage(convId!, `⚠️ ${error.message}`);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
        onComplete: () => {
          // Done
        },
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setAttachedDocIds([]);
    }
  };

  const handleDataPreviewConfirm = (data: string) => {
    setShowDataPreview(false);
    sendMessage(data);
  };

  const currentProvider = providerOptions.find(p => p.id === selectedProvider);

  return (
    <div className="flex h-screen">
      {/* Sidebar - Conversations */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-4">
          <Button 
            onClick={() => createConversation()} 
            className="w-full gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                conv.id === activeConversationId
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50"
              )}
              onClick={() => setActiveConversation(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {conv.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {conv.messages.length} messages
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">AI Chat</h1>
            <NetworkStatusIndicator />
            <ProviderHealthIndicator />
            <ContextStatsDisplay 
              usedTokens={contextStats.usedTokens}
              maxTokens={contextStats.maxTokens}
              messageCount={contextStats.messageCount}
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-select toggle */}
            <Button
              variant={autoSelectProvider ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setAutoSelectProvider(!autoSelectProvider)}
            >
              <Brain className="w-4 h-4" />
              {autoSelectProvider ? "Auto" : "Manual"}
            </Button>

            {/* Last orchestration info */}
            {lastOrchestration && autoSelectProvider && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {lastOrchestration.taskType}
              </Badge>
            )}

            {/* System Prompt Selector */}
            <Select
              value={selectedPromptId || 'none'}
              onValueChange={(v) => setSelectedPromptId(v === 'none' ? null : v)}
            >
              <SelectTrigger className="w-40">
                <Settings2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="System Prompt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default</SelectItem>
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Provider Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={autoSelectProvider}>
                  {currentProvider && (
                    <>
                      <currentProvider.icon className="w-4 h-4" />
                      {autoSelectProvider ? "Auto" : currentProvider.name}
                      {currentProvider.type === 'local' && !autoSelectProvider && (
                        <Shield className="w-3 h-3 text-success ml-1" />
                      )}
                    </>
                  )}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Local (Private)</DropdownMenuLabel>
                {providerOptions.filter(p => p.type === 'local').map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => {
                      setAutoSelectProvider(false);
                      setSelectedProvider(provider.id);
                    }}
                    className={cn(selectedProvider === provider.id && "bg-primary/10")}
                  >
                    <provider.icon className="w-4 h-4 mr-2" />
                    {provider.name}
                    <Shield className="w-3 h-3 text-success ml-auto" />
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Cloud {paranoidMode && "(Disabled)"}</DropdownMenuLabel>
                {providerOptions.filter(p => p.type === 'cloud').map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => {
                      if (!paranoidMode) {
                        setAutoSelectProvider(false);
                        setSelectedProvider(provider.id);
                      }
                    }}
                    className={cn(
                      selectedProvider === provider.id && "bg-primary/10",
                      paranoidMode && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={paranoidMode}
                  >
                    <provider.icon className="w-4 h-4 mr-2" />
                    {provider.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-4">
                <Cloud className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Start a conversation</h2>
              <p className="text-muted-foreground max-w-md">
                Choose a provider above and start chatting. Local providers keep your data private, 
                cloud providers offer more powerful models.
              </p>
              {selectedPrompt && (
                <p className="text-sm text-primary mt-2">
                  Using prompt: {selectedPrompt.name}
                </p>
              )}
            </div>
          ) : (
            activeConversation.messages.map((msg) => (
              <MessageContextMenu
                key={msg.id}
                content={msg.content}
                role={msg.role as 'user' | 'assistant'}
                onRegenerate={msg.role === 'assistant' ? () => {
                  // Find last user message and resend
                  const userMessages = activeConversation.messages.filter(m => m.role === 'user');
                  const lastUserMsg = userMessages[userMessages.length - 1];
                  if (lastUserMsg) {
                    setInput(lastUserMsg.content);
                  }
                } : undefined}
              >
                <div
                  className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-xl px-4 py-3 group relative",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "glass"
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content || ''} />
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none">
                        {msg.content}
                      </div>
                    )}
                    {!msg.content && isStreaming && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {msg.role === 'assistant' && msg.content && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-10 top-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={() => handleCopy(msg.content, msg.id)}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </MessageContextMenu>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          {/* Attached docs indicator */}
          {attachedDocIds.length > 0 && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              {attachedDocIds.length} document(s) attached
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
            <DocumentAttach
              attachedDocIds={attachedDocIds}
              onAttach={setAttachedDocIds}
              disabled={isStreaming}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${currentProvider?.name || 'AI'}...`}
              className="flex-1 bg-input border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              disabled={isStreaming}
            />
            <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />
            <Button 
              type="submit" 
              size="lg"
              disabled={isStreaming || !input.trim()}
              className="px-6"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-2">
            {selectedProvider.startsWith('local-') ? (
              <span className="flex items-center justify-center gap-1">
                <Shield className="w-3 h-3 text-success" />
                Data stays on your device
              </span>
            ) : (
              "Messages are sent to cloud AI providers"
            )}
          </p>
        </div>
      </div>

      {/* Data Preview Modal */}
      <DataPreviewModal
        isOpen={showDataPreview}
        onClose={() => {
          setShowDataPreview(false);
          setPendingMessage(null);
        }}
        onConfirm={handleDataPreviewConfirm}
        data={pendingMessage || ''}
        provider={currentProvider?.name || 'Cloud AI'}
      />
    </div>
  );
}
