import React, { useState, useEffect, useRef } from 'react';
import { 
  getImageFromCache, 
  getSynchronousCachedImageUrl, 
  revalidateImageCache,
  decodeImageSilently
} from '../utils/imageUtils';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ 
  src, 
  fallback, 
  className = '', 
  alt = '', 
  onLoad,
  onError,
  ...props 
}) => {
  // 1. Synchronously resolve from in-memory cache or fast-tier cache (0ms instant display)
  const initialSrc = (() => {
    if (!src) return fallback || '';
    if (src.startsWith('data:') || src.startsWith('blob:')) return src;
    const synchronous = getSynchronousCachedImageUrl(src);
    if (synchronous) return synchronous;
    return src || fallback || '';
  })();

  const [displaySrc, setDisplaySrc] = useState<string>(initialSrc);
  const [isLoaded, setIsLoaded] = useState(() => {
    return Boolean(src && (src.startsWith('data:') || src.startsWith('blob:') || getSynchronousCachedImageUrl(src)));
  });

  const activeSrcRef = useRef(src);
  activeSrcRef.current = src;
  const currentDisplayRef = useRef(displaySrc);
  currentDisplayRef.current = displaySrc;

  useEffect(() => {
    if (!src) {
      setDisplaySrc(fallback || '');
      setIsLoaded(true);
      return;
    }

    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setDisplaySrc(src);
      setIsLoaded(true);
      return;
    }

    let active = true;

    // Check synchronous memory cache immediately
    const memCached = getSynchronousCachedImageUrl(src);
    if (memCached && currentDisplayRef.current !== memCached) {
      setDisplaySrc(memCached);
      setIsLoaded(true);
    }

    const loadAndRevalidate = async () => {
      // 1. Try to load from persistent Cache (IndexedDB or Cache Storage)
      try {
        const cachedUrl = await getImageFromCache(src);
        if (cachedUrl && active && activeSrcRef.current === src) {
          if (cachedUrl !== currentDisplayRef.current) {
            // Silently pre-decode offscreen to prevent any blank blink or layout shift
            await decodeImageSilently(cachedUrl);
            if (active && activeSrcRef.current === src) {
              setDisplaySrc(cachedUrl);
              setIsLoaded(true);
            }
          }
        } else if (active && !memCached && activeSrcRef.current === src && !currentDisplayRef.current) {
          setDisplaySrc(src);
        }

        // 2. Stale-While-Revalidate: fetch latest in background and smoothly update if changed
        await revalidateImageCache(src, async (freshUrl) => {
          if (active && activeSrcRef.current === src && freshUrl !== currentDisplayRef.current) {
            // Silently decode the fresh image before showing
            await decodeImageSilently(freshUrl);
            if (active && activeSrcRef.current === src) {
              setDisplaySrc(freshUrl);
              setIsLoaded(true);
            }
          }
        });
      } catch (err) {
        if (active && activeSrcRef.current === src && !memCached && !currentDisplayRef.current) {
          setDisplaySrc(src);
        }
      }
    };

    loadAndRevalidate();

    // 3. Listen for broadcast image updates (e.g. from file uploads or background preloads)
    const handleImageUpdated = async (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string; freshUrl: string }>;
      if (customEvent.detail?.url === src && customEvent.detail?.freshUrl && active) {
        const fresh = customEvent.detail.freshUrl;
        if (fresh !== currentDisplayRef.current) {
          await decodeImageSilently(fresh);
          if (active && activeSrcRef.current === src) {
            setDisplaySrc(fresh);
            setIsLoaded(true);
          }
        }
      }
    };

    window.addEventListener('tmf2_image_updated', handleImageUpdated);

    return () => {
      active = false;
      window.removeEventListener('tmf2_image_updated', handleImageUpdated);
    };
  }, [src, fallback]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallback && displaySrc !== fallback) {
      setDisplaySrc(fallback);
    }
    onError?.(e);
  };

  return (
    <img 
      src={displaySrc} 
      alt={alt}
      className={`${className} transition-opacity duration-300 ease-out ${isLoaded ? 'opacity-100' : 'opacity-80'}`}
      onLoad={handleImageLoad}
      onError={handleImageError}
      loading="lazy"
      decoding="async"
      {...props} 
    />
  );
};

export default CachedImage;
