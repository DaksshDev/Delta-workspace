import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface DeltaDB extends DBSchema {
  entities: {
    key: string;
    value: {
      id: string;
      type: string;
      createdAt: number;
      updatedAt: number;
    };
    indexes: { 'by-type': string };
  };
  components: {
    key: [string, string]; // [componentType, entityId]
    value: {
      entityId: string;
      type: string;
      data: any;
    };
    indexes: { 
      'by-entity': string,
      'by-type': string
    };
  };
  folders: {
    key: string;
    value: any;
  };
  tags: {
    key: string;
    value: any;
  };
  settings: {
    key: string;
    value: any;
  };
  bugs: {
    key: string;
    value: any;
  };
  syncQueue: {
    key: number;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<DeltaDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DeltaDB>('delta-board', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entities')) {
          const entityStore = db.createObjectStore('entities', { keyPath: 'id' });
          entityStore.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('components')) {
          const compStore = db.createObjectStore('components', { keyPath: ['type', 'entityId'] });
          compStore.createIndex('by-entity', 'entityId');
          compStore.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bugs')) db.createObjectStore('bugs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}
