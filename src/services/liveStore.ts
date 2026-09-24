import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { 
  MOCK_PROJECTS, 
  MOCK_BOOKINGS, 
  MOCK_CLAIMS, 
  MOCK_PURCHASE_ORDERS, 
  MOCK_SUBCONTRACT_ORDERS, 
  MOCK_COMPETENCIES, 
  MOCK_PEOPLE 
} from './mockData';

// BroadcastChannel for instant local cross-tab sync
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('gvd_connect_live_sync')
  : null;

const STORAGE_PREFIX = 'gvd_live_';

const getInitialData = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(STORAGE_PREFIX + key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

const saveLocalData = <T>(key: string, data: T) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  if (syncChannel) {
    syncChannel.postMessage({ key, data });
  }
};

/**
 * Real-Time Live Data Store with Cloud Firestore multi-device synchronization
 * Syncs instantly across computer, phone, tablet, and any connected browser device!
 */
export class LiveDataStore {
  private static listeners: Map<string, Set<(data: any) => void>> = new Map();
  private static firestoreUnsubscribers: Map<string, () => void> = new Map();

  static subscribe<T>(key: string, initialData: T, onChange: (data: T) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(onChange);

    // Initial local delivery for immediate instant render (0ms delay)
    const currentLocal = getInitialData(key, initialData);
    onChange(currentLocal);

    // Set up Cloud Firestore Realtime listener for cross-device sync if not already listening
    if (!this.firestoreUnsubscribers.has(key)) {
      try {
        const docRef = doc(db, 'sync_store', key);
        const unsub = onSnapshot(
          docRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data && data.items !== undefined) {
                const cloudItems = data.items as T;
                saveLocalData(key, cloudItems);
                // Notify all local listeners of updated cloud data
                const keyListeners = this.listeners.get(key);
                if (keyListeners) {
                  keyListeners.forEach(cb => cb(cloudItems));
                }
              }
            } else {
              // Document doesn't exist in Cloud Firestore yet; seed it with current data
              setDoc(docRef, { items: currentLocal, updatedAt: Date.now() }, { merge: true }).catch(console.warn);
            }
          },
          (err) => {
            console.warn(`[LiveDataStore] Firestore snapshot sync note for '${key}':`, err.message);
          }
        );
        this.firestoreUnsubscribers.set(key, unsub);
      } catch (err) {
        console.warn(`[LiveDataStore] Failed to establish Firestore live listener for '${key}':`, err);
      }
    }

    // Local tab BroadcastChannel handler
    const channelHandler = (event: MessageEvent) => {
      if (event.data?.key === key) {
        onChange(event.data.data);
      }
    };

    if (syncChannel) {
      syncChannel.addEventListener('message', channelHandler);
    }

    // Storage event fallback for cross-window on same device
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + key && e.newValue) {
        try {
          onChange(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      set.delete(onChange);
      if (syncChannel) {
        syncChannel.removeEventListener('message', channelHandler);
      }
      window.removeEventListener('storage', storageHandler);

      // Clean up Firestore subscription if no local listeners remain for this key
      if (set.size === 0) {
        const unsub = this.firestoreUnsubscribers.get(key);
        if (unsub) {
          unsub();
          this.firestoreUnsubscribers.delete(key);
        }
      }
    };
  }

  static update<T>(key: string, newData: T) {
    // 1. Instant local storage & broadcast for 0ms UI responsiveness on current device
    saveLocalData(key, newData);
    const set = this.listeners.get(key);
    if (set) {
      set.forEach(cb => cb(newData));
    }

    // 2. Real-time broadcast write to Cloud Firestore for cross-device updates (phones, tablets, PCs)
    try {
      const docRef = doc(db, 'sync_store', key);
      setDoc(docRef, { items: newData, updatedAt: Date.now() }, { merge: true }).catch((err) => {
        console.error(`[LiveDataStore] Error writing cross-device sync data to Cloud Firestore for '${key}':`, err);
      });
    } catch (err) {
      console.error(`[LiveDataStore] Firestore write error for '${key}':`, err);
    }
  }
}

// Pre-initialize local storage & Cloud Firestore with default mock data if not already initialized
if (typeof window !== 'undefined') {
  const seedKeys = [
    { key: 'projects', data: MOCK_PROJECTS },
    { key: 'bookings', data: MOCK_BOOKINGS },
    { key: 'claims', data: MOCK_CLAIMS },
    { key: 'purchase_orders', data: MOCK_PURCHASE_ORDERS },
    { key: 'subcontracts', data: MOCK_SUBCONTRACT_ORDERS },
    { key: 'competencies', data: MOCK_COMPETENCIES },
    { key: 'people', data: MOCK_PEOPLE }
  ];

  seedKeys.forEach(({ key, data }) => {
    if (!localStorage.getItem(STORAGE_PREFIX + key)) {
      saveLocalData(key, data);
      try {
        setDoc(doc(db, 'sync_store', key), { items: data, updatedAt: Date.now() }, { merge: true }).catch(console.warn);
      } catch (e) {}
    }
  });
}
