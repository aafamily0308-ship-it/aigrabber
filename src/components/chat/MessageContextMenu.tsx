import { Copy, RefreshCw, Edit, Download, Star } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';

interface MessageContextMenuProps {
  children: React.ReactNode;
  content: string;
  role: 'user' | 'assistant';
  onRegenerate?: () => void;
  onEdit?: () => void;
}

export function MessageContextMenu({
  children,
  content,
  role,
  onRegenerate,
  onEdit,
}: MessageContextMenuProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard',
    });
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: 'Message saved as markdown file',
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </ContextMenuItem>
        {role === 'user' && onEdit && (
          <ContextMenuItem onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit & Resend
          </ContextMenuItem>
        )}
        {role === 'assistant' && onRegenerate && (
          <ContextMenuItem onClick={onRegenerate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export as Markdown
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
