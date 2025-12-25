import { useChatStore } from "@/stores/chatStore";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function RecentConversations() {
  const { conversations, setActiveConversation, deleteConversation } = useChatStore();
  const navigate = useNavigate();

  const recentConversations = conversations.slice(0, 5);

  const handleOpenConversation = (id: string) => {
    setActiveConversation(id);
    navigate('/chat');
  };

  return (
    <div className="glass rounded-xl p-5 h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Conversations</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/chat')}
          className="text-primary hover:text-primary/80"
        >
          View All →
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
        {recentConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={() => navigate('/chat')}
            >
              Start a conversation
            </Button>
          </div>
        ) : (
          recentConversations.map((conv) => (
            <div
              key={conv.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleOpenConversation(conv.id)}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {conv.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                  <span>•</span>
                  <span>{conv.messages.length} messages</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
