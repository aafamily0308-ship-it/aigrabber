import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
}

export function useNetworkStatus(): NetworkStatus & {
  checkConnection: () => Promise<boolean>;
} {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnline, setLastOnline] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );
  const [lastOffline, setLastOffline] = useState<Date | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnline(new Date());
    if (!navigator.onLine) {
      setWasOffline(true);
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastOffline(new Date());
    setWasOffline(true);
  }, []);

  // Check actual connection by pinging a reliable endpoint
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource to verify actual connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    wasOffline,
    lastOnline,
    lastOffline,
    checkConnection,
  };
}

// Hook for checking specific AI provider availability
export function useProviderStatus(baseUrl: string) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkProvider = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(baseUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      setIsAvailable(response.ok);
      setLastChecked(new Date());
    } catch (err) {
      setIsAvailable(false);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    checkProvider();

    // Re-check every 30 seconds
    const interval = setInterval(checkProvider, 30000);

    return () => clearInterval(interval);
  }, [checkProvider]);

  return {
    isAvailable,
    isChecking,
    lastChecked,
    error,
    checkProvider,
  };
}
