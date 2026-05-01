import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { getDB } from "./store";

export type SyncOperation = {
  id?: number;
  type: 'entity_put' | 'entity_delete' | 'comp_put' | 'comp_delete' | 'study_put' | 'study_delete' | 'tag_put' | 'tag_delete';
  data: any;
  timestamp: number;
};

export const SyncSystem = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  uid: null as string | null,
  isInitialized: false,
  isInitializing: false,
  unsubscribes: [] as (() => void)[],
  
  async init(uid: string): Promise<{ action: 'pulled' | 'pushed' | 'none', items?: number }> {
    if (this.isInitializing || (this.isInitialized && this.uid === uid)) return { action: 'none' };
    this.isInitializing = true;
    this.uid = uid;
    
    // Listen for network changes
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

    let result: { action: 'pulled' | 'pushed' | 'none', items?: number } = { action: 'none' };

    // Initial SSOT Load or Push from Firebase (non-blocking)
    if (this.isOnline) {
      try {
        const snapshot = await Promise.race([
          getDoc(doc(db, "users", this.uid)),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 5000))
        ]);

        const idb = await getDB();
        const entityCount = await idb.count('entities');
        const isLocalEmpty = entityCount === 0;

        if (snapshot.exists() && snapshot.data().hasData) {
          if (isLocalEmpty) {
            const items = await this.pullFromCloud();
            result = { action: 'pulled', items };
          } else {
            result = { action: 'none' };
          }
        } else {
          if (!isLocalEmpty) {
            await this.pushAllToCloud();
            result = { action: 'pushed' };
          }
        }
      } catch (err) {
        console.warn("Sync: Initial sync failed or timed out", err);
        throw err;
      }
    }
    
    this.isInitialized = true;
    this.isInitializing = false;
    
    this.setupRealtimeListeners();
    this.processQueue();
    
    return result;
  },

  async pushAllToCloud() {
    if (!this.uid || !this.isOnline) return;
    console.log("Sync: Pushing all local data to cloud (Firestore)...");
    try {
      const idb = await getDB();
      const collections = [
        { name: 'entities', data: await idb.getAll('entities'), idField: 'id' },
        { name: 'components', data: await idb.getAll('components'), idField: (c: any) => `${c.type}_${c.entityId}` },
        { name: 'studyItems', data: await idb.getAll('studyItems'), idField: 'id' },
        { name: 'tags', data: await idb.getAll('tags'), idField: 'id' },
        { name: 'bucketTags', data: await idb.getAll('bucket-tags'), idField: 'id' },
        { name: 'folders', data: await idb.getAll('folders'), idField: 'id' },
        { name: 'ideaTags', data: await idb.getAll('idea-tags'), idField: 'id' },
        { name: 'settings', data: await idb.getAll('settings'), idField: 'id' },
        { name: 'bugs', data: await idb.getAll('bugs'), idField: 'id' }
      ];

      // Since Firestore batch limit is 500, we write sequentially to keep it simple and robust
      // For large databases, we write each document
      for (const coll of collections) {
        for (const item of coll.data) {
          const docId = typeof coll.idField === 'function' ? coll.idField(item) : item[coll.idField as string];
          await setDoc(doc(db, `users/${this.uid}/${coll.name}`, docId), item);
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
        { firestoreName: 'entities', idbName: 'entities' },
        { firestoreName: 'components', idbName: 'components' },
        { firestoreName: 'studyItems', idbName: 'studyItems' },
        { firestoreName: 'tags', idbName: 'tags' },
        { firestoreName: 'bucketTags', idbName: 'bucket-tags' },
        { firestoreName: 'folders', idbName: 'folders' },
        { firestoreName: 'ideaTags', idbName: 'idea-tags' },
        { firestoreName: 'settings', idbName: 'settings' },
        { firestoreName: 'bugs', idbName: 'bugs' }
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

    const collectionNames = [
      { firestoreName: 'entities', idbName: 'entities' },
      { firestoreName: 'components', idbName: 'components' },
      { firestoreName: 'studyItems', idbName: 'studyItems' },
      { firestoreName: 'tags', idbName: 'tags' },
      { firestoreName: 'bucketTags', idbName: 'bucket-tags' },
      { firestoreName: 'folders', idbName: 'folders' },
      { firestoreName: 'ideaTags', idbName: 'idea-tags' },
      { firestoreName: 'settings', idbName: 'settings' },
      { firestoreName: 'bugs', idbName: 'bugs' }
    ];

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
            store.delete(change.doc.id);
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
