import { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Database,
  Shield,
  Trash2,
  Download,
  Upload,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useChatStore } from "@/stores/chatStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { useProviderStore } from "@/stores/providerStore";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(true);
  const { toast } = useToast();
  
  const { conversations, clearConversations } = useChatStore();
  const { documents } = useKnowledgeStore();
  const { providers } = useProviderStore();

  const handleExportData = () => {
    const data = {
      conversations,
      documents,
      providers,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-command-center-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your data has been downloaded as JSON.",
    });
  };

  const handleClearData = () => {
    clearConversations();
    localStorage.clear();
    toast({
      title: "Data Cleared",
      description: "All local data has been removed.",
    });
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground glow-text">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your AI Command Center</p>
      </div>

      {/* Appearance */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          Appearance
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-success" />
          Privacy & Data
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Your Data is Local</p>
              <p className="text-sm text-muted-foreground mt-1">
                Chat history and documents are stored in your browser's local storage. 
                When using local AI providers (Ollama/LM Studio), your data never leaves your device.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-muted/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{conversations.length}</p>
              <p className="text-sm text-muted-foreground">Conversations</p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{documents.length}</p>
              <p className="text-sm text-muted-foreground">Documents</p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">
                {providers.filter(p => p.status === 'online').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Providers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Management
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
            <div>
              <p className="font-medium text-foreground">Export Data</p>
              <p className="text-sm text-muted-foreground">Download all your data as JSON</p>
            </div>
            <Button variant="outline" onClick={handleExportData} className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <div>
              <p className="font-medium text-foreground">Clear All Data</p>
              <p className="text-sm text-muted-foreground">Permanently delete all local data</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Clear Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your conversations, documents, and settings. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground">
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          About
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">AI Command Center</strong> v1.0.0</p>
          <p>A unified dashboard for managing AI agents with privacy controls.</p>
          <p className="pt-2">
            Supports local AI (Ollama, LM Studio) and cloud AI (Gemini, GPT-5).
          </p>
        </div>
      </section>
    </div>
  );
}
