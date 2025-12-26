// Maintenance Store - Zustand store for maintenance mode management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  SystemHealth, 
  MaintenanceResult,
  runHealthChecks,
  runMaintenance,
  createBackup,
  listBackups,
  testAllProviders,
  exportDiagnostics
} from '@/lib/maintenanceSystem';

interface MaintenanceState {
  // State
  isMaintenanceMode: boolean;
  lastHealthCheck: SystemHealth | null;
  lastMaintenanceResult: MaintenanceResult | null;
  backups: Array<{ id: string; timestamp: Date; size: number }>;
  isRunning: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  lastAutoBackup: Date | null;
  
  // Actions
  setMaintenanceMode: (enabled: boolean) => void;
  runHealthCheck: () => Promise<SystemHealth>;
  runFullMaintenance: (options?: { autoFix?: boolean; clearOldData?: boolean; reindexVectors?: boolean }) => Promise<MaintenanceResult>;
  createManualBackup: () => Promise<{ success: boolean; backupId?: string; error?: string }>;
  refreshBackupList: () => Promise<void>;
  setAutoBackup: (enabled: boolean, intervalHours?: number) => void;
  exportSystemDiagnostics: () => Promise<string>;
  testProviders: () => Promise<Array<{ provider: string; status: 'online' | 'offline' | 'error'; message: string }>>;
}

export const useMaintenanceStore = create<MaintenanceState>()(
  persist(
    (set, get) => ({
      // Initial state
      isMaintenanceMode: false,
      lastHealthCheck: null,
      lastMaintenanceResult: null,
      backups: [],
      isRunning: false,
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      lastAutoBackup: null,

      setMaintenanceMode: (enabled) => set({ isMaintenanceMode: enabled }),

      runHealthCheck: async () => {
        set({ isRunning: true });
        try {
          const health = await runHealthChecks();
          set({ lastHealthCheck: health, isRunning: false });
          return health;
        } catch (error) {
          set({ isRunning: false });
          throw error;
        }
      },

      runFullMaintenance: async (options = {}) => {
        set({ isRunning: true, isMaintenanceMode: true });
        try {
          const result = await runMaintenance({
            createBackup: true,
            autoFix: options.autoFix ?? true,
            clearOldData: options.clearOldData ?? false,
            reindexVectors: options.reindexVectors ?? false,
          });
          
          // Refresh health check after maintenance
          const health = await runHealthChecks();
          
          // Refresh backup list
          const backups = await listBackups();
          
          set({ 
            lastMaintenanceResult: result, 
            lastHealthCheck: health,
            backups,
            isRunning: false, 
            isMaintenanceMode: false 
          });
          
          return result;
        } catch (error) {
          set({ isRunning: false, isMaintenanceMode: false });
          throw error;
        }
      },

      createManualBackup: async () => {
        set({ isRunning: true });
        try {
          const result = await createBackup();
          if (result.success) {
            const backups = await listBackups();
            set({ backups, lastAutoBackup: new Date() });
          }
          set({ isRunning: false });
          return result;
        } catch (error: any) {
          set({ isRunning: false });
          return { success: false, error: error.message };
        }
      },

      refreshBackupList: async () => {
        const backups = await listBackups();
        set({ backups });
      },

      setAutoBackup: (enabled, intervalHours) => {
        set({ 
          autoBackupEnabled: enabled,
          ...(intervalHours !== undefined && { autoBackupIntervalHours: intervalHours }),
        });
      },

      exportSystemDiagnostics: async () => {
        return exportDiagnostics();
      },

      testProviders: async () => {
        return testAllProviders();
      },
    }),
    {
      name: 'ai-command-maintenance',
      partialize: (state) => ({
        autoBackupEnabled: state.autoBackupEnabled,
        autoBackupIntervalHours: state.autoBackupIntervalHours,
        lastAutoBackup: state.lastAutoBackup,
      }),
    }
  )
);

// Auto-backup scheduler
let autoBackupInterval: NodeJS.Timeout | null = null;

export function startAutoBackupScheduler() {
  const state = useMaintenanceStore.getState();
  
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }
  
  if (state.autoBackupEnabled) {
    const intervalMs = state.autoBackupIntervalHours * 60 * 60 * 1000;
    
    autoBackupInterval = setInterval(async () => {
      const currentState = useMaintenanceStore.getState();
      if (currentState.autoBackupEnabled && !currentState.isRunning) {
        await currentState.createManualBackup();
      }
    }, intervalMs);
    
    // Check if we need an immediate backup
    if (state.lastAutoBackup) {
      const timeSinceBackup = Date.now() - new Date(state.lastAutoBackup).getTime();
      if (timeSinceBackup > intervalMs) {
        useMaintenanceStore.getState().createManualBackup();
      }
    }
  }
}

export function stopAutoBackupScheduler() {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}

// Initialize on module load
startAutoBackupScheduler();
