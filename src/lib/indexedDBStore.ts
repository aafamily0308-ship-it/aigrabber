// IndexedDB Store for unlimited storage of documents, messages, and audit logs
// Overcomes localStorage 5MB limit

const DB_NAME = 'ai-command-center';
const DB_VERSION = 1;

interface DBSchema {
  documents: {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string;
    chunks?: string[];
    createdAt: Date;
  };
  messages: {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    provider?: string;
    timestamp: Date;
  };
  auditLogs: {
    id: string;
    timestamp: Date;
    action: string;
    provider?: string;
    providerType?: 'local' | 'cloud';
    tokensUsed?: number;
    dataSize?: number;
    sensitiveDataDetected?: boolean;
    details?: string;
  };
  backups: {
    id: string;
    timestamp: Date;
    data: string;
    size: number;
  };
}

type StoreName = keyof DBSchema;

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Documents store
      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('name', 'name', { unique: false });
        docStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Audit logs store
      if (!db.objectStoreNames.contains('auditLogs')) {
        const auditStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
        auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        auditStore.createIndex('action', 'action', { unique: false });
      }

      // Backups store
      if (!db.objectStoreNames.contains('backups')) {
        const backupStore = db.createObjectStore('backups', { keyPath: 'id' });
        backupStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Generic CRUD operations
export async function addItem<T extends StoreName>(
  storeName: T,
  item: DBSchema[T]
): Promise<string> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => resolve(item.id);
    request.onerror = () => reject(request.error);
  });
}

export async function getItem<T extends StoreName>(
  storeName: T,
  id: string
): Promise<DBSchema[T] | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems<T extends StoreName>(
  storeName: T
): Promise<DBSchema[T][]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateItem<T extends StoreName>(
  storeName: T,
  item: DBSchema[T]
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem<T extends StoreName>(
  storeName: T,
  id: string
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore<T extends StoreName>(storeName: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Query by index
export async function getByIndex<T extends StoreName>(
  storeName: T,
  indexName: string,
  value: IDBValidKey
): Promise<DBSchema[T][]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get count of items in a store
export async function getCount<T extends StoreName>(storeName: T): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get storage size estimate
export async function getStorageEstimate(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { used: 0, quota: 0 };
}

// Document-specific functions
export async function saveDocument(doc: DBSchema['documents']): Promise<string> {
  return addItem('documents', doc);
}

export async function getDocument(id: string): Promise<DBSchema['documents'] | undefined> {
  return getItem('documents', id);
}

export async function getAllDocuments(): Promise<DBSchema['documents'][]> {
  return getAllItems('documents');
}

export async function deleteDocument(id: string): Promise<void> {
  return deleteItem('documents', id);
}

// Message-specific functions
export async function saveMessage(message: DBSchema['messages']): Promise<string> {
  return addItem('messages', message);
}

export async function getMessagesByConversation(conversationId: string): Promise<DBSchema['messages'][]> {
  return getByIndex('messages', 'conversationId', conversationId);
}

export async function deleteMessagesByConversation(conversationId: string): Promise<void> {
  const messages = await getMessagesByConversation(conversationId);
  for (const message of messages) {
    await deleteItem('messages', message.id);
  }
}

// Audit log functions
export async function saveAuditLog(log: DBSchema['auditLogs']): Promise<string> {
  return addItem('auditLogs', log);
}

export async function getAllAuditLogs(): Promise<DBSchema['auditLogs'][]> {
  return getAllItems('auditLogs');
}

export async function clearAuditLogs(): Promise<void> {
  return clearStore('auditLogs');
}

// Backup functions
export async function saveBackup(backup: DBSchema['backups']): Promise<string> {
  return addItem('backups', backup);
}

export async function getLatestBackup(): Promise<DBSchema['backups'] | undefined> {
  const backups = await getAllItems('backups');
  if (backups.length === 0) return undefined;
  
  return backups.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
}

export async function getAllBackups(): Promise<DBSchema['backups'][]> {
  return getAllItems('backups');
}

export async function deleteOldBackups(keepCount: number = 5): Promise<void> {
  const backups = await getAllItems('backups');
  const sorted = backups.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const toDelete = sorted.slice(keepCount);
  for (const backup of toDelete) {
    await deleteItem('backups', backup.id);
  }
}

// Export all IndexedDB data
export async function exportAllIndexedDBData(): Promise<{
  documents: DBSchema['documents'][];
  messages: DBSchema['messages'][];
  auditLogs: DBSchema['auditLogs'][];
}> {
  const [documents, messages, auditLogs] = await Promise.all([
    getAllDocuments(),
    getAllItems('messages'),
    getAllAuditLogs(),
  ]);

  return { documents, messages, auditLogs };
}

// Import data to IndexedDB
export async function importToIndexedDB(data: {
  documents?: DBSchema['documents'][];
  messages?: DBSchema['messages'][];
  auditLogs?: DBSchema['auditLogs'][];
}): Promise<void> {
  if (data.documents) {
    for (const doc of data.documents) {
      await addItem('documents', doc);
    }
  }

  if (data.messages) {
    for (const msg of data.messages) {
      await addItem('messages', msg);
    }
  }

  if (data.auditLogs) {
    for (const log of data.auditLogs) {
      await addItem('auditLogs', log);
    }
  }
}

// Clear all IndexedDB data
export async function clearAllIndexedDBData(): Promise<void> {
  await Promise.all([
    clearStore('documents'),
    clearStore('messages'),
    clearStore('auditLogs'),
    clearStore('backups'),
  ]);
}
