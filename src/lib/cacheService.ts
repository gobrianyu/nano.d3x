import { LRUCache } from 'lru-cache';

const CACHE_NAME = 'pokedex-archive-v1';

/**
 * Cache for Image Blobs to satisfy the "LRU with max size" and "don't retry failed" requirement.
 * We store the blob URL (string) or a special "FAILED" token.
 * This is an in-memory layer for fast access to Object URLs during a session.
 */
const imageCache = new LRUCache<string, string | 'FAILED'>({
  max: 10000, 
  ttl: 1000 * 60 * 60 * 24, // 24 hours
  dispose: (value) => {
    if (value && value !== 'FAILED') {
      URL.revokeObjectURL(value);
    }
  },
});

/**
 * Centrally managed fetch for JSON data with persistent Cache API.
 */
export async function cachedFetch(url: string) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse) {
      return cachedResponse.json();
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Archive synchronization failed: ${response.status}`);
    }
    
    // Store in persistent cache
    await cache.put(url, response.clone());
    
    return response.json();
  } catch (error) {
    console.warn(`Cache fetch failed for ${url}, falling back to network`, error);
    const fallbackResponse = await fetch(url);
    if (!fallbackResponse.ok) throw error;
    return fallbackResponse.json();
  }
}

/**
 * Manager for image loading that respects LRU, failure caching, and persistent storage.
 */
export const imageCacheManager = {
  get: (url: string) => imageCache.get(url),
  set: (url: string, val: string | 'FAILED') => imageCache.set(url, val),
  
  async load(url: string): Promise<string> {
    // 1. Check in-memory LRU first (fastest, has object URL)
    const memoryCached = imageCache.get(url);
    if (memoryCached === 'FAILED') throw new Error('Retrying failed archive would compromise integrity');
    if (memoryCached) return memoryCached;

    try {
      const cache = await caches.open(CACHE_NAME);
      let response = await cache.match(url);
      
      if (!response) {
        response = await fetch(url, { referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Fetch failed');
        // Store in persistent cache
        await cache.put(url, response.clone());
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      this.set(url, objectUrl);
      return objectUrl;
    } catch (error) {
      this.set(url, 'FAILED');
      throw error;
    }
  }
};
