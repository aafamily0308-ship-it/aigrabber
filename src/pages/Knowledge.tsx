import { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Trash2, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  BookOpen,
  Eye,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKnowledgeStore, Document } from "@/stores/knowledgeStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { parseDocument } from "@/lib/documentParser";
import { indexDocument, removeFromIndex } from "@/lib/ragPipeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Knowledge() {
  const [dragActive, setDragActive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const {
    documents,
    selectedDocuments,
    searchQuery,
    addDocument,
    updateDocumentStatus,
    updateDocumentChunks,
    removeDocument,
    toggleDocumentSelection,
    setSearchQuery,
  } = useKnowledgeStore();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validTypes = ['pdf', 'txt', 'md', 'epub', 'docx'];
    
    if (!extension || !validTypes.includes(extension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, TXT, MD, EPUB, or DOCX files.",
        variant: "destructive",
      });
      return;
    }

    const docId = addDocument({
      name: file.name,
      type: extension as Document['type'],
      size: file.size,
      status: 'processing',
    });

    try {
      // Use the document parser for all file types
      const parsed = await parseDocument(file);
      
      updateDocumentStatus(docId, 'ready', parsed.text);
      updateDocumentChunks(docId, parsed.chunks);
      
      // Index document for RAG
      try {
        await indexDocument({
          id: docId,
          name: file.name,
          content: parsed.text,
          metadata: { type: extension, size: file.size },
        });
      } catch (indexError) {
        console.warn('RAG indexing failed:', indexError);
      }
      
      toast({
        title: "Document added",
        description: `${file.name} is ready. ${parsed.wordCount} words extracted and indexed for RAG.`,
      });
    } catch (error) {
      console.error('Document parsing error:', error);
      updateDocumentStatus(docId, 'error');
      toast({
        title: "Error processing file",
        description: error instanceof Error ? error.message : "Could not read the file content.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await processFile(file);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Upload documents to enhance AI responses</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {documents.length} documents • {selectedDocuments.length} selected
          </span>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all",
          dragActive 
            ? "border-primary bg-primary/10" 
            : "border-border hover:border-muted-foreground"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.epub,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              Drop files here or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports PDF, TXT, MD, EPUB, DOCX • Processed locally in your browser
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload files to build your knowledge base</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "glass rounded-xl p-4 cursor-pointer transition-all hover:border-primary/40",
                selectedDocuments.includes(doc.id) && "border-primary bg-primary/5"
              )}
              onClick={() => toggleDocumentSelection(doc.id)}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  doc.type === 'pdf' ? "bg-red-500/20" :
                  doc.type === 'md' ? "bg-blue-500/20" :
                  doc.type === 'txt' ? "bg-gray-500/20" :
                  doc.type === 'docx' ? "bg-blue-600/20" :
                  "bg-purple-500/20"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    doc.type === 'pdf' ? "text-red-400" :
                    doc.type === 'md' ? "text-blue-400" :
                    doc.type === 'txt' ? "text-gray-400" :
                    doc.type === 'docx' ? "text-blue-500" :
                    "text-purple-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{doc.type.toUpperCase()}</span>
                    {doc.chunks && doc.chunks.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{doc.chunks.length} chunks</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.status === 'processing' && (
                    <Loader2 className="w-4 h-4 text-warning animate-spin" />
                  )}
                  {doc.status === 'ready' && (
                    <CheckCircle className="w-4 h-4 text-success" />
                  )}
                  {doc.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewDoc(doc);
                    }}
                  >
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Remove from RAG index first
                      try {
                        await removeFromIndex(doc.id);
                      } catch (err) {
                        console.warn('Failed to remove from index:', err);
                      }
                      removeDocument(doc.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
              {previewDoc?.content || 'No content available'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
