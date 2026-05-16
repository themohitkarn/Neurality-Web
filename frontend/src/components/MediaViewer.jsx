import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share2, Maximize2 } from "lucide-react";
import { useMedia } from "../context/MediaContext";

export default function MediaViewer() {
  const { activeMedia, closeMedia } = useMedia();

  if (!activeMedia) return null;

  return (
    <AnimatePresence>
      {activeMedia && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4"
          onClick={closeMedia}
        >
          {/* Header */}
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={closeMedia}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
              {activeMedia.sender && (
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{activeMedia.sender.username}</p>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Neural Signal</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                <Download size={18} />
              </button>
              <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                <Share2 size={18} />
              </button>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {activeMedia.type === "image" ? (
              <img 
                src={activeMedia.url} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                alt="Neural Capture"
              />
            ) : activeMedia.type === "video" ? (
              <video 
                src={activeMedia.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : null}
          </motion.div>

          {/* Footer / Hint */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-10 text-white/20 text-[10px] font-black uppercase tracking-[0.3em] pointer-events-none"
          >
            Swipe down to dismiss
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
