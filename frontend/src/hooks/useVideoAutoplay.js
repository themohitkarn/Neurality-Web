import { useEffect, useRef, useState, useCallback } from "react";
import { useVideoPlayback } from "../context/VideoPlaybackContext";

export function useVideoAutoplay(id, threshold = 0.7) {
  const containerRef = useRef(null);
  const { activeVideoId, setActiveVideoId, isPlaybackEnabled } = useVideoPlayback();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting) {
            setActiveVideoId(id);
          } else {
            // Unset if this was the active video
            setActiveVideoId((prevId) => (prevId === id ? null : prevId));
          }
        });
      },
      {
        threshold,
        rootMargin: "0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.unobserve(node);
      observer.disconnect();
    };
  }, [id, setActiveVideoId, threshold]);

  const isActive = activeVideoId === id && isPlaybackEnabled && isVisible;

  return { containerRef, isActive };
}
