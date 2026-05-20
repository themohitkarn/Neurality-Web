import { uploadMedia } from "../services/uploadService";
import { ImagePlus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { 
  X, 
  Check, 
  Type, 
  Smile, 
  Palette, 
  SlidersHorizontal, 
  RotateCw, 
  Trash2, 
  Download,
  Layers,
  PenTool,
  Undo,
  Sparkles,
  Wand2
} from "lucide-react";
import { aiApi, getErrorMessage } from "../services/api";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { toBlob } from "html-to-image";
import { detectMediaDimensions } from "../utils/mediaUtils";

const FILTERS = [
  { id: "none", name: "Normal", filter: "none" },
  { id: "clarendon", name: "Aura", filter: "contrast(1.2) saturate(1.35)" },
  { id: "moon", name: "Moon", filter: "grayscale(1) contrast(1.1) brightness(1.1)" },
  { id: "lark", name: "Lark", filter: "brightness(1.1) contrast(0.9) saturate(1.2)" },
  { id: "reyes", name: "Vintage", filter: "sepia(0.3) brightness(1.1) contrast(0.85) saturate(0.75)" },
  { id: "juno", name: "Neon", filter: "sepia(0.2) contrast(1.3) brightness(1.1) saturate(2)" },
  { id: "aden", name: "Aden", filter: "sepia(0.2) brightness(1.15) saturate(1.4)" },
  { id: "cyber", name: "Cyber", filter: "hue-rotate(280deg) saturate(2.5) contrast(1.2)" },
  { id: "midnight", name: "Midnight", filter: "brightness(0.8) contrast(1.4) saturate(0.5) hue-rotate(200deg)" },
];

export default function MediaEditor({ media, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("filter"); // filter, adjust, text, sticker, draw, layers
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [layers, setLayers] = useState([]); // { id, type, content, x, y, scale, rotation }
  const [imageRotation, setImageRotation] = useState(0);
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    sepia: 0,
    hueRotate: 0,
    blur: 0,
  });
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentTextColor, setCurrentTextColor] = useState("#ffffff");
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#ffffff");
  const [drawingSize, setDrawingSize] = useState(5);
  const [paths, setPaths] = useState([]); // Array of { points, color, size }
  const [currentPath, setCurrentPath] = useState(null);

  // Helper to get current filter string
  const getFilterString = () => {
    const base = FILTERS.find(f => f.id === selectedFilter)?.filter || "none";
    const adj = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) sepia(${adjustments.sepia}%) hue-rotate(${adjustments.hueRotate}deg) blur(${adjustments.blur}px)`;
    return base === "none" ? adj : `${base} ${adj}`;
  };

  const startAddingText = () => {
    setIsAddingText(true);
    setCurrentText("");
    setActiveTab("text");
  };

  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (media.file) {
      setIsInitializing(true);
      detectMediaDimensions(media.file)
        .then(m => {
          if (isMounted) {
            setMeta(m);
            setIsInitializing(false);
          }
        })
        .catch(err => {
          console.error("Media analysis failed:", err);
          if (isMounted) setIsInitializing(false);
        });
    } else {
      setIsInitializing(false);
    }
    return () => { isMounted = false; };
  }, [media.file]);

  // Drawing Handlers
  const startDrawing = (e) => {
    if (activeTab !== "draw") return;
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentPath({ points: [{ x, y }], color: drawingColor, size: drawingSize });
  };

  const draw = (e) => {
    if (!isDrawing || activeTab !== "draw") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentPath(prev => ({
      ...prev,
      points: [...prev.points, { x, y }]
    }));
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
    }
  };

  const undoDrawing = () => {
    setPaths(paths.slice(0, -1));
  };

  const handleAiMagic = async () => {
    setIsAnalyzing(true);
    setAiAdvice("");
    try {
      const formData = new FormData();
      // media.file is the original File object passed from Drop.jsx
      formData.append("image", media.file);
      const { data } = await aiApi.editSuggestions(formData);
      
      // Apply suggested adjustments
      setAdjustments({
        brightness: data.brightness || 100,
        contrast: data.contrast || 100,
        saturate: data.saturate || 100,
        sepia: 0,
        hueRotate: 0,
        blur: 0,
      });
      setSelectedFilter(data.filter || "none");
      setAiAdvice(data.advice || "Optimized your photo with AI magic.");
      setActiveTab("adjust");
    } catch (err) {
      console.error(getErrorMessage(err));
      setAiAdvice("Failed to reach the magic spirits. Try again later.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmText = () => {
    if (!currentText.trim()) {
      setIsAddingText(false);
      return;
    }
    
    const newLayer = {
      id: Date.now(),
      type: "text",
      content: currentText,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      color: currentTextColor,
      fontSize: 32,
      fontFamily: "Inter, sans-serif"
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
    setIsAddingText(false);
    setCurrentText("");
  };

  const addSticker = (emoji) => {
    const newLayer = {
      id: Date.now(),
      type: "sticker",
      content: emoji,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };


  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await uploadMedia(file);
      console.log(data.url);

      const newLayer = {
        id: Date.now(),
        type: "image",
        content: data.url,
        x: 50,
        y: 50,
        scale: 1,
        rotation: 0,
      };

      setLayers((prev) => [...prev, newLayer]);
    } catch (err) {
      console.log(err);
    }
  };


  const handleExport = async () => {
    if (!editorRef.current) return;
    setIsExporting(true);
    
    try {
      // Clear selection before export
      setSelectedLayerId(null);
      
      // Wait a bit for UI to update
      await new Promise(r => setTimeout(r, 100));
      
      let blob = null;
      if (media.type !== "video") {
        blob = await toBlob(editorRef.current, {
          quality: 0.95,
          cacheBust: true,
          fontEmbedCSS: "", // Skip font embedding to avoid CORS SecurityError
          // Filter out cross-origin stylesheets that cause SecurityError
          filter: (node) => {
            if (node.tagName === "LINK" && node.rel === "stylesheet") {
              try {
                // Test if we can access the stylesheet
                return !!node.sheet;
              } catch (e) {
                return false;
              }
            }
            return true;
          }
        });
      }
      
      onSave({
        blob,
        layers,
        paths,
        selectedFilter,
        imageRotation,
        adjustments
      });
    } catch (err) {
      console.error("Export error:", err);
      // Fallback: try to export just the image if the whole container fails
      alert("Failed to export full canvas due to security restrictions. Try again or check console.");
    } finally {
      setIsExporting(false);
    }
  };


  const removeLayer = (id) => {
    setLayers(layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const orientation = meta?.orientation || "portrait";
  const isLandscape = orientation === "landscape";

  if (isInitializing) {
    return (
      <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="w-12 h-12 border-4 border-[color:var(--accent)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white/60 font-medium animate-pulse">Analyzing media...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 z-50 bg-black/50 backdrop-blur-md">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white">
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all shrink-0"
          >
            <ImagePlus size={20} />
          </button>

          {[
            { id: "filter", icon: Palette },
            { id: "adjust", icon: SlidersHorizontal },
            { id: "text", icon: Type, action: startAddingText },
            { id: "sticker", icon: Smile },
            { id: "draw", icon: PenTool },
            { id: "layers", icon: Layers },
            { id: "magic", icon: Sparkles, color: "var(--accent)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.action ? tab.action() : setActiveTab(tab.id)}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${activeTab === tab.id
                  ? "bg-white text-black scale-110 shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"}`}
              style={{ color: activeTab === tab.id ? "" : tab.color }}
            >
              <tab.icon size={20} />
            </button>
          ))}


          <button 
            onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
            className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all shrink-0"
          >
            <RotateCw size={20} />
          </button>
        </div>

        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[color:var(--accent)] text-white font-bold disabled:opacity-50 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
        >
          {isExporting ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
          <span>{isExporting ? "Saving..." : "Done"}</span>
        </button>
      </div>

      {/* Editor Surface */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-6 bg-[#0c0c0e]">
        {/* Adaptive Viewport Container */}
        <div 
          ref={editorRef}
          className={`relative max-w-full max-h-full bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-500`}
          style={{ 
            aspectRatio: isLandscape ? "16/9" : "9/16",
            width: isLandscape ? "90%" : "auto",
            height: isLandscape ? "auto" : "85dvh",
            minWidth: isLandscape ? "min(90%, 600px)" : "min(80vw, 400px)",
          }}
          onClick={() => setSelectedLayerId(null)}
        >
          {/* Background blurred element for landscape */}
          {isLandscape && (
            <div className="absolute inset-0 z-0 opacity-40 blur-3xl scale-110">
              <img src={media.url} className="w-full h-full object-cover" alt="" />
            </div>
          )}

          {media.type === "video" ? (
            <video
              src={media.url}
              className={`w-full h-full transition-all duration-300 z-10 ${media.content ? "blur-2xl scale-110 opacity-60" : ""} ${isLandscape ? "object-contain" : "object-cover"}`}
              style={{ 
                filter: getFilterString(),
                transform: `rotate(${imageRotation}deg)`
              }}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img 
              src={media.url} 
              alt="Original" 
              crossOrigin="anonymous"
              className={`w-full h-full transition-all duration-300 z-10 ${media.content ? "blur-2xl scale-110 opacity-60" : ""} ${isLandscape ? "object-contain" : "object-cover"}`}
              style={{ 
                filter: getFilterString(),
                transform: `rotate(${imageRotation}deg)`
              }}
              draggable={false}
            />
          )}

          {/* Shared Content Card */}
          {media.content && (
            <div className="absolute inset-0 flex items-center justify-center p-8 z-20 pointer-events-none">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full aspect-[4/5] bg-[#1a1a1a] rounded-[32px] overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col"
              >
                {/* User Header */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-white/10">
                    <img src={media.content?.author?.profile_pic || ""} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-bold text-white">{media.content?.author?.username || "Neurality User"}</span>
                </div>
                
                {/* Media Preview */}
                <div className="flex-1 bg-black relative">
                  <img src={media.url} className="w-full h-full object-cover" />
                  {media.content.type === "reel" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <RotateCw size={24} className="animate-spin-slow" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* App Brand */}
                <div className="p-4 bg-gradient-to-t from-black/20 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="text-[11px] font-bold tracking-widest uppercase opacity-60">Neurality</span>
                  </div>
                  <span className="text-[10px] opacity-40">Shared via Beat</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Drawing Canvas Overlay */}
          <div 
            className="absolute inset-0 z-10"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
          >
            <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {paths.map((path, i) => (
                <polyline
                  key={i}
                  points={path.points.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.size / 5} // Normalize size relative to 100px viewbox
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath && (
                <polyline
                  points={currentPath.points.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={currentPath.color}
                  strokeWidth={currentPath.size / 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>

          {/* Layers */}
          {layers.map((layer) => (
            <motion.div
              key={`${layer.id}-${layer.x}-${layer.y}`}
              drag
              dragMomentum={false}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: layer.id === selectedLayerId ? layer.scale * 1.1 : layer.scale,
                opacity: 1,
                rotate: layer.rotation
              }}
              onDragStart={() => setSelectedLayerId(layer.id)}
              onDragEnd={(event, info) => {
                const container = editorRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const newX = ((info.point.x - rect.left) / rect.width) * 100;
                const newY = ((info.point.y - rect.top) / rect.height) * 100;
                
                setLayers(layers.map(l => l.id === layer.id ? { 
                  ...l, 
                  x: Math.max(0, Math.min(100, newX)), 
                  y: Math.max(0, Math.min(100, newY)) 
                } : l));
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLayerId(layer.id);
              }}
              className={`absolute cursor-move select-none p-2 rounded-lg ${layer.id === selectedLayerId ? "ring-2 ring-white/50 bg-white/10" : ""}`}
              style={{ left: `${layer.x}%`, top: `${layer.y}%`, transform: "translate(-50%, -50%)" }}
            >

              {layer.type === "text" ? (
                <div
                  style={{
                    color: layer.color,
                    fontSize: layer.fontSize,
                    fontWeight: "bold",
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxWidth: "250px",
                  }}
                >
                  {layer.content}
                </div>
              ) : layer.type === "image" ? (
                <img
                  src={layer.content}
                  crossOrigin="anonymous"
                  className="max-w-[200px] rounded-2xl shadow-2xl"
                  draggable={false}
                />
              ) : (
                <div className="text-6xl">
                  {layer.content}
                </div>
              )}

              
              {layer.id === selectedLayerId && (
                <button 
                  onClick={() => removeLayer(layer.id)}
                  className="absolute -top-8 -right-8 p-1.5 rounded-full bg-red-500 text-white shadow-lg"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))}

          {/* Inline Text Editor Overlay */}
          <AnimatePresence>
            {isAddingText && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  placeholder="Type something..."
                  className="w-full bg-transparent text-center text-3xl font-bold border-none outline-none resize-none text-white placeholder-white/30"
                  rows={3}
                />
                
                <div className="flex gap-3 mt-8">
                  {["#ffffff", "#000000", "#ff4757", "#2ed573", "#1e90ff", "#eccc68"].map(color => (
                    <button
                      key={color}
                      onClick={() => setCurrentTextColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${currentTextColor === color ? "border-white scale-125" : "border-transparent"}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>

                <div className="flex gap-4 mt-12">
                  <button onClick={() => setIsAddingText(false)} className="px-6 py-2 rounded-full bg-white/10 font-semibold">Cancel</button>
                  <button onClick={confirmText} className="px-8 py-2 rounded-full bg-white text-black font-bold">Add Text</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 min-h-[180px]">
        <AnimatePresence mode="wait">
          {activeTab === "filter" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className="flex flex-col items-center gap-2 shrink-0 group"
                >
                  <div 
                    className={`w-16 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedFilter === f.id ? "border-white scale-105" : "border-transparent group-hover:border-white/30"}`}
                  >
                    {media.type === "video" ? (
                      <video 
                        src={media.url} 
                        className="w-full h-full object-cover" 
                        style={{ filter: f.filter }}
                        muted
                      />
                    ) : (
                      <img 
                        src={media.url} 
                        className="w-full h-full object-cover" 
                        style={{ filter: f.filter }}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${selectedFilter === f.id ? "text-white" : "text-zinc-500"}`}>
                    {f.name}
                  </span>
                </button>
              ))}
            </motion.div>
          )}

          {activeTab === "adjust" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="grid grid-cols-1 gap-4"
            >
              {[
                { label: "Brightness", key: "brightness", min: 0, max: 200 },
                { label: "Contrast", key: "contrast", min: 0, max: 200 },
                { label: "Saturate", key: "saturate", min: 0, max: 200 },
                { label: "Sepia", key: "sepia", min: 0, max: 100 },
                { label: "Hue Rotate", key: "hueRotate", min: 0, max: 360 },
              ].map((adj) => (
                <div key={adj.key} className="flex items-center gap-4">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-20">{adj.label}</span>
                  <input 
                    type="range"
                    min={adj.min}
                    max={adj.max}
                    value={adjustments[adj.key]}
                    onChange={(e) => setAdjustments({...adjustments, [adj.key]: parseInt(e.target.value)})}
                    className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white"
                  />
                  <span className="text-[10px] text-zinc-400 w-8">{adjustments[adj.key]}</span>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "sticker" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="grid grid-cols-6 gap-4 overflow-y-auto max-h-40 p-2"
            >
              {["🔥", "✨", "💯", "❤️", "😍", "🙌", "👑", "🚀", "💀", "🎉", "🌈", "🍕", "🍔", "🍦", "🎸", "🎮", "📸", "💡"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addSticker(emoji)}
                  className="text-4xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}

          {activeTab === "draw" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {["#ffffff", "#000000", "#ff4757", "#2ed573", "#1e90ff", "#eccc68"].map(color => (
                    <button
                      key={color}
                      onClick={() => setDrawingColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${drawingColor === color ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <button onClick={undoDrawing} className="p-2 rounded-lg bg-white/10 text-white">
                  <Undo size={18} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-16">Brush</span>
                <input 
                  type="range"
                  min="1"
                  max="20"
                  value={drawingSize}
                  onChange={(e) => setDrawingSize(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white"
                />
              </div>
            </motion.div>
          )}

          {activeTab === "layers" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-4 max-h-[200px] overflow-y-auto pr-2"
            >
              {layers.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-4">No layers added yet</p>
              ) : (
                <div className="space-y-2">
                  {layers.map((layer) => (
                    <div 
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedLayerId === layer.id ? "bg-white/10 border-white/30" : "bg-white/5 border-transparent"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-sm">
                          {layer.type === "text" ? (
                            <div
                              style={{
                                color: layer.color,
                                fontSize: "10px",
                                fontWeight: "bold",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "60px",
                              }}
                            >
                              {layer.content}
                            </div>
                          ) : layer.type === "image" ? (
                            <img
                              src={layer.content}
                              crossOrigin="anonymous"
                              className="w-6 h-6 rounded object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="text-lg">
                              {layer.content}
                            </div>
                          )}

                        </div>
                        <span className="text-xs font-medium text-white capitalize">{layer.type} layer</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }} className="text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {selectedLayerId && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 pt-4 border-t border-white/5 space-y-4"
            >
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-16">Size</span>
                <input 
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={layers.find(l => l.id === selectedLayerId)?.scale || 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLayers(layers.map(l => l.id === selectedLayerId ? { ...l, scale: val } : l));
                  }}
                  className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-16">Rotate</span>
                <input 
                  type="range"
                  min="0"
                  max="360"
                  value={layers.find(l => l.id === selectedLayerId)?.rotation || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLayers(layers.map(l => l.id === selectedLayerId ? { ...l, rotation: val } : l));
                  }}
                  className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white"
                />
              </div>
            </motion.div>
          )}
          {activeTab === "magic" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col items-center justify-center py-6 gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[color:var(--accent)] to-purple-500 flex items-center justify-center text-white shadow-lg">
                <Wand2 size={32} className={isAnalyzing ? "animate-pulse" : ""} />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-white mb-1">AI Photo Enhancer</h3>
                <p className="text-xs text-zinc-500 max-w-[240px] mx-auto">
                  Let Gemini analyze your photo and suggest the best filters and adjustments.
                </p>
              </div>
              
              {aiAdvice && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-zinc-400 italic text-center max-w-[300px]">
                  "{aiAdvice}"
                </div>
              )}

              <button
                onClick={handleAiMagic}
                disabled={isAnalyzing}
                className="mt-2 flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform disabled:opacity-50"
              >
                {isAnalyzing ? "Analyzing Frame..." : "Enhance with AI"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
