import { Recording, RecordingMetadata } from '../types';

const DB_NAME = 'GeminiTranscriberDB';
const DB_VERSION = 3; // Bump version for schema changes
const CHUNKS_STORE_NAME = 'audioChunks';
const RECORDINGS_STORE_NAME = 'recordings';


let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(CHUNKS_STORE_NAME)) {
        dbInstance.createObjectStore(CHUNKS_STORE_NAME, { keyPath: ['recordingId', 'chunkIndex'] });
      }
      if (!dbInstance.objectStoreNames.contains(RECORDINGS_STORE_NAME)) {
        dbInstance.createObjectStore(RECORDINGS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addAudioChunk = (recordingId: number, chunkIndex: number, chunk: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject('Database not initialized.');
    }
    const transaction = db.transaction(CHUNKS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CHUNKS_STORE_NAME);
    const request = store.add({ recordingId, chunkIndex, chunk });

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error adding chunk:', request.error);
      reject('Failed to save audio chunk.');
    };
  });
};

export const getAudioChunks = (recordingId: number): Promise<Blob[]> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        return reject('Database not initialized.');
      }
      const transaction = db.transaction(CHUNKS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE_NAME);
      
      const range = IDBKeyRange.bound([recordingId, 0], [recordingId, Infinity]);
      const request = store.getAll(range);
  
      request.onsuccess = () => {
        const sortedRecords = request.result.sort((a, b) => a.chunkIndex - b.chunkIndex);
        const chunks = sortedRecords.map(record => record.chunk);
        resolve(chunks);
      };
  
      request.onerror = () => {
        console.error('Error getting chunks:', request.error);
        reject('Failed to retrieve audio chunks.');
      };
    });
  };

export const clearAudioChunks = (recordingId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject('Database not initialized.');
    }
    const transaction = db.transaction(CHUNKS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CHUNKS_STORE_NAME);
    
    const range = IDBKeyRange.bound([recordingId, 0], [recordingId, Infinity]);
    const request = store.delete(range);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error clearing chunks:', request.error);
      reject('Failed to clear audio chunks.');
    };
  });
};

// --- Functions for permanent recordings ---

export const addRecording = (recording: Recording): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized.');
    const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RECORDINGS_STORE_NAME);
    const request = store.add(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error adding recording:', request.error);
      reject('Failed to save recording.');
    };
  });
};

export const getRecording = (id: number): Promise<Recording | undefined> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized.');
      const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(RECORDINGS_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Error getting recording:', request.error);
        reject('Failed to retrieve recording.');
      };
    });
  };

export const getAllRecordingsMetadata = (): Promise<RecordingMetadata[]> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized.');
    const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(RECORDINGS_STORE_NAME);
    const request = store.openCursor(null, 'prev'); // 'prev' for descending order (newest first)
    const metadata: RecordingMetadata[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const { blob, ...meta } = cursor.value;
        metadata.push(meta);
        cursor.continue();
      } else {
        resolve(metadata);
      }
    };
    request.onerror = () => {
      console.error('Error getting all recordings metadata:', request.error);
      reject('Failed to retrieve recordings list.');
    };
  });
};

export const updateRecording = (id: number, updates: Partial<Omit<Recording, 'id'>>): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized.');
    const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RECORDINGS_STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        const updatedData = { ...data, ...updates };
        const putRequest = store.put(updatedData);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => {
          console.error('Error updating recording:', putRequest.error);
          reject('Failed to update recording.');
        };
      } else {
        reject('Recording not found for update.');
      }
    };
    getRequest.onerror = () => {
      console.error('Error getting recording for update:', getRequest.error);
      reject('Failed to retrieve recording for update.');
    };
  });
};

export const deleteRecording = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized.');
        const transaction = db.transaction(RECORDINGS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(RECORDINGS_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error deleting recording:', request.error);
            reject('Failed to delete recording.');
        };
    });
};
