import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

export default function AdaptiveEditorViewport({ 
  src, 
  type = "image", 
  meta, 
  className = "",
  showControls = true,
  children 
}) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const mediaRef = useRef(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Reset scale and position when src changes
  useEffect(() => {
    setScale(1);
    x.set(0);
    y.set(0);
  }, [src, x, y]);

  if (!src) return null;

  const isVideo = type === "video" || src.includes(".mp4");
  const orientation = meta?.orientation || "portrait";
  const aspectRatio = meta?.aspectRatio || "9:16";

  // Fit logic
  // Landscape should usually be 'contain' with a backdrop
  // Portrait should be 'cover' or 'contain' depending on how immersive we want it
  const objectFit = orientation === "landscape" ? "contain" : "cover";

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden bg-black rounded-3xl group ${className}`}
      style={{ 
        aspectRatio: isFullscreen ? "unset" : (orientation === "landscape" ? "16/9" : "9/16"),
        height: isFullscreen ? "100%" : "auto"
      }}
    >
      {/* Blurred Backdrop for Landscape */}
      {orientation === "landscape" && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50 blur-3xl scale-110">
          <img src={src} className="w-full h-full object-cover" alt="" />
        </div>
      )}

      {/* Media Canvas */}
      <div className="relative w-full h-full flex items-center justify-center z-10">
        <motion.div
          drag={scale > 1}
          dragMomentum={false}
          dragConstraints={containerRef}
          style={{ x, y, scale }}
          className="w-full h-full flex items-center justify-center"
        >
          {isVideo ? (
            <video
              ref={mediaRef}
              src={src}
              className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
              loop
              muted
              autoPlay
              playsInline
            />
          ) : (
            <img
              ref={mediaRef}
              src={src}
              className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
              alt="Preview"
              draggable={false}
            />
          )}
        </motion.div>
      </div>

      {/* Overlays / Children */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {children}
      </div>

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            type="button"
            onClick={() => setScale(prev => Math.min(prev + 0.2, 3))}
            className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            type="button"
            onClick={() => {
              setScale(1);
              x.set(0);
              y.set(0);
            }}
            className="px-2 text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest"
          >
            Reset
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            type="button"
            onClick={() => setScale(prev => Math.max(prev - 0.2, 1))}
            className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <div className="w-px h-4 bg-white/10 ml-2" />
          <button 
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      )}

      {/* Media Meta Info Overlay */}
      <div className="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
        <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
          {meta?.width}x{meta?.height} • {meta?.aspectRatio}
        </span>
      </div>
    </div>
  );
}
