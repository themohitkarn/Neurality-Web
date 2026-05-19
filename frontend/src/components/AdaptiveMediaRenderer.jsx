import { useState, useEffect, forwardRef } from "react";

/**
 * AdaptiveMediaRenderer
 * Renders media (image/video) preserving its original aspect ratio.
 * Handles Portrait (9:16/4:5), Landscape (16:9), and Square (1:1).
 */
const AdaptiveMediaRenderer = forwardRef(({
  src,
  type = "image",
  alt = "",
  aspectRatio = "9:16",
  orientation = "portrait",
  isMuted = false,
  isPlaying = false,
  className = "",
  containerClassName = "",
  showControls = false,
}, ref) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = ref?.current;
    if (video && type === "video") {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying, type, ref]);

  // Determine styles based on orientation
  const isPortrait = orientation === "portrait" || aspectRatio === "9:16" || aspectRatio === "4:5";
  const isLandscape = orientation === "landscape" || aspectRatio === "16:9";
  const isSquare = orientation === "square" || aspectRatio === "1:1";

  // Base container classes
  let containerStyles = "relative w-full h-full flex items-center justify-center bg-black overflow-hidden";
  
  // Media styles
  let mediaStyles = "w-full h-full transition-opacity duration-500";
  if (!isLoaded) mediaStyles += " opacity-0";
  else mediaStyles += " opacity-100";

  // Layout logic
  if (isPortrait) {
    // Fullscreen immersive for vertical
    mediaStyles += " object-cover";
  } else if (isLandscape || isSquare) {
    // Centered cinematic for landscape/square
    mediaStyles += " object-contain";
  }

  return (
    <div className={`${containerStyles} ${containerClassName}`}>
      {/* Main Media */}
      {type === "video" ? (
        <video
          ref={ref}
          src={src}
          className={`${mediaStyles} z-10 ${className}`}
          muted={isMuted}
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setIsLoaded(true)}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${mediaStyles} z-10 ${className}`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
});

AdaptiveMediaRenderer.displayName = "AdaptiveMediaRenderer";

export default AdaptiveMediaRenderer;
