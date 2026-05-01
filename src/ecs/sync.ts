import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { getDB } from "./store";

type SyncCollectionConfig = {
  firestoreName: string;
  idbName: string;
  idField: string | ((item: any) => string);
  deleteKey?: (data: any, docId: string) => any;
};

export type SyncOperation = {
  id?: number;
  type:
    | 'entity_put'
    | 'entity_delete'
    | 'comp_put'
    | 'comp_delete'
    | 'study_put'
    | 'study_delete'
    | 'tag_put'
    | 'tag_delete'
    | 'bucket_tag_put'
    | 'bucket_tag_delete'
    | 'idea_tag_put'
    | 'idea_tag_delete'
    | 'settings_put'
    | 'settings_delete';
  data: any;
  timestamp: number;
};

const SYNC_COLLECTIONS: SyncCollectionConfig[] = [
  { firestoreName: 'entities', idbName: 'entities', idField: 'id' },
  {
    firestoreName: 'components',
    idbName: 'components',
    idField: (component: any) => `${component.type}_${component.entityId}`,
    deleteKey: (data: any, docId: string) => {
      const separator = docId.indexOf("_");
      return [
        data?.type ?? (separator >= 0 ? docId.slice(0, separator) : docId),
        data?.entityId ?? (separator >= 0 ? docId.slice(separator + 1) : docId),
      ];
    },
  },
  { firestoreName: 'studyItems', idbName: 'studyItems', idField: 'id' },
  { firestoreName: 'tags', idbName: 'tags', idField: 'id' },
  { firestoreName: 'bucketTags', idbName: 'bucket-tags', idField: 'id' },
  { firestoreName: 'ideaTags', idbName: 'idea-tags', idField: 'id' },
  { firestoreName: 'folders', idbName: 'folders', idField: 'id' },
  { firestoreName: 'settings', idbName: 'settings', idField: 'id' },
  { firestoreName: 'bugs', idbName: 'bugs', idField: 'id' },
];

function getDocId(config: SyncCollectionConfig, item: any) {
  return typeof config.idField === 'function' ? config.idField(item) : item[config.idField];
}

async function getLocalItemCount() {
  const idb = await getDB();
  const counts = await Promise.all(
    SYNC_COLLECTIONS.map((config) => idb.count(config.idbName as any))
  );
  return counts.reduce((total, count) => total + count, 0);
}

export const SyncSystem = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  uid: null as string | null,
  isInitialized: false,
  isInitializing: false,
  isProcessingQueue: false,
  hasNetworkListeners: false,
  unsubscribes: [] as (() => void)[],
  
  async init(uid: string): Promise<{ action: 'pulled' | 'pushed' | 'none', items?: number }> {
    if (this.isInitializing || (this.isInitialized && this.uid === uid)) return { action: 'none' };
    this.isInitializing = true;
    this.uid = uid;
    
    // Listen for network changes
    if (!this.hasNetworkListeners) {
      window.addEventListener('online', async () => {
        this.isOnline = true;
        try {
          console.log("Sync: Back online, setting up listeners...");
          this.setupRealtimeListeners();
        } catch (err) {
          console.warn("Sync: Failed to setup listeners upon coming online", err);
        }
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
      this.hasNetworkListeners = true;
    }

    let result: { action: 'pulled' | 'pushed' | 'none', items?: number } = { action: 'none' };

    try {
      if (this.isOnline) {
        const snapshot = await Promise.race([
          getDoc(doc(db, "users", this.uid)),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 5000))
        ]);

        const isLocalEmpty = (await getLocalItemCount()) === 0;
        const cloudHasData = snapshot.exists() && snapshot.data().hasData;

        if (cloudHasData) {
          if (isLocalEmpty) {
            const items = await this.pullFromCloud();
            result = { action: 'pulled', items };
          } else {
            this.processQueue();
          }
        } else if (!isLocalEmpty) {
          this.pushAllToCloud();
          result = { action: 'pushed' };
        }
      }
      
      this.isInitialized = true;
      
      this.setupRealtimeListeners();
      this.processQueue();
    } catch (err) {
      console.warn("Sync: Initial sync failed or timed out; continuing with local workspace", err);
      this.isInitialized = true;
    } finally {
      this.isInitializing = false;
    }
    
    return result;
  },

  async pushAllToCloud() {
    if (!this.uid || !this.isOnline) return;
    console.log("Sync: Pushing all local data to cloud (Firestore)...");
    try {
      const idb = await getDB();

      for (const config of SYNC_COLLECTIONS) {
        const localItems = await idb.getAll(config.idbName as any);
        const localIds = new Set(localItems.map((item: any) => getDocId(config, item)));
        const remoteSnapshot = await getDocs(collection(db, `users/${this.uid}/${config.firestoreName}`));

        for (const remoteDoc of remoteSnapshot.docs) {
          if (!localIds.has(remoteDoc.id)) {
            await deleteDoc(doc(db, `users/${this.uid}/${config.firestoreName}`, remoteDoc.id));
          }
        }

        for (const item of localItems) {
          await setDoc(doc(db, `users/${this.uid}/${config.firestoreName}`, getDocId(config, item)), item);
        }
      }

      // Mark user document as having data
      await setDoc(doc(db, "users", this.uid), { hasData: true }, { merge: true });

      console.log("Sync: All data pushed to Firestore successfully.");
    } catch (error) {
      console.error("Sync: Failed to push all data", error);
    }
  },

  async pullFromCloud(): Promise<number> {
    if (!this.uid) return 0;
    try {
      const collectionNames = [
        ...SYNC_COLLECTIONS,
      ];

      // 1. Fetch all data from Firestore (Network I/O)
      const fetchedData = [];
      for (const coll of collectionNames) {
        const qs = await getDocs(collection(db, `users/${this.uid}/${coll.firestoreName}`));
        fetchedData.push({
           idbName: coll.idbName,
           docs: qs.docs.map(docSnap => docSnap.data())
        });
      }

      // 2. Open IndexedDB transaction and apply writes (Local I/O)
      // Done after network so the transaction doesn't auto-close!
      const idb = await getDB();
      const tx = idb.transaction(collectionNames.map(c => c.idbName) as any, 'readwrite');
      
      let itemCount = 0;
      for (const coll of fetchedData) {
        await tx.objectStore(coll.idbName as any).clear();
        for (const docData of coll.docs) {
          await tx.objectStore(coll.idbName as any).put(docData as any);
          itemCount++;
        }
      }
      
      await tx.done;
      console.log("SSOT: Data pulled from Firestore successfully.");
      return itemCount;
    } catch (error) {
      console.error("SSOT: Failed to pull from cloud", error);
      throw error;
    }
  },

  async queueWrite(op: Omit<SyncOperation, 'timestamp'>) {
    if (!this.uid) return;
    try {
      const idb = await getDB();
      const syncOp: SyncOperation = { ...op, timestamp: Date.now() };
      
      await idb.add('syncQueue', syncOp);
      
      if (this.isOnline && this.isInitialized) {
        this.processQueue().catch(e => console.warn("Sync process background error:", e));
      }
    } catch (error) {
      console.error("Sync: Failed to queue operation safely", error);
    }
  },

  async processQueue() {
    if (!this.uid) return;
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    try {
      const idb = await getDB();
      const queue = await idb.getAll('syncQueue');
      if (queue.length === 0) return;

      for (const op of queue) {
        try {
          await this.writeToCloud(op);
          if (op.id) {
            await idb.delete('syncQueue', op.id);
          }
        } catch (error: any) {
          console.error("Sync: Failed to process op, will retry later", op, error);
          // If the network is suddenly offline, break out to stop further attempts
          if (!this.isOnline || error.code === 'unavailable') {
            break;
          }
        }
      }
    } catch (error) {
      console.error("Sync: Critical error processing queue", error);
    } finally {
      this.isProcessingQueue = false;
    }
  },

  async writeToCloud(op: SyncOperation) {
    if (!this.uid) return;
    
    let collectionName = "";
    let docId = "";

    switch (op.type) {
      case 'entity_put': case 'entity_delete': collectionName = 'entities'; docId = op.data.id; break;
      case 'comp_put': case 'comp_delete': collectionName = 'components'; docId = `${op.data.type}_${op.data.entityId}`; break;
      case 'study_put': case 'study_delete': collectionName = 'studyItems'; docId = op.data.id; break;
      case 'tag_put': case 'tag_delete': collectionName = 'tags'; docId = op.data.id; break;
      case 'bucket_tag_put': case 'bucket_tag_delete': collectionName = 'bucketTags'; docId = op.data.id; break;
      case 'idea_tag_put': case 'idea_tag_delete': collectionName = 'ideaTags'; docId = op.data.id; break;
      case 'settings_put': case 'settings_delete': collectionName = 'settings'; docId = op.data.id; break;
    }

    if (!collectionName) return;

    const docRef = doc(db, `users/${this.uid}/${collectionName}`, docId);
    
    if (op.type.endsWith('_delete')) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, op.data);
    }
    
    // Mark user document as having data
    await setDoc(doc(db, "users", this.uid), { hasData: true }, { merge: true });
  },

  async getQueueCount() {
    const idb = await getDB();
    return idb.count('syncQueue');
  },

  setupRealtimeListeners() {
    if (!this.uid || !this.isOnline) return;
    
    // Cleanup existing listeners if any
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];

    const collectionNames = SYNC_COLLECTIONS;

    collectionNames.forEach(coll => {
      const q = collection(db, `users/${this.uid}/${coll.firestoreName}`);
      const unsub = onSnapshot(q, async (snapshot) => {
        // Ignore local writes that we just pushed to avoid echo loop
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        let changed = false;
        const idb = await getDB();
        const tx = idb.transaction(coll.idbName as any, 'readwrite');
        const store = tx.objectStore(coll.idbName as any);

        snapshot.docChanges().forEach(change => {
          changed = true;
          if (change.type === "added" || change.type === "modified") {
            store.put(change.doc.data() as any);
          }
          if (change.type === "removed") {
            const data = change.doc.data();
            const deleteKey = "deleteKey" in coll && typeof coll.deleteKey === "function"
              ? coll.deleteKey(data, change.doc.id)
              : change.doc.id;
            store.delete(deleteKey as any);
          }
        });

        await tx.done;
        
        if (changed) {
          window.dispatchEvent(new Event('delta-data-changed'));
        }
      }, (error) => {
        console.warn(`Sync: onSnapshot error for ${coll.firestoreName}`, error);
      });
      
      this.unsubscribes.push(unsub);
    });
  }
};
