import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export const resizeImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Setup a fallback timeout of 8 seconds so it never hangs
    const timeoutId = setTimeout(() => {
      reject(new Error('Masa tamat memproses gambar (Timeout)'));
    }, 8000);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeoutId);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(e.target?.result as string || '');
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        let mimeType = file.type || 'image/jpeg';
        if (mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
          mimeType = 'image/jpeg';
        }
        
        try {
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve(dataUrl);
        } catch (err) {
          resolve(e.target?.result as string || '');
        }
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Gagal memproses fail imej'));
      };
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        clearTimeout(timeoutId);
        reject(new Error('Fail kosong atau tidak sah'));
      }
    };
    reader.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Gagal membaca fail'));
    };
    reader.readAsDataURL(file);
  });
};

export const resizeImageToBlob = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        let mimeType = file.type || 'image/jpeg';
        if (mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
          mimeType = 'image/jpeg';
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, mimeType, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Empty result'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

export const uploadImageToStorage = async (
  file: File,
  folder: string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.7
): Promise<string> => {
  // 1. Generate local fallback Base64 immediately with slightly lower dimensions/quality for extreme efficiency
  let fallbackWidth = maxWidth;
  let fallbackHeight = maxHeight;
  let fallbackQuality = quality;

  if (folder.includes('avatar')) {
    // 800px is ultra high quality (super crisp on high-DPI screens) but still fast to load and upload
    fallbackWidth = Math.min(maxWidth, 800);
    fallbackHeight = Math.min(maxHeight, 800);
    fallbackQuality = 0.85;
  } else if (folder.includes('cover')) {
    // 1600px width is perfect for HD desktop cover banners
    fallbackWidth = Math.min(maxWidth, 1600);
    fallbackHeight = Math.min(maxHeight, 800);
    fallbackQuality = 0.85;
  } else if (folder.includes('chats') || folder.includes('reports')) {
    // 1200px for high resolution images in chats / reports
    fallbackWidth = Math.min(maxWidth, 1200);
    fallbackHeight = Math.min(maxHeight, 1200);
    fallbackQuality = 0.85;
  }

  let localBase64 = '';
  try {
    localBase64 = await resizeImage(file, fallbackWidth, fallbackHeight, fallbackQuality);
  } catch (err) {
    console.error("Local resize failed, using original file reader", err);
    // fallback to original base64 if resize fails
    localBase64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target?.result as string || '');
      r.onerror = () => reject(new Error('FileReader failed'));
      r.readAsDataURL(file);
    });
  }

  // 2. Prepare the Storage Upload Ref and Blob
  let blob: Blob;
  try {
    blob = base64ToBlob(localBase64);
  } catch (e) {
    console.error("Failed to convert base64 to blob, returning base64 directly", e);
    return localBase64;
  }

  const cleanFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, `${folder}/${cleanFilename}`);

  // 3. Attempt to upload with a fast 2.0-second timeout
  const uploadPromise = (async () => {
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("Storage upload timed out")), 15000);
  });

  try {
    // Race the upload against the 2-second timeout
    const resultUrl = await Promise.race([uploadPromise, timeoutPromise]);
    console.log("Firebase Storage upload succeeded:", resultUrl);
    
    // Auto-save to Cache Storage so that real-time sync loads it instantly
    try {
      if (typeof window !== 'undefined') {
        const objectUrl = URL.createObjectURL(blob);
        memoryBlobUrlMap.set(resultUrl, objectUrl);

        if ('caches' in window) {
          const cache = await caches.open('tmf2-image-cache');
          await cache.put(resultUrl, new Response(blob, {
            headers: {
              'Content-Type': blob.type || 'image/jpeg',
              'X-Cached-At': Date.now().toString(),
              'X-Blob-Size': blob.size.toString()
            }
          }));
          console.log("[Cache] Pre-cached uploaded image:", resultUrl);
        }

        window.dispatchEvent(new CustomEvent('tmf2_image_updated', {
          detail: { url: resultUrl, freshUrl: objectUrl }
        }));
      }
    } catch (cacheErr) {
      console.warn("Failed to pre-cache uploaded image:", cacheErr);
    }
    
    return resultUrl;
  } catch (error) {
    console.warn("Firebase Storage upload failed or timed out. Falling back to secure Base64 local storage:", error);
    // Return local base64 on failure or timeout. Works instantly and stores perfectly in Firestore!
    return localBase64;
  }
};

export const uploadBase64ToStorage = async (base64: string, path: string): Promise<string> => {
  const blob = base64ToBlob(base64);
  const storageRef = ref(storage, path);
  
  const uploadPromise = (async () => {
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("Storage upload timed out")), 15000);
  });

  const resultUrl = await Promise.race([uploadPromise, timeoutPromise]);
  
  // Auto-save to Cache Storage
  try {
    if (typeof window !== 'undefined') {
      const objectUrl = URL.createObjectURL(blob);
      memoryBlobUrlMap.set(resultUrl, objectUrl);

      if ('caches' in window) {
        const cache = await caches.open('tmf2-image-cache');
        await cache.put(resultUrl, new Response(blob, {
          headers: {
            'Content-Type': blob.type || 'image/jpeg',
            'X-Cached-At': Date.now().toString(),
            'X-Blob-Size': blob.size.toString()
          }
        }));
        console.log("[Cache] Pre-cached uploaded base64 image:", resultUrl);
      }

      window.dispatchEvent(new CustomEvent('tmf2_image_updated', {
        detail: { url: resultUrl, freshUrl: objectUrl }
      }));
    }
  } catch (cacheErr) {
    console.warn("Failed to pre-cache uploaded base64 image:", cacheErr);
  }
  
  return resultUrl;
};

// In-memory cache to allow 0ms instantaneous display across component mounts and tab switching
const memoryBlobUrlMap = new Map<string, string>();
const inflightFetches = new Map<string, Promise<string | null>>();

// --- IndexedDB Persistent Image Storage ---
const DB_NAME = 'tmf2_image_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

export const openImageDB = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onclose = () => {
          dbInstance = null;
          dbOpenPromise = null;
        };
        resolve(dbInstance);
      };
      request.onerror = (err) => {
        console.warn('[ImageCache] IndexedDB open error, falling back:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('[ImageCache] IndexedDB initialization failed:', e);
      resolve(null);
    }
  });

  return dbOpenPromise;
};

export const saveImageToIndexedDB = async (
  url: string, 
  data: Blob | string, 
  etag?: string
): Promise<string | null> => {
  if (!url || typeof window === 'undefined' || !window.indexedDB) return null;
  try {
    const db = await openImageDB();
    if (!db) return null;

    let blob: Blob;
    let dataUrl: string | undefined;

    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        dataUrl = data;
        try {
          blob = base64ToBlob(data);
        } catch {
          blob = new Blob([data], { type: 'text/plain' });
        }
      } else {
        blob = new Blob([data], { type: 'text/plain' });
      }
    } else {
      blob = data;
    }

    const record = {
      url,
      blob,
      dataUrl,
      mimeType: blob.type || 'image/jpeg',
      size: blob.size,
      etag: etag || '',
      updatedAt: Date.now()
    };

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => {
          const objectUrl = dataUrl || URL.createObjectURL(blob);
          memoryBlobUrlMap.set(url, objectUrl);
          resolve(objectUrl);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  } catch (err) {
    return null;
  }
};

export const getImageFromIndexedDB = async (url: string): Promise<string | null> => {
  if (!url || typeof window === 'undefined' || !window.indexedDB) return null;
  try {
    const db = await openImageDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(url);
        req.onsuccess = () => {
          const result = req.result;
          if (result) {
            if (result.dataUrl) {
              memoryBlobUrlMap.set(url, result.dataUrl);
              resolve(result.dataUrl);
              return;
            }
            if (result.blob) {
              const objectUrl = URL.createObjectURL(result.blob);
              memoryBlobUrlMap.set(url, objectUrl);
              resolve(objectUrl);
              return;
            }
          }
          resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  } catch (e) {
    return null;
  }
};

/**
 * Pre-decodes an image silently in background offscreen before mounting it in the DOM.
 * Eliminates any visual flash, blank frames, or jarring layout shifts.
 */
export const decodeImageSilently = async (src: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !src) return false;
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    if (typeof img.decode === 'function') {
      img.decode().then(() => resolve(true)).catch(() => resolve(false));
    } else {
      (img as HTMLImageElement).onload = () => resolve(true);
      (img as HTMLImageElement).onerror = () => resolve(false);
    }
  });
};

// Returns synchronous cached URL if already available in memory or fast-tier cache (0ms latency, zero flicker)
export const getSynchronousCachedImageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  // 1. Check in-memory RAM map (0ms)
  const inMem = memoryBlobUrlMap.get(url);
  if (inMem) return inMem;
  
  // 2. Fast synchronous check for Profile Cover Photo from localStorage
  if (typeof window !== 'undefined') {
    const currentCover = localStorage.getItem('tmf2_cover');
    if (currentCover && (currentCover === url || url.includes('Fotokulit') || url.includes('/cover/'))) {
      const fastPreview = localStorage.getItem('tmf2_cached_cover_data');
      if (fastPreview && (fastPreview.startsWith('data:') || fastPreview.startsWith('blob:'))) {
        memoryBlobUrlMap.set(url, fastPreview);
        return fastPreview;
      }
    }
  }

  return null;
};

// Image caching helpers using IndexedDB + Browser's Cache Storage API + In-memory URL cache
export const saveImageToCache = async (url: string, data: string | Blob): Promise<string | null> => {
  if (!url || typeof window === 'undefined') return null;
  if (url.startsWith('blob:')) return url;

  let objectUrl: string | null = null;

  // 1. Save to persistent IndexedDB
  try {
    objectUrl = await saveImageToIndexedDB(url, data);
  } catch (idbErr) {
    console.warn("IndexedDB save failed, using fallback:", idbErr);
  }

  // 2. Save to Cache Storage API
  if ('caches' in window && !url.startsWith('data:')) {
    try {
      const cache = await caches.open('tmf2-image-cache');
      let blob: Blob;
      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          blob = base64ToBlob(data);
        } else {
          blob = new Blob([data], { type: 'text/plain' });
        }
      } else {
        blob = data;
      }
      
      const responseToCache = new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'image/jpeg',
          'X-Cached-At': Date.now().toString(),
          'X-Blob-Size': blob.size.toString()
        }
      });
      await cache.put(url, responseToCache);
    } catch (cacheErr) {
      // Non-critical Cache Storage error
    }
  }

  // 3. For Profile Cover Photo, save to synchronous fast-tier in localStorage
  if (typeof data === 'string' && data.startsWith('data:image/') && (url.includes('cover') || url.includes('Fotokulit') || url === localStorage.getItem('tmf2_cover'))) {
    try {
      localStorage.setItem('tmf2_cached_cover_data', data);
    } catch (e) {
      // LocalStorage quota safety
    }
  }

  if (objectUrl) {
    memoryBlobUrlMap.set(url, objectUrl);
  }

  window.dispatchEvent(new CustomEvent('tmf2_image_updated', {
    detail: { url, freshUrl: objectUrl || (typeof data === 'string' ? data : '') }
  }));

  return objectUrl;
};

export const getImageFromCache = async (url: string): Promise<string | null> => {
  if (!url || typeof window === 'undefined') return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // 1. Check synchronous in-memory cache first
  const inMemory = memoryBlobUrlMap.get(url);
  if (inMemory) {
    return inMemory;
  }

  // 2. Synchronous fast check
  const synchronous = getSynchronousCachedImageUrl(url);
  if (synchronous) {
    return synchronous;
  }

  // 3. Check persistent IndexedDB
  try {
    const fromIdb = await getImageFromIndexedDB(url);
    if (fromIdb) {
      memoryBlobUrlMap.set(url, fromIdb);
      return fromIdb;
    }
  } catch (e) {}

  // 4. Check Cache Storage API
  if ('caches' in window) {
    try {
      const cache = await caches.open('tmf2-image-cache');
      const cachedResponse = await cache.match(url);
      if (cachedResponse && cachedResponse.type !== 'opaque') {
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        memoryBlobUrlMap.set(url, objectUrl);
        // Persist to IndexedDB for even faster future loads
        saveImageToIndexedDB(url, blob).catch(() => {});
        return objectUrl;
      }
    } catch (e) {
      console.warn("Failed to get image from CacheStorage:", e);
    }
  }

  return null;
};

/**
 * Stale-While-Revalidate: Checks background network for newer version of the image.
 * If the image is updated on the server, updates IndexedDB, Cache Storage, memory cache, 
 * pre-decodes the new image silently, and smoothly updates the UI.
 */
export const revalidateImageCache = async (
  url: string,
  onUpdate?: (freshUrl: string) => void
): Promise<string | null> => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || typeof window === 'undefined') {
    return null;
  }

  // Deduplicate ongoing network fetches for the same image URL
  if (inflightFetches.has(url)) {
    return inflightFetches.get(url)!;
  }

  const fetchPromise = (async () => {
    try {
      // 1. Background fetch without aggressive browser HTTP caching so we get latest version
      let freshBlob: Blob | null = null;
      try {
        const response = await fetch(url, { 
          cache: 'no-cache',
          mode: 'cors'
        });

        if (response.ok) {
          freshBlob = await response.blob();
        }
      } catch (corsErr) {
        // Fallback for CORS: handled gracefully
      }

      if (freshBlob && freshBlob.size > 0) {
        // Check if existing cache has identical size and data
        let shouldUpdate = true;
        const db = await openImageDB();
        if (db) {
          try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(url);
            await new Promise<void>((res) => {
              req.onsuccess = () => {
                if (req.result && req.result.size === freshBlob!.size && req.result.size > 0) {
                  shouldUpdate = false;
                }
                res();
              };
              req.onerror = () => res();
            });
          } catch (e) {}
        }

        if (shouldUpdate) {
          // Pre-decode fresh image offscreen before displaying
          const freshObjectUrl = URL.createObjectURL(freshBlob);
          await decodeImageSilently(freshObjectUrl);

          memoryBlobUrlMap.set(url, freshObjectUrl);
          await saveImageToIndexedDB(url, freshBlob);

          if ('caches' in window) {
            try {
              const cache = await caches.open('tmf2-image-cache');
              await cache.put(url, new Response(freshBlob, {
                headers: {
                  'Content-Type': freshBlob.type || 'image/jpeg',
                  'X-Cached-At': Date.now().toString(),
                  'X-Blob-Size': freshBlob.size.toString()
                }
              }));
              console.log(`[Cache SWR] Gambar dikemaskini dari pelayan: ${url}`);
            } catch (cacheErr) {
              console.warn("Gagal simpan kemaskini gambar ke cache:", cacheErr);
            }
          }

          // Notify caller and broadcast event so UI updates smoothly
          if (onUpdate) {
            onUpdate(freshObjectUrl);
          }
          window.dispatchEvent(new CustomEvent('tmf2_image_updated', {
            detail: { url, freshUrl: freshObjectUrl }
          }));

          return freshObjectUrl;
        }
      }

      return memoryBlobUrlMap.get(url) || null;
    } catch (err) {
      // Background revalidation silently fails on offline or CORS
      return null;
    } finally {
      inflightFetches.delete(url);
    }
  })();

  inflightFetches.set(url, fetchPromise);
  return fetchPromise;
};

/**
 * Preloads a single image into persistent cache and memory cache in the background.
 */
export const preloadImageToCache = async (url?: string | null): Promise<string | null> => {
  if (!url || typeof window === 'undefined') return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // If already in memory cache, ready instantly
  const mem = memoryBlobUrlMap.get(url);
  if (mem) return mem;

  // Check persistent Cache
  const fromCache = await getImageFromCache(url);
  if (fromCache) {
    // SWR revalidate in background without blocking
    revalidateImageCache(url).catch(() => {});
    return fromCache;
  }

  // Not in cache, fetch & cache in background
  return revalidateImageCache(url);
};

/**
 * Preload a list of images (e.g. Chat images, Profile covers) in batches in the background
 */
export const preloadImages = async (urls: (string | undefined | null)[]): Promise<void> => {
  if (typeof window === 'undefined') return;
  const validUrls = Array.from(new Set(
    urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '' && !u.startsWith('data:') && !u.startsWith('blob:'))
  ));

  if (validUrls.length === 0) return;

  const preloadBatch = async () => {
    for (const url of validUrls) {
      try {
        await preloadImageToCache(url);
      } catch (e) {
        // Continue preloading next image
      }
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      preloadBatch();
    }, { timeout: 3000 });
  } else {
    setTimeout(preloadBatch, 100);
  }
};

/**
 * Warmed up early at app startup so that when the user opens the application,
 * the cover photo and community chat images are ALREADY loaded in memory for 0ms instant display!
 */
export const initImageCachePrewarm = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    // 1. Initialize IndexedDB connection
    await openImageDB();

    // 2. Identify critical images to pre-warm
    const urlsToPrewarm: string[] = [];

    // User's cover photo
    const coverUrl = localStorage.getItem('tmf2_cover');
    if (coverUrl && !coverUrl.startsWith('data:')) {
      urlsToPrewarm.push(coverUrl);
    }
    const defaultCover = "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/Fotokulit.png?alt=media&token=ef7f9ad4-0afc-4e0f-b000-11ce9f0a34db";
    urlsToPrewarm.push(defaultCover);

    // Recent posts from localStorage
    try {
      const savedPosts = localStorage.getItem('tmf2_posts');
      if (savedPosts) {
        const parsed = JSON.parse(savedPosts);
        if (Array.isArray(parsed)) {
          parsed.slice(0, 15).forEach((p: any) => {
            if (p.image && typeof p.image === 'string' && !p.image.startsWith('data:')) {
              urlsToPrewarm.push(p.image);
            }
            if (p.authorAvatar && typeof p.authorAvatar === 'string' && !p.authorAvatar.startsWith('data:')) {
              urlsToPrewarm.push(p.authorAvatar);
            }
          });
        }
      }
    } catch (e) {}

    // 3. Load from IndexedDB into memory map immediately
    for (const url of urlsToPrewarm) {
      try {
        const cachedUrl = await getImageFromIndexedDB(url);
        if (cachedUrl) {
          memoryBlobUrlMap.set(url, cachedUrl);
        }
      } catch (e) {}
    }

    // 4. Background revalidate in idle time
    preloadImages(urlsToPrewarm);
  } catch (err) {
    console.warn("[ImageCache] Prewarm notice:", err);
  }
};

// Temp upload cache helpers in localStorage to survive refresh during background process
export const saveTempUploadCache = (key: string, base64: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, base64);
  } catch (e) {
    console.warn("Failed to save temp upload cache:", e);
  }
};

export const getTempUploadCache = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

export const clearTempUploadCache = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (e) {}
};

export const clearAllLocalCaches = async (preserveAuth: boolean = true): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  // Clear in-memory URL map
  memoryBlobUrlMap.clear();
  inflightFetches.clear();

  // 1. Clear Cache Storage (e.g., Image cache, service worker caches)
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
        console.log(`[Cache] Deleted Cache Storage: ${key}`);
      }
    }
  } catch (e) {
    console.warn("Gagal memadam Cache Storage:", e);
  }

  // 2. Clear Session Storage (preserve dismissal state if preserving auth)
  try {
    if (!preserveAuth) {
      sessionStorage.clear();
      console.log("[Cache] SessionStorage cleared.");
    }
  } catch (e) {
    console.warn("Gagal memadam Session Storage:", e);
  }

  // 3. Clear Local Storage (selective cleanup if preserveAuth is true)
  try {
    if (preserveAuth) {
      // Retain auth-critical keys, remove only non-essential cached data
      const keysToKeep = new Set([
        'tmf2_cached_firebase_user',
        'tmf2_cached_user_doc',
        'tmf2_google_drive_token',
        'tmf2_chose_tetamu',
        'tmf2_guest_chosen',
        'tmf2_cover',
        'tmf2_cached_cover_data'
      ]);

      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }

      allKeys.forEach(k => {
        // Do not delete Firebase internal auth keys or critical session keys
        if (k.startsWith('firebase:authUser:') || k.startsWith('firebase:app:') || keysToKeep.has(k)) {
          return;
        }
        // Clear cached images, forms, or legacy caches
        if (k.startsWith('migrated_') || k.startsWith('tmf2_img_') || k.startsWith('tmf2_temp_')) {
          localStorage.removeItem(k);
        }
      });
      console.log("[Cache] Temporary image and data cache cleared while preserving auth session.");
    } else {
      localStorage.clear();
      console.log("[Cache] Full LocalStorage cleared for logout.");
    }
  } catch (e) {
    console.warn("Gagal memadam Local Storage:", e);
  }

  // 4. Unregister all service workers to ensure fresh code version on next load
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log("[Cache] Service Worker unregistered:", registration);
      }
    }
  } catch (e) {
    console.warn("Gagal nyahdaftar Service Worker:", e);
  }
};

