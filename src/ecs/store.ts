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
  studyItems: {
    key: string;
    value: {
      id: string;
      parentId: string;
      type: "folder" | "flashcard" | "quiz" | "keypoints";
      name: string;
      color: string;
      order: number;
      isDefault: boolean;
      createdAt: string;
      updatedAt: string;
    };
    indexes: {
      "by-parent": string;
      "by-type": string;
      "by-parent-type": [string, string];
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
  'bucket-tags': {
    key: string;
    value: any;
  };
  'idea-tags': {
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
    dbPromise = openDB<DeltaDB>('delta-board', 4, {
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
        if (!db.objectStoreNames.contains('studyItems')) {
          const studyStore = db.createObjectStore('studyItems', { keyPath: 'id' });
          studyStore.createIndex('by-parent', 'parentId');
          studyStore.createIndex('by-type', 'type');
          studyStore.createIndex('by-parent-type', ['parentId', 'type']);
        }
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bucket-tags')) db.createObjectStore('bucket-tags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('idea-tags')) db.createObjectStore('idea-tags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bugs')) db.createObjectStore('bugs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}
