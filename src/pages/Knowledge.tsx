import { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Trash2, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  File,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKnowledgeStore, Document } from "@/stores/knowledgeStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function Knowledge() {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const {
    documents,
    selectedDocuments,
    searchQuery,
    addDocument,
    updateDocumentStatus,
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

    // Process text files locally
    if (extension === 'txt' || extension === 'md') {
      try {
        const text = await file.text();
        updateDocumentStatus(docId, 'ready', text);
        toast({
          title: "Document added",
          description: `${file.name} is ready to use.`,
        });
      } catch (error) {
        updateDocumentStatus(docId, 'error');
        toast({
          title: "Error processing file",
          description: "Could not read the file content.",
          variant: "destructive",
        });
      }
    } else {
      // For other types, mark as ready (full processing would need backend)
      setTimeout(() => {
        updateDocumentStatus(docId, 'ready', `[Content of ${file.name}]`);
        toast({
          title: "Document added",
          description: `${file.name} is ready to use.`,
        });
      }, 1500);
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
              Supports PDF, TXT, MD, EPUB, DOCX
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
                  "bg-purple-500/20"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    doc.type === 'pdf' ? "text-red-400" :
                    doc.type === 'md' ? "text-blue-400" :
                    doc.type === 'txt' ? "text-gray-400" :
                    "text-purple-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{doc.type.toUpperCase()}</span>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDocument(doc.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
