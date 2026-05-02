import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { getDB } from "./store";

const DEFAULT_SYNC_INTERVAL_MS = 60_000;
const MIN_SYNC_INTERVAL_MS = 5_000;
const SYNC_INTERVAL_STORAGE_KEY = "delta-board.syncIntervalMs";
const SYNC_STATE_EVENT = "delta-sync-state-changed";

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

export type SyncVerificationResult = {
  ok: boolean;
  checkedAt: number;
  mismatches: string[];
};

export type SyncStatus = {
  queueCount: number;
  isOnline: boolean;
  isProcessing: boolean;
  intervalMs: number;
  lastSyncAt: number | null;
  nextSyncAt: number | null;
  lastVerifiedAt: number | null;
  lastVerificationError: string | null;
  verificationMismatches: string[];
};

export type SyncInitResult =
  | { action: 'pulled'; items: number }
  | { action: 'pushed' | 'none' }
  | { action: 'conflict'; mismatches: string[]; queueCount: number };

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

function getStoredSyncIntervalMs() {
  if (typeof window === "undefined") return DEFAULT_SYNC_INTERVAL_MS;
  const stored = Number(window.localStorage.getItem(SYNC_INTERVAL_STORAGE_KEY));
  return Number.isFinite(stored) ? Math.max(stored, MIN_SYNC_INTERVAL_MS) : DEFAULT_SYNC_INTERVAL_MS;
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function dataMatches(left: any, right: any) {
  return stableStringify(left) === stableStringify(right);
}

function getOperationTarget(op: SyncOperation): { collectionName: string; docId: string } | null {
  switch (op.type) {
    case 'entity_put': case 'entity_delete': return { collectionName: 'entities', docId: op.data.id };
    case 'comp_put': case 'comp_delete': return { collectionName: 'components', docId: `${op.data.type}_${op.data.entityId}` };
    case 'study_put': case 'study_delete': return { collectionName: 'studyItems', docId: op.data.id };
    case 'tag_put': case 'tag_delete': return { collectionName: 'tags', docId: op.data.id };
    case 'bucket_tag_put': case 'bucket_tag_delete': return { collectionName: 'bucketTags', docId: op.data.id };
    case 'idea_tag_put': case 'idea_tag_delete': return { collectionName: 'ideaTags', docId: op.data.id };
    case 'settings_put': case 'settings_delete': return { collectionName: 'settings', docId: op.data.id };
  }
  return null;
}

async function getLocalItemCount() {
  const idb = await getDB();
  const counts = await Promise.all(
    SYNC_COLLECTIONS.map((config) => idb.count(config.idbName as any))
  );
  return counts.reduce((total, count) => total + count, 0);
}

async function compareLocalWithCloud(uid: string) {
  const mismatches: string[] = [];
  const idb = await getDB();

  for (const config of SYNC_COLLECTIONS) {
    const [localItems, remoteSnapshot] = await Promise.all([
      idb.getAll(config.idbName as any),
      getDocs(collection(db, `users/${uid}/${config.firestoreName}`)),
    ]);
    const localById = new Map(localItems.map((item: any) => [getDocId(config, item), item]));
    const remoteById = new Map(remoteSnapshot.docs.map((remoteDoc) => [remoteDoc.id, remoteDoc.data()]));

    localById.forEach((localItem, id) => {
      const remoteItem = remoteById.get(id);
      if (!remoteItem) {
        mismatches.push(`${config.firestoreName}/${id} is missing in Firebase`);
      } else if (!dataMatches(localItem, remoteItem)) {
        mismatches.push(`${config.firestoreName}/${id} differs between local and Firebase`);
      }
    });

    remoteById.forEach((_remoteItem, id) => {
      if (!localById.has(id)) {
        mismatches.push(`${config.firestoreName}/${id} exists only in Firebase`);
      }
    });
  }

  return mismatches;
}

export const SyncSystem = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  uid: null as string | null,
  isInitialized: false,
  isInitializing: false,
  isProcessingQueue: false,
  hasNetworkListeners: false,
  unsubscribes: [] as (() => void)[],
  syncTimer: null as number | null,
  syncIntervalMs: getStoredSyncIntervalMs(),
  lastSyncAt: null as number | null,
  nextSyncAt: null as number | null,
  lastVerifiedAt: null as number | null,
  lastVerificationError: null as string | null,
  verificationMismatches: [] as string[],
  
  async init(uid: string): Promise<SyncInitResult> {
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
        this.scheduleNextSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.dispatchStatusChanged();
      });
      this.hasNetworkListeners = true;
    }

    let result: SyncInitResult = { action: 'none' };

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
            const [mismatches, queueCount] = await Promise.all([
              compareLocalWithCloud(this.uid),
              this.getQueueCount(),
            ]);

            if (mismatches.length > 0 || queueCount > 0) {
              this.isInitialized = false;
              this.lastVerificationError = null;
              this.verificationMismatches = mismatches.length > 0 ? mismatches : ["Local changes are queued but not in Firebase yet."];
              return { action: 'conflict', mismatches: this.verificationMismatches, queueCount };
            }
          }
        } else if (!isLocalEmpty) {
          await this.pushAllToCloud();
          result = { action: 'pushed' };
        }
      }
      
      this.isInitialized = true;
      
      this.setupRealtimeListeners();
      this.startBackgroundSync();
    } catch (err) {
      console.warn("Sync: Initial sync failed or timed out; continuing with local workspace", err);
      this.isInitialized = true;
      this.startBackgroundSync();
    } finally {
      this.isInitializing = false;
      this.dispatchStatusChanged();
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

      await this.verifySync();
      console.log("Sync: All data pushed to Firestore successfully.");
    } catch (error) {
      console.error("Sync: Failed to push all data", error);
    }
  },

  async clearQueue() {
    const idb = await getDB();
    await idb.clear('syncQueue');
    this.dispatchStatusChanged();
  },

  async keepLocalVersion() {
    if (!this.uid || !this.isOnline) throw new Error("Cannot overwrite Firebase while offline.");
    await this.pushAllToCloud();
    const verification = await this.verifySync();
    if (!verification.ok) {
      throw new Error(verification.mismatches[0] || "Firebase did not match local data after overwrite.");
    }
    await this.clearQueue();
    this.isInitialized = true;
    this.setupRealtimeListeners();
    this.startBackgroundSync();
  },

  async useFirebaseVersion(): Promise<number> {
    if (!this.uid || !this.isOnline) throw new Error("Cannot pull Firebase while offline.");
    await this.clearQueue();
    const items = await this.pullFromCloud();
    const verification = await this.verifySync();
    if (!verification.ok) {
      throw new Error(verification.mismatches[0] || "Local data did not match Firebase after pull.");
    }
    this.isInitialized = true;
    this.setupRealtimeListeners();
    this.startBackgroundSync();
    return items;
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
      await this.verifySync();
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
      this.dispatchStatusChanged();
    } catch (error) {
      console.error("Sync: Failed to queue operation safely", error);
    }
  },

  async processQueue() {
    if (!this.uid) return;
    if (this.isProcessingQueue) return;
    if (!this.isOnline) {
      this.scheduleNextSync();
      return;
    }
    this.isProcessingQueue = true;
    this.dispatchStatusChanged();
    try {
      const idb = await getDB();
      const queue = await idb.getAll('syncQueue');
      if (queue.length === 0) {
        await this.verifySync();
        return;
      }

      for (const op of queue) {
        try {
          await this.writeToCloud(op);
          if (op.id !== undefined) {
            await idb.delete('syncQueue', op.id);
          }
          this.lastSyncAt = Date.now();
        } catch (error: any) {
          console.error("Sync: Failed to process op, will retry later", op, error);
          // If the network is suddenly offline, break out to stop further attempts
          if (!this.isOnline || error.code === 'unavailable') {
            break;
          }
        }
      }

      if ((await idb.count('syncQueue')) === 0) {
        await this.verifySync();
      }
    } catch (error) {
      console.error("Sync: Critical error processing queue", error);
    } finally {
      this.isProcessingQueue = false;
      this.scheduleNextSync();
      this.dispatchStatusChanged();
    }
  },

  async writeToCloud(op: SyncOperation) {
    if (!this.uid) return;
    const target = getOperationTarget(op);
    if (!target) return;
    const { collectionName, docId } = target;

    const docRef = doc(db, `users/${this.uid}/${collectionName}`, docId);
    
    if (op.type.endsWith('_delete')) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, op.data);
    }
    
    // Mark user document as having data
    await setDoc(doc(db, "users", this.uid), { hasData: true }, { merge: true });
    await this.verifyRemoteOperation(op);
  },

  async getQueueCount() {
    const idb = await getDB();
    return idb.count('syncQueue');
  },

  getSyncIntervalMs() {
    return this.syncIntervalMs;
  },

  setSyncIntervalMs(intervalMs: number) {
    this.syncIntervalMs = Math.max(Math.round(intervalMs), MIN_SYNC_INTERVAL_MS);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_INTERVAL_STORAGE_KEY, String(this.syncIntervalMs));
    }
    this.scheduleNextSync();
    this.dispatchStatusChanged();
  },

  startBackgroundSync() {
    if (typeof window === "undefined") return;
    this.scheduleNextSync();
  },

  scheduleNextSync(delayMs?: number) {
    if (typeof window === "undefined") return;
    if (this.syncTimer) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    const nextDelayMs = delayMs ?? this.syncIntervalMs;
    this.nextSyncAt = Date.now() + nextDelayMs;
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      this.processQueue().catch((error) => console.warn("Sync: Background interval failed", error));
    }, nextDelayMs);
    this.dispatchStatusChanged();
  },

  async getStatus(): Promise<SyncStatus> {
    return {
      queueCount: await this.getQueueCount(),
      isOnline: this.isOnline,
      isProcessing: this.isProcessingQueue,
      intervalMs: this.syncIntervalMs,
      lastSyncAt: this.lastSyncAt,
      nextSyncAt: this.nextSyncAt,
      lastVerifiedAt: this.lastVerifiedAt,
      lastVerificationError: this.lastVerificationError,
      verificationMismatches: this.verificationMismatches,
    };
  },

  dispatchStatusChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNC_STATE_EVENT));
    }
  },

  async getPendingTargets() {
    const idb = await getDB();
    const queue = await idb.getAll('syncQueue');
    const targets = new Set<string>();
    queue.forEach((op) => {
      const target = getOperationTarget(op);
      if (target) targets.add(`${target.collectionName}/${target.docId}`);
    });
    return targets;
  },

  async verifyRemoteOperation(op: SyncOperation) {
    if (!this.uid) return;
    const target = getOperationTarget(op);
    if (!target) return;
    const docRef = doc(db, `users/${this.uid}/${target.collectionName}`, target.docId);
    const snapshot = await getDoc(docRef);
    if (op.type.endsWith('_delete')) {
      if (snapshot.exists()) throw new Error(`Remote delete verification failed for ${target.collectionName}/${target.docId}`);
      return;
    }
    if (!snapshot.exists() || !dataMatches(snapshot.data(), op.data)) {
      throw new Error(`Remote write verification failed for ${target.collectionName}/${target.docId}`);
    }
  },

  async verifySync(): Promise<SyncVerificationResult> {
    if (!this.uid || !this.isOnline) {
      return { ok: false, checkedAt: Date.now(), mismatches: ["Sync verification skipped while offline or signed out."] };
    }

    const mismatches: string[] = [];
    try {
      mismatches.push(...await compareLocalWithCloud(this.uid));

      this.lastVerifiedAt = Date.now();
      this.lastVerificationError = null;
      this.verificationMismatches = mismatches;
      this.dispatchStatusChanged();
      return { ok: mismatches.length === 0, checkedAt: this.lastVerifiedAt, mismatches };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown verification error";
      this.lastVerificationError = message;
      this.verificationMismatches = [message];
      this.dispatchStatusChanged();
      return { ok: false, checkedAt: Date.now(), mismatches: [message] };
    }
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
        const pendingTargets = await this.getPendingTargets();
        const idb = await getDB();
        const tx = idb.transaction(coll.idbName as any, 'readwrite');
        const store = tx.objectStore(coll.idbName as any);

        snapshot.docChanges().forEach(change => {
          if (pendingTargets.has(`${coll.firestoreName}/${change.doc.id}`)) {
            return;
          }

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
          this.verifySync().catch((error) => console.warn("Sync: Listener verification failed", error));
        }
      }, (error) => {
        console.warn(`Sync: onSnapshot error for ${coll.firestoreName}`, error);
        this.lastVerificationError = error instanceof Error ? error.message : "Realtime listener failed";
        this.dispatchStatusChanged();
      });
      
      this.unsubscribes.push(unsub);
    });
  }
};

export { SYNC_STATE_EVENT, DEFAULT_SYNC_INTERVAL_MS, MIN_SYNC_INTERVAL_MS };
