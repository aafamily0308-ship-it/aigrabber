import { useState } from "react";
import { 
  Moon, 
  Sun,
  Database,
  Shield,
  Trash2,
  Download,
  Info,
  Palette,
  Sliders,
  User,
  Eye,
  EyeOff,
  Plus,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useChatStore } from "@/stores/chatStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSettingsStore, AccentColor, ThemeMode } from "@/stores/settingsStore";
import { useAuditStore } from "@/stores/auditStore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const accentColors: { id: AccentColor; name: string; color: string }[] = [
  { id: 'cyan', name: 'Cyan', color: 'bg-cyan-500' },
  { id: 'purple', name: 'Purple', color: 'bg-purple-500' },
  { id: 'green', name: 'Green', color: 'bg-green-500' },
  { id: 'orange', name: 'Orange', color: 'bg-orange-500' },
  { id: 'pink', name: 'Pink', color: 'bg-pink-500' },
  { id: 'blue', name: 'Blue', color: 'bg-blue-500' },
];

export default function Settings() {
  const { toast } = useToast();
  const [newProfileName, setNewProfileName] = useState('');
  
  const { conversations, clearConversations } = useChatStore();
  const { documents } = useKnowledgeStore();
  const { providers } = useProviderStore();
  const { entries } = useAuditStore();
  
  const {
    theme,
    accentColor,
    fontSize,
    highContrast,
    reducedMotion,
    temperature,
    maxTokens,
    topP,
    smartRouter,
    profiles,
    setTheme,
    setAccentColor,
    setFontSize,
    setHighContrast,
    setReducedMotion,
    setTemperature,
    setMaxTokens,
    setTopP,
    setSmartRouter,
    addProfile,
    deleteProfile,
    applyProfile,
  } = useSettingsStore();

  const {
    paranoidMode,
    showDataPreview,
    setParanoidMode,
    setShowDataPreview,
  } = useAuditStore();

  const handleExportData = () => {
    const data = {
      conversations,
      documents,
      providers,
      auditEntries: entries,
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

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    addProfile({
      name: newProfileName,
      theme,
      accentColor,
      fontSize,
    });
    setNewProfileName('');
    toast({
      title: "Profile Created",
      description: `Profile "${newProfileName}" has been saved.`,
    });
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
          <Palette className="w-5 h-5" />
          Appearance
        </h2>
        <div className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2">
                    <Moon className="w-4 h-4" /> Dark
                  </span>
                </SelectItem>
                <SelectItem value="light">
                  <span className="flex items-center gap-2">
                    <Sun className="w-4 h-4" /> Light
                  </span>
                </SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Accent Color */}
          <div>
            <p className="font-medium text-foreground mb-2">Accent Color</p>
            <div className="flex gap-2">
              {accentColors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setAccentColor(color.id)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color.color,
                    accentColor === color.id && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                  )}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Font Size</p>
              <p className="text-sm text-muted-foreground">Adjust text size</p>
            </div>
            <Select value={fontSize} onValueChange={(v) => setFontSize(v as 'small' | 'medium' | 'large')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">High Contrast</p>
              <p className="text-sm text-muted-foreground">Increase contrast for accessibility</p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Reduced Motion</p>
              <p className="text-sm text-muted-foreground">Minimize animations</p>
            </div>
            <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
          </div>
        </div>
      </section>

      {/* AI Parameters */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sliders className="w-5 h-5" />
          AI Parameters
        </h2>
        <div className="space-y-6">
          {/* Temperature */}
          <div>
            <div className="flex justify-between mb-2">
              <p className="font-medium text-foreground">Temperature</p>
              <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lower = more focused, Higher = more creative
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex justify-between mb-2">
              <p className="font-medium text-foreground">Max Tokens</p>
              <span className="text-sm text-muted-foreground">{maxTokens}</span>
            </div>
            <Slider
              value={[maxTokens]}
              onValueChange={([v]) => setMaxTokens(v)}
              min={256}
              max={8192}
              step={256}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum length of AI responses
            </p>
          </div>

          {/* Top P */}
          <div>
            <div className="flex justify-between mb-2">
              <p className="font-medium text-foreground">Top P</p>
              <span className="text-sm text-muted-foreground">{topP.toFixed(1)}</span>
            </div>
            <Slider
              value={[topP]}
              onValueChange={([v]) => setTopP(v)}
              min={0.1}
              max={1}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nucleus sampling threshold
            </p>
          </div>

          {/* Smart Router */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="font-medium text-foreground">Smart Router</p>
              <p className="text-sm text-muted-foreground">Auto-select best model for task</p>
            </div>
            <Switch checked={smartRouter} onCheckedChange={setSmartRouter} />
          </div>
        </div>
      </section>

      {/* Privacy & Security */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-success" />
          Privacy & Security
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

          {/* Paranoid Mode */}
          <div className="flex items-center justify-between p-4 bg-warning/10 rounded-lg border border-warning/20">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-warning" />
                Paranoid Mode
              </p>
              <p className="text-sm text-muted-foreground">Disable all cloud AI providers</p>
            </div>
            <Switch checked={paranoidMode} onCheckedChange={setParanoidMode} />
          </div>

          {/* Data Preview */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                {showDataPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Data Preview
              </p>
              <p className="text-sm text-muted-foreground">Show data before sending to cloud</p>
            </div>
            <Switch checked={showDataPreview} onCheckedChange={setShowDataPreview} />
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

      {/* Profiles */}
      <section className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Settings Profiles
        </h2>
        <div className="space-y-4">
          {/* Create Profile */}
          <div className="flex gap-2">
            <Input
              placeholder="Profile name..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleCreateProfile} disabled={!newProfileName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Save Current
            </Button>
          </div>

          {/* Profile List */}
          {profiles.length > 0 && (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.theme} • {profile.accentColor} • {profile.fontSize}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => applyProfile(profile.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Apply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteProfile(profile.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <p><strong className="text-foreground">AI Command Center</strong> v2.0.0</p>
          <p>A unified dashboard for managing AI agents with privacy controls.</p>
          <p className="pt-2">
            Supports local AI (Ollama, LM Studio) and cloud AI (Gemini, GPT-5).
          </p>
        </div>
      </section>
    </div>
  );
}
