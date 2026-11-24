export interface StoredGeminiAudioRecord {
  cacheKey: string;
  newsId: string;
  language: string;
  voiceName: string;
  textSnapshot: string;
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

const DB_NAME = 'desh_reel_gemini_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_clips';
const MAX_STORED_CLIPS = 150;

export function buildAudioCacheKey(
  newsId: string,
  language: string,
  voiceName: string
): string {
  return `${newsId}::${language}::${voiceName || 'Kore'}`;
}

/**
 * Converts Gemini base64 audio (`audio/wav` or raw `audio/L16` PCM) into a playable WAV Blob.
 */
export function base64AudioToWavBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const isRiffWav =
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;

  const lowerMime = mimeType.toLowerCase();
  const isRawPcm =
    !isRiffWav &&
    (lowerMime.includes('l16') ||
      lowerMime.includes('pcm') ||
      lowerMime.includes('raw') ||
      lowerMime === 'audio/wav');

  if (isRawPcm) {
    const rateMatch = lowerMime.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = bytes.length;

    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(wavBuffer, 44).set(bytes);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  return new Blob([bytes], { type: mimeType || 'audio/wav' });
}

let openDbPromise: Promise<IDBDatabase | null> | null = null;

function openAudioDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
          store.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        openDbPromise = null;
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch {
      openDbPromise = null;
      resolve(null);
    }
  });

  return openDbPromise;
}

export async function getCachedGeminiAudioBlob(
  cacheKey: string,
  expectedTextSnapshot?: string
): Promise<Blob | null> {
  const db = await openAudioDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey);
      req.onsuccess = () => {
        const record = req.result as StoredGeminiAudioRecord | undefined;
        if (!record || !(record.blob instanceof Blob)) {
          resolve(null);
          return;
        }
        if (
          typeof expectedTextSnapshot === 'string' &&
          record.textSnapshot &&
          record.textSnapshot !== expectedTextSnapshot
        ) {
          resolve(null);
          return;
        }
        resolve(record.blob);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveGeminiAudioBlob(
  record: Omit<StoredGeminiAudioRecord, 'savedAt'>
): Promise<void> {
  const db = await openAudioDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const fullRecord: StoredGeminiAudioRecord = {
        ...record,
        savedAt: Date.now(),
      };
      store.put(fullRecord);

      // Keep IndexedDB bounded only if it grows beyond MAX_STORED_CLIPS
      const countReq = store.count();
      countReq.onsuccess = () => {
        const total = countReq.result;
        if (total > MAX_STORED_CLIPS && store.indexNames.contains('savedAt')) {
          let toDelete = total - MAX_STORED_CLIPS;
          const cursorReq = store.index('savedAt').openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && toDelete > 0) {
              cursor.delete();
              toDelete -= 1;
              cursor.continue();
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
