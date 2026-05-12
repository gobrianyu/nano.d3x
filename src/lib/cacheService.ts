import { LRUCache } from 'lru-cache';

const CACHE_NAME = 'pokedex-archive-v2';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

/**
 * In-memory layer for fast access to Object URLs during a session.
 * We still use this because Object URLs are session-specific and 
 * must be revoked eventually.
 */
const imageCache = new LRUCache<string, string | 'FAILED'>({
  max: 2000, 
  dispose: (value) => {
    if (value && value !== 'FAILED') {
      URL.revokeObjectURL(value);
    }
  },
});

/**
 * Helper to check if a cached response is expired.
 */
function isExpired(response: Response): boolean {
  const timestamp = response.headers.get('X-Pokedex-Timestamp');
  if (!timestamp) return false;
  const age = Date.now() - parseInt(timestamp, 10);
  return age > CACHE_TTL;
}

/**
 * Creates a "Failure" response for negative caching.
 */
function createFailureResponse(): Response {
  return new Response(JSON.stringify({ error: 'Resource missing' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'X-Pokedex-Status': 'FAILED',
      'X-Pokedex-Timestamp': Date.now().toString()
    }
  });
}

/**
 * Wraps a successful response with a timestamp for expiration tracking.
 */
async function wrapWithTimestamp(response: Response): Promise<Response> {
  const blob = await response.blob();
  const headers = new Headers(response.headers);
  headers.set('X-Pokedex-Timestamp', Date.now().toString());
  headers.set('X-Pokedex-Status', 'SUCCESS');
  
  return new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

/**
 * Centrally managed fetch for JSON data with persistent Cache API and negative caching.
 */
export async function cachedFetch(url: string) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(url);
  
  if (cachedResponse) {
    if (isExpired(cachedResponse)) {
      await cache.delete(url);
    } else {
      if (cachedResponse.headers.get('X-Pokedex-Status') === 'FAILED') {
        throw new Error(`Known non-existent resource (cached): ${url}`);
      }
      return cachedResponse.clone().json();
    }
  }

  try {
    const response = await fetch(url);
    
    if (response.status >= 400 && response.status < 500) {
      // Persistent negative caching for client errors (non-existent resources)
      await cache.put(url, createFailureResponse());
      throw new Error(`Archive synchronization failed: ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`Archive synchronization failed: ${response.status}`);
    }
    
    const stamped = await wrapWithTimestamp(response.clone());
    await cache.put(url, stamped);
    
    return response.json();
  } catch (error) {
    console.error(`Persistent fetch failed for ${url}`, error);
    throw error;
  }
}

/**
 * Manager for image loading that respects persistent storage, negative caching, and in-memory LRU.
 */
export const imageCacheManager = {
  get: (url: string) => imageCache.get(url),
  set: (url: string, val: string | 'FAILED') => imageCache.set(url, val),
  
  async load(url: string): Promise<string> {
    // 1. Check in-memory LRU first (fastest, has object URL)
    const memoryCached = this.get(url);
    if (memoryCached === 'FAILED') throw new Error('Persistent failure cached (memory)');
    if (memoryCached) return memoryCached;

    // 2. Check persistent cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse) {
      if (isExpired(cachedResponse)) {
        await cache.delete(url);
      } else if (cachedResponse.headers.get('X-Pokedex-Status') === 'FAILED') {
        this.set(url, 'FAILED');
        throw new Error('Persistent failure cached');
      } else {
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        this.set(url, objectUrl);
        return objectUrl;
      }
    }

    // 3. Network fallback
    try {
      const response = await fetch(url, { referrerPolicy: 'no-referrer' });
      
      if (response.status >= 400 && response.status < 500) {
        await cache.put(url, createFailureResponse());
        this.set(url, 'FAILED');
        throw new Error(`Fetch failed: ${response.status}`);
      }

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      
      const stamped = await wrapWithTimestamp(response.clone());
      await cache.put(url, stamped);
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.set(url, objectUrl);
      return objectUrl;
    } catch (error) {
      // We don't necessarily cache "network errors" (like offline) as "FAILED", 
      // only specific API/CDN failures like 404s.
      throw error;
    }
  }
};
