import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { isListening, transcript, isSupported, toggleListening } = useSpeechToText({
    continuous: true,
    lang: 'en-US',
    onResult: (text) => {
      if (text.trim()) {
        onTranscript(text);
      }
    },
  });

  if (!isSupported) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          disabled={disabled}
          className={cn(
            'relative',
            isListening && 'text-destructive bg-destructive/10'
          )}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
            </>
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isListening ? 'Stop recording' : 'Voice input'}
      </TooltipContent>
    </Tooltip>
  );
}
