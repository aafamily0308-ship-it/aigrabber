// Auto-check hook - Runs quick integrity check on app start and after updates
import { useEffect, useRef } from 'react';
import { systemBrain } from '@/lib/aiBrain';
import { useToast } from '@/hooks/use-toast';

interface AutoCheckOptions {
  runOnMount?: boolean;
  showToastOnIssues?: boolean;
  intervalMs?: number | null; // null = no interval
}

export function useAutoCheck(options: AutoCheckOptions = {}) {
  const {
    runOnMount = true,
    showToastOnIssues = true,
    intervalMs = null,
  } = options;
  
  const { toast } = useToast();
  const hasRun = useRef(false);

  useEffect(() => {
    // Run once on mount
    if (runOnMount && !hasRun.current) {
      hasRun.current = true;
      
      // Delay slightly to not block initial render
      const timeout = setTimeout(async () => {
        console.log('[AutoCheck] Running startup integrity check...');
        
        try {
          const result = await systemBrain.quickHealthCheck();
          
          if (!result.healthy && showToastOnIssues) {
            toast({
              title: 'System Issues Detected',
              description: `${result.issues.length} issue(s) found. Check Maintenance for details.`,
              variant: 'destructive',
            });
          } else if (result.healthy) {
            console.log('[AutoCheck] System healthy');
          }
        } catch (error) {
          console.error('[AutoCheck] Health check failed:', error);
        }
      }, 2000); // 2 second delay after mount

      return () => clearTimeout(timeout);
    }
  }, [runOnMount, showToastOnIssues, toast]);

  // Optional interval checking
  useEffect(() => {
    if (!intervalMs) return;

    const interval = setInterval(async () => {
      try {
        const result = await systemBrain.quickHealthCheck();
        
        if (!result.healthy && showToastOnIssues) {
          toast({
            title: 'System Issues Detected',
            description: `${result.issues.length} issue(s) found during periodic check.`,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('[AutoCheck] Periodic check failed:', error);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, showToastOnIssues, toast]);

  // Manual trigger function
  const runCheck = async () => {
    const result = await systemBrain.quickHealthCheck();
    return result;
  };

  return { runCheck };
}
