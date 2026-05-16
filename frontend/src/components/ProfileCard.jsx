import { motion } from "framer-motion";
import Avatar from "./Avatar";
import { BadgeCheck, Music, MapPin, Link as LinkIcon, MessageCircle, UserPlus } from "lucide-react";

/**
 * PREMIUM PROFILE CARD
 * Features:
 * - Animated Hover Effects
 * - Profile Music Indicator
 * - Live Status Integration
 * - Verified Badge Styles
 * - Interaction Stats
 */
export default function ProfileCard({ user }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full max-w-sm bg-zinc-900 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl group"
    >
      {/* Profile Header Background */}
      <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 transition-opacity duration-700" />

      {/* Main Content */}
      <div className="px-8 pb-8 -mt-16 relative z-10 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-white blur-2xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity" />
          <Avatar 
            src={user.profile_pic} 
            size="xl" 
            className="w-32 h-32 ring-4 ring-zinc-950 relative z-10" 
          />
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-zinc-950 rounded-full z-20" />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-2xl font-bold">{user.username}</h3>
          {user.is_verified && <BadgeCheck className="text-blue-400 fill-blue-400/20" size={20} />}
        </div>

        <p className="text-zinc-400 text-sm mb-6 text-center line-clamp-2 px-4">
          {user.bio || "Digital architect & creator. Building the future of social communication."}
        </p>

        {/* Profile Music (Animated) */}
        <div className="w-full bg-white/5 rounded-2xl p-3 flex items-center gap-3 mb-8 border border-white/5">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Music size={18} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Now Playing</p>
            <p className="text-xs font-medium truncate">Midnight City — M83</p>
          </div>
          <div className="flex gap-0.5 items-end h-3">
            {[1, 2, 3, 4].map(i => (
              <motion.div 
                key={i}
                animate={{ height: [4, 12, 6, 10, 4] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                className="w-0.5 bg-indigo-400/60 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between w-full mb-8 px-4">
          <Stat label="Drops" value={user.posts_count} />
          <Stat label="Stalkers" value={user.followers_count} />
          <Stat label="Stalking" value={user.following_count} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button className="flex-1 bg-white text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
            <UserPlus size={18} />
            Follow
          </button>
          <button className="w-14 bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl flex items-center justify-center border border-white/5 transition-all">
            <MessageCircle size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold">{value || 0}</span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">{label}</span>
    </div>
  );
}
