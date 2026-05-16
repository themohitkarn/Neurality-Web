/**
 * PEER MANAGER — Scalable RTC Infrastructure
 * 
 * Designed to handle Mesh networking (current) with easy migration
 * to SFU (Mediasoup/LiveKit) in the future.
 */

export default class PeerManager {
  constructor(socket, config = {}) {
    this.socket = socket;
    this.config = config;
    this.peers = new Map(); // target_id -> RTCPeerConnection
    this.streams = new Map(); // target_id -> MediaStream
    this.onTrack = config.onTrack || (() => {});
    this.onConnectionState = config.onConnectionState || (() => {});
    this.onIceCandidate = config.onIceCandidate || (() => {});
  }

  async createPeer(targetId, localStream, initiator = false) {
    if (this.peers.has(targetId)) return this.peers.get(targetId);

    const pc = new RTCPeerConnection(this.config.iceServers || {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    this.peers.set(targetId, pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.onIceCandidate(targetId, candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[PeerManager] Track received from ${targetId}`);
      if (event.streams && event.streams[0]) {
        this.streams.set(targetId, event.streams[0]);
        this.onTrack(targetId, event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      this.onConnectionState(targetId, pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(targetId);
      }
    };

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    return pc;
  }

  async setRemoteDescription(targetId, description) {
    const pc = this.peers.get(targetId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(description));
  }

  async addIceCandidate(targetId, candidate) {
    const pc = this.peers.get(targetId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("[PeerManager] ICE Candidate error", e);
    }
  }

  removePeer(targetId) {
    const pc = this.peers.get(targetId);
    if (pc) {
      pc.close();
      this.peers.delete(targetId);
    }
    this.streams.delete(targetId);
  }

  cleanup() {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.streams.clear();
  }

  getStream(targetId) {
    return this.streams.get(targetId);
  }
}
