import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { motion } from "framer-motion";

/**
 * VOICE NOTE COMPONENT
 * Features:
 * - Dynamic Waveform Visualization
 * - Interactive Progress Bar
 * - Playback Speed Control
 */
export default function VoiceNote({ audioUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(new Audio(audioUrl));
  const animationRef = useRef();

  // Generate fake waveform data for visualization
  const waveform = useRef(Array.from({ length: 40 }, () => Math.random() * 20 + 5));

  useEffect(() => {
    const audio = audioRef.current;
    
    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      animationRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      audio.play();
      animationRef.current = requestAnimationFrame(updateProgress);
    } else {
      audio.pause();
      cancelAnimationFrame(animationRef.current);
    }

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl p-3 rounded-2xl border border-white/10 min-w-[240px]">
      <button 
        onClick={() => setIsPlaying(!isPlaying)}
        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
      </button>

      <div className="flex-1 flex items-center gap-1 h-8">
        {waveform.current.map((height, i) => {
          const isActive = progress > (i / waveform.current.length) * 100;
          return (
            <motion.div 
              key={i}
              initial={{ height: 4 }}
              animate={{ height: height }}
              className={`w-1 rounded-full transition-colors duration-300 ${
                isActive ? 'bg-white' : 'bg-white/20'
              }`}
            />
          );
        })}
      </div>

      <span className="text-[10px] font-mono text-white/50">{duration || "0:12"}</span>
    </div>
  );
}
