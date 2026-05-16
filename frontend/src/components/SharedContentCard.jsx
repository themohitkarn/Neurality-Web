import { motion, AnimatePresence } from "framer-motion";
import { Play, FileText, User, Share2, Music, Waves, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";

/**
 * PRODUCTION-GRADE SHARED CONTENT CARD (FIXED)
 * Features:
 * - Direct navigation on click
 * - Explicit 'Watch Now' button
 * - Rebranded BEAT labels
 * - Cinematic hover effects
 */
export default function SharedContentCard({ type, data }) {
  const navigate = useNavigate();

  // Robust normalization for structured data
  const content = (() => {
    if (!data) return null;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return { content: data }; }
    }
    return data;
  })();

  if (!content) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const route = content.route || (type.includes("beat") || type.includes("reel") ? `/beat?id=${content.id}` : null);
    if (route) {
      navigate(route);
    }
  };

  const getLabel = () => {
    switch (type) {
      case "shared_beat":
      case "shared_reel": return "BEAT";
      case "shared_post": return "DROP";
      case "shared_story": return "STORY";
      case "shared_profile": return "USER";
      default: return "CONTENT";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "shared_beat":
      case "shared_reel": return <Play size={14} fill="white" />;
      case "shared_post": return <FileText size={14} />;
      case "shared_profile": return <User size={14} />;
      default: return <Share2 size={14} />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="relative w-[230px] h-[310px] rounded-[30px] overflow-hidden bg-zinc-900 border border-white/5 cursor-pointer group shadow-2xl flex-shrink-0 select-none"
    >
      {/* Media Content */}
      <div className="absolute inset-0 z-0">
        {content.thumbnail ? (
          <img 
            src={content.thumbnail} 
            alt="Content" 
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
            <div className="opacity-20">{getIcon()}</div>
          </div>
        )}
        {/* Cinematic Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />
        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Top Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
        <div className="text-indigo-400">{getIcon()}</div>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">{getLabel()}</span>
      </div>

      {/* Content Info */}
      <div className="absolute bottom-4 left-4 right-4 z-20">
        <div className="flex items-center gap-2 mb-2">
          <Avatar src={content?.creator?.profile_pic} size="xs" className="ring-1 ring-white/10" name={content?.creator?.username} />
          <span className="text-[10px] font-bold text-white/60 truncate">{content?.creator?.username || "Creator"}</span>
        </div>
        <p className="text-xs font-bold text-white mb-3 line-clamp-2 leading-tight">
          {content?.title || content?.caption || "Shared Content"}
        </p>
        
        {/* Interactive Button Overlay */}
        <button className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-indigo-600 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
          <ExternalLink size={12} />
          View Beat
        </button>
      </div>

      {/* Waveform for Beats */}
      {(type.includes("beat") || type.includes("reel")) && (
        <div className="absolute top-14 left-4 right-4 h-4 flex items-end gap-[2px] opacity-40 group-hover:opacity-100 transition-opacity">
          {[0.3, 0.6, 0.4, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.6].map((h, i) => (
            <motion.div 
              key={i}
              animate={{ height: [`${h*100}%`, `${(1-h)*100}%`, `${h*100}%`] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              className="flex-1 bg-white rounded-t-sm"
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
