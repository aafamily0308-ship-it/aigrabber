import { useState } from 'react';
import { 
  FileText, 
  Brain, 
  Wand2,
  Plus,
  Edit,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePromptsStore, SystemPrompt } from '@/stores/promptsStore';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const categoryIcons = {
  general: Brain,
  coding: FileText,
  writing: Edit,
  analysis: Wand2,
  custom: Plus,
};

const categoryColors = {
  general: 'bg-blue-500/20 text-blue-400',
  coding: 'bg-green-500/20 text-green-400',
  writing: 'bg-purple-500/20 text-purple-400',
  analysis: 'bg-orange-500/20 text-orange-400',
  custom: 'bg-pink-500/20 text-pink-400',
};

export default function PromptsLibrary() {
  const { prompts, activePromptId, addPrompt, updatePrompt, deletePrompt, setActivePrompt } = usePromptsStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    content: '',
    category: 'custom' as SystemPrompt['category'],
  });

  const handleAdd = () => {
    if (newPrompt.name && newPrompt.content) {
      addPrompt(newPrompt);
      setNewPrompt({ name: '', content: '', category: 'custom' });
      setIsAddDialogOpen(false);
    }
  };

  const handleUpdate = () => {
    if (editingPrompt) {
      updatePrompt(editingPrompt.id, {
        name: editingPrompt.name,
        content: editingPrompt.content,
        category: editingPrompt.category,
      });
      setEditingPrompt(null);
    }
  };

  const groupedPrompts = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, SystemPrompt[]>);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text">System Prompts</h1>
          <p className="text-muted-foreground mt-1">Customize AI behavior with system prompts</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Prompt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(categoryColors).map(([category, colorClass]) => {
          const count = groupedPrompts[category]?.length || 0;
          const Icon = categoryIcons[category as keyof typeof categoryIcons];
          return (
            <div key={category} className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClass.split(' ')[0])}>
                  <Icon className={cn('w-5 h-5', colorClass.split(' ')[1])} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{category}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prompts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {prompts.map((prompt) => {
          const Icon = categoryIcons[prompt.category];
          const isActive = prompt.id === activePromptId;
          
          return (
            <div
              key={prompt.id}
              className={cn(
                'glass rounded-xl p-5 cursor-pointer transition-all group',
                isActive && 'border-primary bg-primary/5'
              )}
              onClick={() => setActivePrompt(prompt.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    categoryColors[prompt.category].split(' ')[0]
                  )}>
                    <Icon className={cn('w-5 h-5', categoryColors[prompt.category].split(' ')[1])} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{prompt.name}</h3>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">
                      {prompt.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!prompt.isDefault && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPrompt(prompt);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePrompt(prompt.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-3">
                {prompt.content}
              </p>
              
              {isActive && (
                <div className="flex items-center gap-1 mt-3 text-xs text-primary">
                  <Check className="w-3 h-3" />
                  Active
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add System Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                placeholder="My Custom Prompt"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Select
                value={newPrompt.category}
                onValueChange={(v) => setNewPrompt({ ...newPrompt, category: v as SystemPrompt['category'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="coding">Coding</SelectItem>
                  <SelectItem value="writing">Writing</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prompt Content</label>
              <Textarea
                value={newPrompt.content}
                onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                placeholder="You are a helpful assistant..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newPrompt.name || !newPrompt.content}>
              Add Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input
                  value={editingPrompt.name}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select
                  value={editingPrompt.category}
                  onValueChange={(v) => setEditingPrompt({ ...editingPrompt, category: v as SystemPrompt['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Prompt Content</label>
                <Textarea
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                  rows={6}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPrompt(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
