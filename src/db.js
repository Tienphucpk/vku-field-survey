/**
 * db.js - Module cơ sở dữ liệu VKU Field Survey
 * ======================================================
 * - DB Name mới: VKU_Field_Survey_DB_v5 (Loại bỏ hoàn toàn DB cũ bị lỗi schema)
 * - Tự động Chuẩn hóa dữ liệu (Data Normalization)
 * - Phản hồi tức thì 100%, không bị treo.
 */

const DB_NAME = 'VKU_Field_Survey_DB_v5';
const DB_VERSION = 1;
const STORE_NAME = 'surveys';

let useMemoryFallback = false;
let memoryStore = [];
let memoryIdCounter = 1;
let cachedDB = null;

/* ==========================================
   0. UUID GENERATOR AN TOÀN
   ========================================== */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ==========================================
   1. MỞ DATABASE AN TOÀN
   ========================================== */
export function openDatabase() {
  if (useMemoryFallback) {
    return Promise.resolve(null);
  }

  if (cachedDB) {
    try {
      cachedDB.transaction(STORE_NAME, 'readonly');
      return Promise.resolve(cachedDB);
    } catch (e) {
      cachedDB = null;
    }
  }

  return new Promise((resolve) => {
    if (!window.indexedDB) {
      useMemoryFallback = true;
      resolve(null);
      return;
    }

    let resolved = false;

    // Timeout 1 giây: nếu kẹt thì chuyển sang Memory ngay
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[DB] IndexedDB Timeout -> Dùng Memory Storage');
        useMemoryFallback = true;
        resolve(null);
      }
    }, 1000);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          cachedDB = event.target.result;

          cachedDB.onversionchange = () => {
            if (cachedDB) {
              cachedDB.close();
              cachedDB = null;
            }
          };

          resolve(cachedDB);
        }
      };

      request.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          useMemoryFallback = true;
          resolve(null);
        }
      };

      request.onblocked = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          useMemoryFallback = true;
          resolve(null);
        }
      };
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutTimer);
        useMemoryFallback = true;
        resolve(null);
      }
    }
  });
}

/* ==========================================
   2. LƯU KHẢO SÁT MỚI
   ========================================== */
export async function saveSurvey(survey) {
  const record = {
    clientId: generateUUID(),
    inspector: survey.inspector || 'N/A',
    location: survey.location || 'Chưa chọn',
    facility: survey.facility || 'Chưa chọn',
    condition: survey.condition || 'good',
    priority: survey.priority || 'medium',
    note: survey.note || '',
    createdAt: new Date().toISOString(),
    synced: false
  };

  const db = await openDatabase();

  if (useMemoryFallback || !db) {
    record.id = memoryIdCounter++;
    memoryStore.push(record);
    return Promise.resolve(record.id);
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let insertedId = null;

      const request = store.add(record);

      request.onsuccess = () => {
        insertedId = request.result;
      };

      transaction.oncomplete = () => {
        resolve(insertedId || record.id || Date.now());
      };

      request.onerror = () => {
        record.id = memoryIdCounter++;
        memoryStore.push(record);
        resolve(record.id);
      };

      transaction.onerror = () => {
        record.id = memoryIdCounter++;
        memoryStore.push(record);
        resolve(record.id);
      };
    } catch (e) {
      record.id = memoryIdCounter++;
      memoryStore.push(record);
      resolve(record.id);
    }
  });
}

/* ==========================================
   3. LẤY TẤT CẢ KHẢO SÁT (TỰ CHUẨN HÓA FIELD)
   ========================================== */
export async function getAllSurveys() {
  const db = await openDatabase();

  const normalize = (item) => ({
    id: item.id,
    clientId: item.clientId || generateUUID(),
    inspector: item.inspector || item.inspectorName || 'Khảo sát viên',
    location: item.location || item.area || 'Phòng học',
    facility: item.facility || item.inspectionItem || 'Thiết bị',
    condition: item.condition || 'good',
    priority: item.priority || 'medium',
    note: item.note || item.notes || '',
    createdAt: item.createdAt || new Date().toISOString(),
    synced: Boolean(item.synced)
  });

  if (useMemoryFallback || !db) {
    const sorted = [...memoryStore].map(normalize).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return Promise.resolve(sorted);
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const raw = (request.result || []).concat(memoryStore);
        const surveys = raw.map(normalize).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        resolve(surveys);
      };

      request.onerror = () => {
        resolve([...memoryStore].map(normalize));
      };

      transaction.onerror = () => {
        resolve([...memoryStore].map(normalize));
      };
    } catch (e) {
      resolve([...memoryStore].map(normalize));
    }
  });
}

/* ==========================================
   4. LẤY KHẢO SÁT THEO ID
   ========================================== */
export async function getSurveyById(id) {
  const surveys = await getAllSurveys();
  return surveys.find((s) => s.id === id);
}

/* ==========================================
   5. CẬP NHẬT KHẢO SÁT
   ========================================== */
export async function updateSurvey(survey) {
  const db = await openDatabase();

  if (useMemoryFallback || !db) {
    const idx = memoryStore.findIndex((s) => s.id === survey.id);
    if (idx !== -1) memoryStore[idx] = { ...survey };
    return Promise.resolve(survey.id);
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let updatedId = survey.id;

      const request = store.put(survey);

      request.onsuccess = () => {
        updatedId = request.result;
      };

      transaction.oncomplete = () => {
        resolve(updatedId);
      };

      request.onerror = () => resolve(survey.id);
      transaction.onerror = () => resolve(survey.id);
    } catch (e) {
      resolve(survey.id);
    }
  });
}

/* ==========================================
   6. XÓA MỘT KHẢO SÁT
   ========================================== */
export async function deleteSurvey(id) {
  memoryStore = memoryStore.filter((s) => s.id !== id);
  const db = await openDatabase();

  if (useMemoryFallback || !db) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

/* ==========================================
   7. XÓA TOÀN BỘ DỮ LIỆU
   ========================================== */
export async function deleteAllSurveys() {
  memoryStore = [];
  const db = await openDatabase();

  if (useMemoryFallback || !db) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

/* ==========================================
   8. LẤY CÁC KHẢO SÁT CHƯA ĐỒNG BỘ
   ========================================== */
export async function getUnsyncedSurveys() {
  const surveys = await getAllSurveys();
  return surveys.filter((s) => !s.synced);
}

/* ==========================================
   9. THỐNG KÊ KHẢO SÁT
   ========================================== */
export async function getSurveyStatistics() {
  const surveys = await getAllSurveys();
  const total = surveys.length;
  const synced = surveys.filter((s) => s.synced).length;
  const unsynced = total - synced;
  return { total, synced, unsynced };
}
