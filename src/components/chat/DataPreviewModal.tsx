import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Eye, EyeOff, Send } from 'lucide-react';
import { detectSensitiveData, SensitiveMatch, getSensitivityLevel, maskSensitiveData } from '@/lib/sensitiveDetector';
import { estimateTokens } from '@/lib/documentParser';
import { cn } from '@/lib/utils';

interface DataPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: string) => void;
  data: string;
  provider: string;
}

export function DataPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  data,
  provider,
}: DataPreviewModalProps) {
  const [editedData, setEditedData] = useState(data);
  const [showMasked, setShowMasked] = useState(false);

  const sensitiveMatches = useMemo(() => detectSensitiveData(editedData), [editedData]);
  const sensitivityLevel = useMemo(() => getSensitivityLevel(sensitiveMatches), [sensitiveMatches]);
  const maskedData = useMemo(() => maskSensitiveData(editedData), [editedData]);
  const tokenCount = useMemo(() => estimateTokens(editedData), [editedData]);

  const handleConfirm = () => {
    onConfirm(showMasked ? maskedData : editedData);
    onClose();
  };

  const displayData = showMasked ? maskedData : editedData;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Data Preview
          </DialogTitle>
          <DialogDescription>
            Review the data that will be sent to <strong>{provider}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline">~{tokenCount} tokens</Badge>
            <Badge variant="outline">{editedData.length} characters</Badge>
            {sensitiveMatches.length > 0 && (
              <Badge
                variant={sensitivityLevel === 'high' ? 'destructive' : 'secondary'}
                className="gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                {sensitiveMatches.length} sensitive item{sensitiveMatches.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Sensitive Data Warning */}
          {sensitiveMatches.length > 0 && (
            <div className={cn(
              'p-3 rounded-lg border flex items-start gap-3',
              sensitivityLevel === 'high' 
                ? 'bg-destructive/10 border-destructive/30' 
                : 'bg-warning/10 border-warning/30'
            )}>
              <AlertTriangle className={cn(
                'w-5 h-5 flex-shrink-0 mt-0.5',
                sensitivityLevel === 'high' ? 'text-destructive' : 'text-warning'
              )} />
              <div className="flex-1">
                <p className="font-medium text-sm">Sensitive data detected</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(new Set(sensitiveMatches.map(m => m.type))).map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMasked(!showMasked)}
                className="gap-1"
              >
                {showMasked ? <EyeOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                {showMasked ? 'Show original' : 'Mask data'}
              </Button>
            </div>
          )}

          {/* Data Editor */}
          <div className="flex-1 min-h-0">
            <Textarea
              value={displayData}
              onChange={(e) => !showMasked && setEditedData(e.target.value)}
              readOnly={showMasked}
              className="h-64 font-mono text-sm resize-none"
              placeholder="No data to preview"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Send className="w-4 h-4" />
            Send to {provider}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
