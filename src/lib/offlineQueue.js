const DB_NAME = 'floodguard-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-queue:changed'));
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cannot open offline queue'));
  });
}

function runStore(mode, handler) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = handler(store);

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Offline queue transaction failed'));
    };
  }));
}

export function createOfflineId(prefix = 'offline') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueueOfflineAction(type, payload, meta = {}) {
  const item = {
    id: createOfflineId(type.toLowerCase()),
    type,
    payload,
    meta,
    status: 'PENDING',
    attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: '',
  };

  await runStore('readwrite', store => store.put(item));
  notifyQueueChanged();
  return item;
}

export async function getOfflineQueue() {
  return runStore('readonly', store => new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Cannot read offline queue'));
  }));
}

export async function removeOfflineAction(id) {
  await runStore('readwrite', store => store.delete(id));
  notifyQueueChanged();
}

export async function updateOfflineAction(id, patch) {
  await runStore('readwrite', store => new Promise((resolve, reject) => {
    const read = store.get(id);
    read.onsuccess = () => {
      const item = read.result;
      if (!item) {
        resolve();
        return;
      }
      store.put({ ...item, ...patch, updated_at: new Date().toISOString() });
      resolve();
    };
    read.onerror = () => reject(read.error || new Error('Cannot update offline queue item'));
  }));
  notifyQueueChanged();
}

export async function countPendingOfflineActions() {
  const items = await getOfflineQueue();
  return items.filter(item => item.status === 'PENDING' || item.status === 'FAILED').length;
}

export function buildEmergencySmsBody(payload = {}) {
  const name = payload.victim_name || payload.full_name || 'Nguoi can cuu ho';
  const phone = payload.victim_phone || payload.phone || '';
  const area = payload.victim_area_name || payload.area_name || 'Chua xac dinh';
  const address = payload.victim_address_detail || payload.address_detail || '';
  const people = payload.number_of_people || 1;
  const lat = payload.victim_latitude ?? payload.latitude;
  const lng = payload.victim_longitude ?? payload.longitude;
  const gps = lat != null && lng != null ? ` GPS:${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}` : '';
  return `SOS CUU HO: ${name}. SDT:${phone}. Khu vuc:${area}. Dia chi:${address}. So nguoi:${people}.${gps}`;
}

export function buildSmsHref(phone, body) {
  const encoded = encodeURIComponent(body || '');
  return `sms:${phone || ''}?body=${encoded}`;
}
