import { useState, useRef, useEffect, useCallback } from "react";

const STATES = {
  IDLE: "idle",
  OUTGOING: "outgoing",
  INCOMING: "incoming",
  RINGING: "ringing",
  CONNECTING: "connecting",
  ACTIVE: "active",
  RECONNECTING: "reconnecting",
  ENDED: "ended",
  FAILED: "failed"
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * PRODUCTION-GRADE WEBRTC HOOK (STABILIZED)
 */
export default function useWebRTC(socket, user, activeCall, onCallEnded) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState(STATES.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceQueue = useRef([]);
  const remoteDescSet = useRef(false);
  const startTime = useRef(null);
  const pendingCandidates = useRef([]);

  const cleanup = useCallback(() => {
    console.log("[WebRTC] Complete Cleanup");
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus(STATES.IDLE);
    remoteDescSet.current = false;
    iceQueue.current = [];
  }, []);

  const createPC = useCallback((targetId) => {
    if (pcRef.current) cleanup();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit("call:signal", { to: targetId, signal: { type: "candidate", candidate } });
      }
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] Received Stream");
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] PC State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus(STATES.ACTIVE);
        startTime.current = Date.now();
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setCallStatus(STATES.FAILED);
        onCallEnded();
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  }, [socket, cleanup, onCallEnded]);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (!pcRef.current) return;
    if (!remoteDescSet.current) {
      iceQueue.current.push(candidate);
    } else {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[WebRTC] ICE candidate error ignored", e);
      }
    }
  }, []);

  const processIceQueue = useCallback(async () => {
    if (!pcRef.current || !remoteDescSet.current) return;
    while (iceQueue.current.length > 0) {
      const candidate = iceQueue.current.shift();
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[WebRTC] Queue candidate error ignored", e);
      }
    }
  }, []);

  const startCall = useCallback(async (targetId, type) => {
    setCallStatus(STATES.OUTGOING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video"
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(targetId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:initiate", { receiverId: targetId, type, signal: offer });
      setCallStatus(STATES.RINGING);
    } catch (e) {
      console.error("[WebRTC] Initiation failed", e);
      onCallEnded();
    }
  }, [socket, createPC, onCallEnded]);

  const acceptCall = useCallback(async (targetId, offer, type) => {
    setCallStatus(STATES.CONNECTING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(targetId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSet.current = true;
      await processIceQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", { callerId: targetId, signal: answer });
    } catch (e) {
      console.error("[WebRTC] Acceptance failed", e);
      onCallEnded();
    }
  }, [socket, createPC, processIceQueue, onCallEnded]);

  const handleAnswer = useCallback(async (answer) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescSet.current = true;
      await processIceQueue();
    } catch (e) {
      console.error("[WebRTC] HandleAnswer failed", e);
    }
  }, [processIceQueue]);

  const endCall = useCallback(() => {
    if (activeCall && socket) {
      socket.emit("call:end", { 
        to: activeCall.target_id || activeCall.from_user?.id || activeCall.from
      });
    }
    cleanup();
    onCallEnded();
  }, [activeCall, socket, cleanup, onCallEnded]);

  return {
    localStream,
    remoteStream,
    callStatus,
    setCallStatus,
    isMuted,
    isVideoOff,
    startCall,
    acceptCall,
    handleAnswer,
    handleIceCandidate,
    endCall,
    STATES
  };
}
