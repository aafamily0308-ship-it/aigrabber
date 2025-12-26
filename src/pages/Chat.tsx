import { useState, useRef, useEffect } from "react";
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
  Settings2
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

const providerOptions: { id: ProviderType; name: string; icon: typeof Cloud; type: 'local' | 'cloud' }[] = [
  { id: 'local-ollama', name: 'Ollama (Local)', icon: Cpu, type: 'local' },
  { id: 'local-lmstudio', name: 'LM Studio (Local)', icon: Cpu, type: 'local' },
  { id: 'cloud-gemini', name: 'Gemini 2.5 Flash', icon: Cloud, type: 'cloud' },
  { id: 'cloud-gpt5', name: 'GPT-5', icon: Cloud, type: 'cloud' },
];

export default function Chat() {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
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
  const { temperature, maxTokens } = useSettingsStore();
  const { documents } = useKnowledgeStore();

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
  const isCloudProvider = !selectedProvider.startsWith('local-');

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

    addMessage(convId, { role: 'user', content: userMessage, provider: selectedProvider });
    setIsStreaming(true);

    // Log to audit
    const sensitiveData = detectSensitiveData(fullMessage);
    addEntry({
      action: 'chat_request',
      provider: selectedProvider,
      providerType: isCloudProvider ? 'cloud' : 'local',
      tokensUsed: estimateTokens(fullMessage),
      dataSize: new Blob([fullMessage]).size,
      sensitiveDataDetected: sensitiveData.length > 0,
      details: `Provider: ${selectedProvider}, Docs attached: ${attachedDocIds.length}`,
    });

    try {
      const currentConv = useChatStore.getState().conversations.find(c => c.id === convId);
      const messagesToSend = currentConv?.messages.map(m => ({ role: m.role, content: m.content })) || [];
      messagesToSend.push({ role: 'user', content: fullMessage });

      const isLocal = selectedProvider.startsWith('local-');
      
      if (isLocal) {
        const endpoint = selectedProvider === 'local-ollama' 
          ? 'http://localhost:11434/api/chat'
          : 'http://localhost:1234/v1/chat/completions';

        try {
          addMessage(convId!, { role: 'assistant', content: '', provider: selectedProvider });
          
          if (selectedProvider === 'local-ollama') {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'llama3.2',
                messages: selectedPrompt 
                  ? [{ role: 'system', content: selectedPrompt.content }, ...messagesToSend]
                  : messagesToSend,
                stream: true,
                options: {
                  temperature,
                  num_predict: maxTokens,
                }
              }),
            });

            if (!response.ok) throw new Error('Ollama not available');
            
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            let assistantContent = "";
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter(Boolean);

              for (const line of lines) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.message?.content) {
                    assistantContent += parsed.message.content;
                    updateLastMessage(convId!, assistantContent);
                  }
                } catch {}
              }
            }
          } else {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'local-model',
                messages: selectedPrompt 
                  ? [{ role: 'system', content: selectedPrompt.content }, ...messagesToSend]
                  : messagesToSend,
                stream: true,
                temperature,
                max_tokens: maxTokens,
              }),
            });

            if (!response.ok) throw new Error('LM Studio not available');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            let assistantContent = "";
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      assistantContent += content;
                      updateLastMessage(convId!, assistantContent);
                    }
                  } catch {}
                }
              }
            }
          }
        } catch (error) {
          console.error('Local AI error:', error);
          updateLastMessage(convId!, `⚠️ Local AI not available. Make sure ${selectedProvider === 'local-ollama' ? 'Ollama' : 'LM Studio'} is running.`);
        }
      } else {
        addMessage(convId!, { role: 'assistant', content: '', provider: selectedProvider });

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: messagesToSend,
            provider: selectedProvider,
            systemPrompt: selectedPrompt?.content,
            temperature,
            maxTokens,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment.');
          }
          if (response.status === 402) {
            throw new Error('AI credits exhausted. Please add more credits.');
          }
          throw new Error('Cloud AI error');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        let assistantContent = "";
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                updateLastMessage(convId!, assistantContent);
              }
            } catch {}
          }
        }
      }
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
          <h1 className="text-xl font-semibold text-foreground">AI Chat</h1>
          
          <div className="flex items-center gap-3">
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
                <Button variant="outline" className="gap-2">
                  {currentProvider && (
                    <>
                      <currentProvider.icon className="w-4 h-4" />
                      {currentProvider.name}
                      {currentProvider.type === 'local' && (
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
                    onClick={() => setSelectedProvider(provider.id)}
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
                    onClick={() => !paranoidMode && setSelectedProvider(provider.id)}
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
