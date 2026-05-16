import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeSelector({ isOpen, onClose, onSelect }) {
  const { premiumThemes, activeChatTheme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed inset-0 z-[100] flex flex-col bg-bg-amoled select-none"
        >
          {/* Header */}
          <header className="h-[72px] px-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Theme Neurality</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Select visual signature</p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
            >
              <X size={20} />
            </button>
          </header>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
            {Object.values(premiumThemes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => onSelect(theme.id)}
                className={`group relative aspect-[4/5] rounded-[32px] overflow-hidden border-2 transition-all active:scale-95 ${
                  activeChatTheme.id === theme.id ? "border-white" : "border-white/5 hover:border-white/20"
                }`}
              >
                {/* Background Gradient */}
                <div 
                  className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity"
                  style={{ background: theme.gradient }}
                />
                
                {/* Content Preview */}
                <div className="absolute inset-0 p-4 flex flex-col justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">{theme.name}</span>
                    {activeChatTheme.id === theme.id && (
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-black">
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                  
                  {/* Bubble Preview */}
                  <div className={`w-full h-8 rounded-xl ${theme.bubble} flex items-center px-3`}>
                    <div className="w-1/2 h-2 rounded-full bg-white/20" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <footer className="p-6 border-t border-white/5 bg-black/20">
            <p className="text-[10px] text-center font-bold uppercase tracking-[0.2em] text-muted leading-relaxed">
              Theme updates are synchronized in real-time<br/>with all conversation participants.
            </p>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
