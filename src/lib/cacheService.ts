import { LRUCache } from 'lru-cache';

/**
 * Cache for Image Blobs to satisfy the "LRU with max size" and "don't retry failed" requirement.
 * We store the blob URL (string) or a special "FAILED" token.
 */
const imageCache = new LRUCache<string, string | 'FAILED'>({
  max: 10000, // Effectively "unlimited" for the current dataset scope (~3000 images)
  // We can also use maxSize/sizeCalculation if we want to limit total bytes, 
  // but for simple images, max items is usually sufficient for a portfolio.
  ttl: 1000 * 60 * 60 * 24, // 24 hours
  dispose: (value) => {
    if (value && value !== 'FAILED') {
      URL.revokeObjectURL(value);
    }
  },
});

/**
 * Centrally managed fetch for JSON data. 
 * React Query handles the caching of the JSON objects themselves.
 */
export async function cachedFetch(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Archive synchronization failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Manager for image loading that respects LRU and failure caching.
 */
export const imageCacheManager = {
  get: (url: string) => imageCache.get(url),
  set: (url: string, val: string | 'FAILED') => imageCache.set(url, val),
  
  async load(url: string): Promise<string> {
    const cached = imageCache.get(url);
    if (cached === 'FAILED') throw new Error('Retrying failed archive would compromise integrity');
    if (cached) return cached;

    try {
      const response = await fetch(url, { referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Fetch failed');
      
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
