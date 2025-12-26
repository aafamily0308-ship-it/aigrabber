import { Paperclip, X, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKnowledgeStore, Document } from '@/stores/knowledgeStore';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocumentAttachProps {
  attachedDocIds: string[];
  onAttach: (docIds: string[]) => void;
  disabled?: boolean;
}

export function DocumentAttach({ attachedDocIds, onAttach, disabled }: DocumentAttachProps) {
  const { documents } = useKnowledgeStore();
  const readyDocuments = documents.filter(d => d.status === 'ready');

  const toggleDocument = (docId: string) => {
    if (attachedDocIds.includes(docId)) {
      onAttach(attachedDocIds.filter(id => id !== docId));
    } else {
      onAttach([...attachedDocIds, docId]);
    }
  };

  const attachedDocs = documents.filter(d => attachedDocIds.includes(d.id));

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || readyDocuments.length === 0}
            className={cn(
              'relative',
              attachedDocIds.length > 0 && 'text-primary'
            )}
          >
            <Paperclip className="w-5 h-5" />
            {attachedDocIds.length > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
              >
                {attachedDocIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Attach Documents</h4>
              {attachedDocIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAttach([])}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
            
            {readyDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No documents available. Upload documents in Knowledge Base first.
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {readyDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => toggleDocument(doc.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                        attachedDocIds.includes(doc.id)
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <FileText className={cn(
                        'w-4 h-4 flex-shrink-0',
                        attachedDocIds.includes(doc.id) ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type.toUpperCase()} • {formatFileSize(doc.size)}
                        </p>
                      </div>
                      {attachedDocIds.includes(doc.id) && (
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Show attached docs inline */}
      {attachedDocs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {attachedDocs.slice(0, 2).map((doc) => (
            <Badge
              key={doc.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1"
            >
              <span className="max-w-20 truncate text-xs">{doc.name}</span>
              <button
                onClick={() => toggleDocument(doc.id)}
                className="hover:bg-background/50 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {attachedDocs.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{attachedDocs.length - 2} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
