import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

export default function MuteOverlay({ isMuted, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]"
        >
          <div className="flex items-center justify-center rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-2xl p-6">
            {isMuted ? (
              <VolumeX size={40} className="text-white" />
            ) : (
              <Volume2 size={40} className="text-white" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
