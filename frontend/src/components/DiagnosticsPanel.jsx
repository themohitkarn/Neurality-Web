import { useState, useEffect } from "react";
import { Activity, Zap, Shield, BarChart2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * REALTIME DIAGNOSTICS PANEL
 * Features:
 * - RTC Stats visualization
 * - Socket connection health
 * - Encryption status
 * - Media performance logs
 */
export default function DiagnosticsPanel({ stats, isConnected, isEncrypted }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-[500]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all shadow-2xl"
      >
        <Activity size={20} className={isConnected ? "text-emerald-500" : "text-red-500"} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 left-0 w-80 bg-zinc-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
          >
            <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                <BarChart2 size={16} />
                Realtime Metrics
              </h3>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isConnected ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <Metric label="Latency (RTT)" value={`${Math.round(stats?.rtt * 1000 || 0)}ms`} color="text-emerald-400" />
              <Metric label="Packet Loss" value={`${stats?.packetLoss || 0}%`} color="text-orange-400" />
              <Metric label="Jitter" value={`${Math.round(stats?.jitter * 1000 || 0)}ms`} color="text-blue-400" />
              <Metric label="Bitrate" value={`${(stats?.bitrate / 1024 / 1024).toFixed(2)} Mbps`} color="text-purple-400" />
              
              <div className="pt-4 border-t border-white/5 space-y-3">
                <StatusItem icon={<Shield size={14} />} label="E2EE Signaling" status={isEncrypted ? "SECURE" : "PLANTEXT"} active={isEncrypted} />
                <StatusItem icon={<Globe size={14} />} label="Regional CDN" status="EU-FRANKFURT-1" active={true} />
                <StatusItem icon={<Zap size={14} />} label="Socket Layer" status={isConnected ? "DISTRIBUTED" : "RECONNECTING"} active={isConnected} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function StatusItem({ icon, label, status, active }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-white/50">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-[10px] font-black ${active ? 'text-emerald-500' : 'text-zinc-600'}`}>{status}</span>
    </div>
  );
}
