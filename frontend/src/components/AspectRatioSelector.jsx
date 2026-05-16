import { motion } from "framer-motion";
import { Maximize, Square, Image as ImageIcon, Monitor } from "lucide-react";

const ratios = [
  { id: "9:16", label: "9:16", icon: Monitor, className: "aspect-[9/16]" },
  { id: "4:5", label: "4:5", icon: ImageIcon, className: "aspect-[4/5]" },
  { id: "1:1", label: "1:1", icon: Square, className: "aspect-[1/1]" },
  { id: "16:9", label: "16:9", icon: Maximize, className: "aspect-[16/9]" },
];

export default function AspectRatioSelector({ activeRatio, onChange }) {
  return (
    <div className="space-y-4">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
        Aspect Ratio
      </label>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar">
        {ratios.map((ratio) => {
          const Icon = ratio.icon;
          const isActive = activeRatio === ratio.id;
          
          return (
            <motion.button
              key={ratio.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(ratio.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${
                isActive
                  ? "bg-[color:var(--accent-soft)] border-[color:var(--accent)] text-[color:var(--accent)] shadow-lg shadow-[color:var(--accent)]/10"
                  : "bg-zinc-900/50 border-white/10 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <div className={`w-8 flex items-center justify-center border-2 border-current rounded-md overflow-hidden ${ratio.className} p-0.5`}>
                 <Icon size={14} className="opacity-40" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{ratio.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
