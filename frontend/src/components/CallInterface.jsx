import { useState, useEffect, useRef } from "react";
import { 
  Phone, Video, X, Mic, MicOff, VideoOff, 
  PhoneOff, Volume2, User, Users, Maximize2, 
  Minimize2, ScreenShare, Share2, MoreVertical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import { useCall } from "../context/CallContext";

export default function CallInterface() {
  const { 
    activeCall, 
    isCallInterfaceOpen, 
    setIsCallInterfaceOpen,
    isMinimized,
    setIsMinimized,
    callStatus,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    isMuted,
    isVideoOff,
    isScreenSharing,
    STATES
  } = useCall();

  const [timer, setTimer] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Timer logic
  useEffect(() => {
    let interval;
    if (callStatus === STATES.ACTIVE) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [callStatus, STATES.ACTIVE]);

  // Stream attachments
  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  // Audio analysis for active speaker detection
  useEffect(() => {
    if (!remoteStream || callStatus !== STATES.ACTIVE) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(remoteStream);
    source.connect(analyser);
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame;
    const check = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setIsSpeaking(avg > 18);
      frame = requestAnimationFrame(check);
    };
    check();
    return () => {
      cancelAnimationFrame(frame);
      audioCtx.close();
    };
  }, [remoteStream, callStatus, STATES.ACTIVE]);

  const toggleSpeaker = async () => {
    const element = remoteVideoRef.current || remoteAudioRef.current;
    if (!element) return;
    try {
      if (element.setSinkId) {
        await element.setSinkId(speakerEnabled ? "default" : "communications");
      } else {
        element.muted = !speakerEnabled;
      }
      setSpeakerEnabled(!speakerEnabled);
    } catch (err) {
      console.log("Speaker error", err);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!isCallInterfaceOpen || !activeCall) return null;

  // Render Minimized / PiP mode
  if (isMinimized) {
    return (
      <motion.div 
        drag
        dragConstraints={{ left: 0, right: window.innerWidth - 120, top: 0, bottom: window.innerHeight - 160 }}
        className="fixed bottom-20 right-6 w-32 aspect-[3/4] z-[400] bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden cursor-move backdrop-blur-xl"
        onClick={() => setIsMinimized(false)}
      >
        {callStatus === STATES.ACTIVE && activeCall.type === "video" ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Avatar src={activeCall.from_user?.profile_pic} size="md" />
            <span className="text-[10px] font-bold text-white/50">{formatTime(timer)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
        <button className="absolute top-2 right-2 p-1 bg-black/50 rounded-full" onClick={(e) => { e.stopPropagation(); endCall(); }}>
          <X size={12} className="text-white" />
        </button>
      </motion.div>
    );
  }

  const isVideo = activeCall.type === "video";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-zinc-950 flex flex-col items-center justify-center text-white font-sans overflow-hidden"
    >
      {/* Background Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black z-0" />
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-zinc-800 blur-[100px] rounded-full" />
      </div>

      {/* Main Video Layer */}
      {callStatus === STATES.ACTIVE && isVideo && (
        <div className="absolute inset-0 z-10">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          
          {/* PiP Local Video */}
          {localStream && !isVideoOff && (
            <motion.div 
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              className="absolute top-12 right-6 w-32 aspect-[3/4] bg-zinc-900/80 rounded-2xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md z-30"
            >
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            </motion.div>
          )}
        </div>
      )}

      {/* Interface Layer */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full w-full max-w-lg py-16 px-8">
        
        {/* Header: User Info */}
        <div className={`flex flex-col items-center transition-all duration-700 ${callStatus === STATES.ACTIVE && isVideo ? 'opacity-0 -translate-y-10' : 'opacity-100'}`}>
          <div className="relative mb-10">
            <AnimatePresence>
              {(callStatus === STATES.INCOMING || callStatus === STATES.RINGING) && (
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute inset-0 rounded-full bg-white blur-2xl"
                />
              )}
            </AnimatePresence>
            
            <div className={`rounded-full transition-all duration-500 ${isSpeaking ? 'ring-4 ring-white shadow-[0_0_50px_rgba(255,255,255,0.4)]' : 'ring-2 ring-white/10'}`}>
              <Avatar 
                src={activeCall.from_user?.profile_pic} 
                name={activeCall.from_user?.username} 
                size="xl" 
                className="w-40 h-40 relative z-10"
              />
            </div>
          </div>
          
          <h2 className="text-4xl font-semibold tracking-tight mb-4 drop-shadow-xl">
            {activeCall?.group_id ? "Group Channel" : activeCall?.from_user?.username || "Unknown"}
          </h2>
          
          <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
            <span className="text-white/60 font-bold tracking-[0.2em] text-[10px] uppercase">
              {callStatus === STATES.ACTIVE ? formatTime(timer) : callStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Floating Controls */}
        <div className="w-full flex flex-col items-center gap-12">
          
          {callStatus === STATES.INCOMING ? (
            <div className="flex items-center justify-between w-full px-10">
              <div className="flex flex-col items-center gap-4">
                <button onClick={rejectCall} className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all active:scale-95 group">
                  <PhoneOff size={32} className="group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-4">
                <button onClick={acceptCall} className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 animate-pulse group">
                  {isVideo ? <Video size={32} /> : <Phone size={32} />}
                </button>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Accept</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10 w-full">
              {/* Secondary Actions */}
              <div className="flex items-center gap-6 px-8 py-5 bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10">
                <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                {isVideo && (
                  <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isVideoOff ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
                    {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}
                <button onClick={toggleSpeaker} className={`p-4 rounded-full transition-all ${!speakerEnabled ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
                  <Volume2 size={22} />
                </button>
                <button onClick={toggleScreenShare} className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
                  <ScreenShare size={22} />
                </button>
                <button onClick={() => setIsMinimized(true)} className="p-4 rounded-full hover:bg-white/10">
                  <Minimize2 size={22} />
                </button>
              </div>

              {/* End Call */}
              <button onClick={endCall} className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-2xl border-4 border-white/10 hover:bg-red-600 transition-all active:scale-90 group">
                <PhoneOff size={32} className="group-hover:rotate-[135deg] transition-transform duration-500" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden Audio Element for Voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </motion.div>
  );
}
