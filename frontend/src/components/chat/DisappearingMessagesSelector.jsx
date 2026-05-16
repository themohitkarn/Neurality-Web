import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Check, AlertCircle } from "lucide-react";

const INTERVALS = [
  { id: 0, label: "Off", desc: "Messages stay forever", value: 0 },
  { id: 60, label: "1 Minute", desc: "Quick notes and signals", value: 60 },
  { id: 3600, label: "1 Hour", desc: "Short term memory", value: 3600 },
  { id: 86400, label: "24 Hours", desc: "Daily cycle", value: 86400 },
];

export default function DisappearingMessagesSelector({ isOpen, onClose, activeValue, onSelect }) {
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Vanish Timer</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Message half-life control</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
            >
              <X size={20} />
            </button>
          </header>

          {/* Info Card */}
          <div className="p-6">
            <div className="p-4 rounded-[24px] bg-white/[0.03] border border-white/5 flex items-start gap-4">
              <AlertCircle size={20} className="text-muted mt-1" />
              <p className="text-[11px] font-medium leading-relaxed text-muted uppercase tracking-wider">
                New messages will disappear from this chat for everyone after the selected time. This setting applies to all participants.
              </p>
            </div>
          </div>

          {/* Options List */}
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {INTERVALS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.value)}
                className={`w-full flex items-center justify-between p-5 rounded-[32px] transition-all active:scale-[0.98] border ${
                  activeValue === opt.value ? "bg-white/5 border-white/10" : "hover:bg-white/[0.02] border-transparent"
                }`}
              >
                <div className="text-left">
                  <p className={`text-[15px] font-bold ${activeValue === opt.value ? "text-white" : "text-white/60"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted">{opt.desc}</p>
                </div>
                {activeValue === opt.value && (
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-black">
                    <Check size={14} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <footer className="p-8">
             <p className="text-[10px] text-center font-bold uppercase tracking-[0.25em] text-muted opacity-40">
                Neurality Privacy Core v4.0 — Signal Decay Active
             </p>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
