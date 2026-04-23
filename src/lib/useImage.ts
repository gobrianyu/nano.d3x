import { useState, useEffect } from 'react';
import { imageCacheManager } from './cacheService';

export function useImage(url: string, enabled: boolean = true) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !url) return;
    
    let active = true;
    setLoading(true);
    setError(false);

    imageCacheManager.load(url)
      .then((objectUrl) => {
        if (active) {
          setSrc(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      // Note: We don't revoke here because the object URL is stored in imageCacheManager's LRU cache.
      // If we revoked it, other components using same URL would have a broken image.
      // Instead, we should ideally handle revocation when imageCacheManager evicts an entry.
    };
  }, [url, enabled]);

  return { src, error, loading };
}
