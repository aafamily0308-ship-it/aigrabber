// Data Manager for export, import, and auto-backup functionality
// Handles all local data operations without cloud dependency

import { exportAllIndexedDBData, importToIndexedDB, saveBackup, getLatestBackup, deleteOldBackups } from './indexedDBStore';

export interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    // LocalStorage data
    conversations: any[];
    providers: any[];
    settings: any;
    prompts: any[];
    auditEntries: any[];
    knowledgeDocuments: any[];
    // IndexedDB data
    indexedDB?: {
      documents: any[];
      messages: any[];
      auditLogs: any[];
    };
  };
}

const EXPORT_VERSION = '1.0.0';
const AUTO_BACKUP_KEY = 'ai-command-auto-backup-settings';

// Get data from localStorage
function getLocalStorageData(key: string): any {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch {
    return null;
  }
}

// Export all data to JSON
export async function exportAllData(): Promise<ExportData> {
  // Get localStorage data
  const chatData = getLocalStorageData('ai-command-chat');
  const providerData = getLocalStorageData('ai-command-providers');
  const settingsData = getLocalStorageData('ai-command-settings');
  const promptsData = getLocalStorageData('ai-command-prompts');
  const auditData = getLocalStorageData('ai-command-audit');
  const knowledgeData = getLocalStorageData('ai-command-knowledge');

  // Get IndexedDB data
  let indexedDBData;
  try {
    indexedDBData = await exportAllIndexedDBData();
  } catch (error) {
    console.warn('Could not export IndexedDB data:', error);
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      conversations: chatData?.state?.conversations || [],
      providers: providerData?.state?.providers || [],
      settings: settingsData?.state || {},
      prompts: promptsData?.state?.prompts || [],
      auditEntries: auditData?.state?.entries || [],
      knowledgeDocuments: knowledgeData?.state?.documents || [],
      indexedDB: indexedDBData,
    },
  };
}

// Download exported data as file
export async function downloadExport(filename?: string): Promise<void> {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `ai-command-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import data from JSON file
export async function importData(file: File): Promise<{ success: boolean; message: string; imported: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);

        if (!data.version || !data.data) {
          resolve({ success: false, message: 'Invalid backup file format', imported: [] });
          return;
        }

        const imported: string[] = [];

        // Import conversations
        if (data.data.conversations?.length > 0) {
          const chatData = getLocalStorageData('ai-command-chat') || { state: {} };
          chatData.state.conversations = data.data.conversations;
          localStorage.setItem('ai-command-chat', JSON.stringify(chatData));
          imported.push(`${data.data.conversations.length} conversations`);
        }

        // Import providers
        if (data.data.providers?.length > 0) {
          const providerData = getLocalStorageData('ai-command-providers') || { state: {} };
          providerData.state.providers = data.data.providers;
          localStorage.setItem('ai-command-providers', JSON.stringify(providerData));
          imported.push(`${data.data.providers.length} providers`);
        }

        // Import settings
        if (data.data.settings && Object.keys(data.data.settings).length > 0) {
          const settingsData = { state: data.data.settings };
          localStorage.setItem('ai-command-settings', JSON.stringify(settingsData));
          imported.push('settings');
        }

        // Import prompts
        if (data.data.prompts?.length > 0) {
          const promptsData = getLocalStorageData('ai-command-prompts') || { state: {} };
          promptsData.state.prompts = data.data.prompts;
          localStorage.setItem('ai-command-prompts', JSON.stringify(promptsData));
          imported.push(`${data.data.prompts.length} prompts`);
        }

        // Import audit entries
        if (data.data.auditEntries?.length > 0) {
          const auditData = getLocalStorageData('ai-command-audit') || { state: {} };
          auditData.state.entries = data.data.auditEntries;
          localStorage.setItem('ai-command-audit', JSON.stringify(auditData));
          imported.push(`${data.data.auditEntries.length} audit entries`);
        }

        // Import knowledge documents
        if (data.data.knowledgeDocuments?.length > 0) {
          const knowledgeData = getLocalStorageData('ai-command-knowledge') || { state: {} };
          knowledgeData.state.documents = data.data.knowledgeDocuments;
          localStorage.setItem('ai-command-knowledge', JSON.stringify(knowledgeData));
          imported.push(`${data.data.knowledgeDocuments.length} documents`);
        }

        // Import IndexedDB data
        if (data.data.indexedDB) {
          try {
            await importToIndexedDB(data.data.indexedDB);
            if (data.data.indexedDB.documents?.length) {
              imported.push(`${data.data.indexedDB.documents.length} indexed documents`);
            }
            if (data.data.indexedDB.messages?.length) {
              imported.push(`${data.data.indexedDB.messages.length} indexed messages`);
            }
          } catch (error) {
            console.warn('Could not import IndexedDB data:', error);
          }
        }

        resolve({
          success: true,
          message: `Successfully imported from backup (v${data.version})`,
          imported,
        });
      } catch (error) {
        resolve({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to parse backup file',
          imported: [],
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, message: 'Failed to read file', imported: [] });
    };

    reader.readAsText(file);
  });
}

// Auto-backup settings
export interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  keepCount: number;
  lastBackup: string | null;
}

export function getAutoBackupSettings(): AutoBackupSettings {
  const stored = localStorage.getItem(AUTO_BACKUP_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  return {
    enabled: false,
    intervalMinutes: 60,
    keepCount: 5,
    lastBackup: null,
  };
}

export function saveAutoBackupSettings(settings: AutoBackupSettings): void {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(settings));
}

// Create auto-backup to IndexedDB
export async function createAutoBackup(): Promise<boolean> {
  try {
    const data = await exportAllData();
    const backupString = JSON.stringify(data);

    await saveBackup({
      id: `backup-${Date.now()}`,
      timestamp: new Date(),
      data: backupString,
      size: new Blob([backupString]).size,
    });

    // Clean up old backups
    const settings = getAutoBackupSettings();
    await deleteOldBackups(settings.keepCount);

    // Update last backup time
    settings.lastBackup = new Date().toISOString();
    saveAutoBackupSettings(settings);

    return true;
  } catch (error) {
    console.error('Auto-backup failed:', error);
    return false;
  }
}

// Restore from latest auto-backup
export async function restoreFromLatestBackup(): Promise<{ success: boolean; message: string }> {
  try {
    const backup = await getLatestBackup();
    if (!backup) {
      return { success: false, message: 'No backup found' };
    }

    const data: ExportData = JSON.parse(backup.data);
    
    // Create a virtual file and use importData
    const blob = new Blob([backup.data], { type: 'application/json' });
    const file = new File([blob], 'backup.json', { type: 'application/json' });
    
    const result = await importData(file);
    return {
      success: result.success,
      message: result.success 
        ? `Restored from backup (${new Date(backup.timestamp).toLocaleString()})`
        : result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Restore failed',
    };
  }
}

// Get storage usage
export function getStorageUsage(): { used: number; available: number; percentage: number } {
  let totalSize = 0;

  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalSize += localStorage.getItem(key)?.length || 0;
    }
  }

  // Convert to bytes (each char is ~2 bytes in UTF-16)
  const usedBytes = totalSize * 2;
  const maxBytes = 5 * 1024 * 1024; // 5MB typical localStorage limit
  
  return {
    used: usedBytes,
    available: maxBytes - usedBytes,
    percentage: (usedBytes / maxBytes) * 100,
  };
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Clear all data
export async function clearAllData(): Promise<void> {
  // Clear localStorage (except auto-backup settings)
  const autoBackupSettings = getAutoBackupSettings();
  localStorage.clear();
  saveAutoBackupSettings(autoBackupSettings);
}
