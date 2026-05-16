import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import { Mic, MicOff, VideoOff, Volume2 } from "lucide-react";

/**
 * DYNAMIC PARTICIPANT GRID
 * Features:
 * - Smart Grid Layout (scaling from 1 to N participants)
 * - Active Speaker Prioritization
 * - Speaking indicator animations
 * - Participant state overlays
 */
export default function ParticipantGrid({ 
  participants, // [{ id, username, profile_pic, stream, isSpeaking, isMuted, isVideoOff }]
  localParticipant // { id, username, profile_pic, stream, isSpeaking, isMuted, isVideoOff }
}) {
  const allParticipants = [localParticipant, ...participants];
  const count = allParticipants.length;

  const getGridClass = () => {
    if (count === 1) return "grid-cols-1 grid-rows-1";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    return "grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2";
  };

  return (
    <div className={`grid ${getGridClass()} gap-4 w-full h-full p-4 transition-all duration-700`}>
      <AnimatePresence mode="popLayout">
        {allParticipants.map((p, idx) => (
          <ParticipantCard 
            key={p.id || "local"} 
            participant={p} 
            isLocal={idx === 0}
            priority={p.isSpeaking}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ParticipantCard({ participant, isLocal, priority }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        zIndex: priority ? 10 : 0
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`relative rounded-3xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 ${
        priority ? 'border-white ring-4 ring-white/10' : 'border-white/5'
      } shadow-2xl group`}
    >
      {/* Video Element */}
      {participant.stream && !participant.isVideoOff ? (
        <video
          autoPlay
          playsInline
          muted={isLocal}
          ref={(el) => {
            if (el && participant.stream) el.srcObject = participant.stream;
          }}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-zinc-900">
          <Avatar src={participant.profile_pic} size="xl" className="w-24 h-24" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold">{participant.username}</span>
            {isLocal && <span className="text-[10px] text-white/40 uppercase tracking-widest">You</span>}
          </div>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
          {participant.isSpeaking && (
            <motion.div 
              animate={{ height: [4, 12, 6, 14, 8] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="flex items-end gap-0.5"
            >
              {[1, 2, 3].map(i => <div key={i} className="w-0.5 bg-emerald-400 rounded-full" />)}
            </motion.div>
          )}
          <span className="text-[10px] font-bold text-white/80">{participant.username}</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2">
        {participant.isMuted && (
          <div className="p-2 bg-red-500/80 backdrop-blur-md rounded-full">
            <MicOff size={14} />
          </div>
        )}
        {participant.isVideoOff && (
          <div className="p-2 bg-zinc-800/80 backdrop-blur-md rounded-full">
            <VideoOff size={14} />
          </div>
        )}
      </div>

      {/* Speaking Glow */}
      {priority && (
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 bg-emerald-500/10 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
