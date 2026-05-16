import React from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Play, FileText } from "lucide-react";
import { useMedia } from "../../context/MediaContext";

export default function SharedMediaGrid({ media = [], isLoading }) {
  const { openMedia } = useMedia();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="aspect-square bg-white/5 rounded-sm" />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
        <ImageIcon size={40} strokeWidth={1} className="mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Shared Signals</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {media.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => openMedia(item.url, item.type.includes('video') ? 'video' : 'image')}
          className="relative aspect-square bg-white/5 cursor-pointer group overflow-hidden"
        >
          <img 
            src={item.url} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            alt="Shared Media"
          />
          
          {/* Overlay Icons */}
          {item.type.includes('video') || item.type.includes('reel') ? (
            <div className="absolute top-2 right-2 text-white drop-shadow-lg">
              <Play size={14} fill="currentColor" />
            </div>
          ) : null}

          {/* Hover State */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
      ))}
    </div>
  );
}
