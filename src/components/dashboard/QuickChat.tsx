import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamAI } from "@/lib/localAIClient";
import { useSettingsStore } from "@/stores/settingsStore";

export function QuickChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { cloudApiKeys } = useSettingsStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Use local Ollama by default for QuickChat (fast, private)
      const allMessages = [...messages, userMessage].map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      }));

      let assistantContent = "";
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      await streamAI({
        provider: 'local-ollama',
        messages: allMessages,
        apiKey: cloudApiKeys.google, // Fallback if needed
        onToken: (token) => {
          assistantContent += token;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent };
            return newMessages;
          });
        },
        onError: (error) => {
          // If Ollama fails, show error message
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { 
              role: 'assistant', 
              content: `⚠️ ${error.message}. Make sure Ollama is running, or use full Chat for cloud AI.`
            };
            return newMessages;
          });
        },
        onComplete: () => {
          // Done
        },
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-xl p-5 flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Chat</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/chat')}
          className="text-primary hover:text-primary/80"
        >
          Open Full Chat →
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Ask anything to get started...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.content || (isLoading && msg.role === 'assistant' && <Loader2 className="w-4 h-4 animate-spin" />)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-input border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
