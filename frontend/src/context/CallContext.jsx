import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import useWebRTC from "../hooks/useWebRTC";
import NotificationManager from "../utils/NotificationManager";
import commService from "../services/communication";

const CallContext = createContext(null);

const SOUNDS = {
  RINGING: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
  DIALING: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
};

export function CallProvider({ children }) {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState(null);
  const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const timeoutRef = useRef(null);
  const audioRef = useRef(new Audio());

  const onCallEnded = useCallback(() => {
    console.log("[CallContext] Final Call Teardown");
    setIsCallInterfaceOpen(false);
    setIsMinimized(false);
    setActiveCall(null);
    stopSounds();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const webrtc = useWebRTC(socket, user, activeCall, onCallEnded);

  const playSound = (url, loop = true) => {
    audioRef.current.src = url;
    audioRef.current.loop = loop;
    audioRef.current.play().catch(e => console.warn("Audio blocked", e));
  };

  const stopSounds = () => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  useEffect(() => {
    if (!isConnected) return;

    const onIncomingCall = (data) => {
      if (activeCall) {
        commService.rejectCall(data.from);
        return;
      }
      setActiveCall({ ...data, isIncoming: true, from_user: { id: data.from, username: data.fromUsername }, offer: data.signal });
      setIsCallInterfaceOpen(true);
      webrtc.setCallStatus(webrtc.STATES.INCOMING);
      playSound(SOUNDS.RINGING);
      
      timeoutRef.current = setTimeout(() => {
        commService.rejectCall(data.from);
        onCallEnded();
      }, 45000);
    };

    const onCallAccepted = (data) => {
      stopSounds();
      webrtc.handleAnswer(data.signal);
    };

    const onCallRejected = () => onCallEnded();

    const onCallSignal = (data) => {
      if (data.signal?.type === "candidate") {
        webrtc.handleIceCandidate(data.signal.candidate);
      }
    };

    const onCallRecovered = (session) => {
      const targetId = session.callerId === user.id ? session.receiverId : session.callerId;
      setActiveCall({ from_user: { id: targetId }, type: session.type, isIncoming: session.receiverId === user.id });
      setIsCallInterfaceOpen(true);
      webrtc.setCallStatus(webrtc.STATES.ACTIVE);
    };

    commService.on("call:incoming", onIncomingCall);
    commService.on("call:accepted", onCallAccepted);
    commService.on("call:rejected", onCallRejected);
    commService.on("call:signal", onCallSignal);
    commService.on("call:ended", onCallEnded);
    commService.on("call:recovered", onCallRecovered);

    return () => {
      commService.off("call:incoming", onIncomingCall);
      commService.off("call:accepted", onCallAccepted);
      commService.off("call:rejected", onCallRejected);
      commService.off("call:signal", onCallSignal);
      commService.off("call:ended", onCallEnded);
      commService.off("call:recovered", onCallRecovered);
    };
  }, [isConnected, activeCall, webrtc, onCallEnded, user]);

  const initiateCall = useCallback((target, type) => {
    if (!isConnected) return;
    const targetId = target.id;
    setActiveCall({ from_user: target, type, isIncoming: false });
    setIsCallInterfaceOpen(true);
    webrtc.startCall(targetId, type);
    playSound(SOUNDS.DIALING);
  }, [isConnected, webrtc]);

  const acceptCall = useCallback(() => {
    if (activeCall) {
      stopSounds();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      webrtc.acceptCall(activeCall.from_user.id, activeCall.offer, activeCall.type);
    }
  }, [activeCall, webrtc]);

  const rejectCall = useCallback(() => {
    if (activeCall) {
      commService.rejectCall(activeCall.from_user.id);
    }
    onCallEnded();
  }, [activeCall, onCallEnded]);

  const value = {
    ...webrtc,
    activeCall,
    isCallInterfaceOpen,
    setIsCallInterfaceOpen,
    isMinimized,
    setIsMinimized,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall: webrtc.endCall
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within a CallProvider");
  return context;
}
