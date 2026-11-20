import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Fullscreen for the board. Uses the Fullscreen API where available and falls back to a
 * CSS "presentation" mode (fixed, full-viewport) on browsers without it, e.g. iPhone Safari.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>): {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
} {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = (): void => setIsNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  useEffect(() => {
    if (!isFallbackFullscreen) return undefined;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsFallbackFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFallbackFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }
    const target = targetRef.current;
    if (target && typeof target.requestFullscreen === 'function' && document.fullscreenEnabled) {
      target.requestFullscreen().catch(() => setIsFallbackFullscreen(true));
    } else {
      setIsFallbackFullscreen(true);
    }
  }, [isFallbackFullscreen, targetRef]);

  return { isFullscreen: isNativeFullscreen || isFallbackFullscreen, toggleFullscreen };
}
