/**
 * RTC STATS COLLECTOR
 * 
 * Periodically collects and logs WebRTC performance metrics:
 * - Round Trip Time (RTT)
 * - Packet Loss
 * - Bitrate (Sent/Received)
 * - Jitter
 * - Frame Rate
 */

export default class RTCStatsCollector {
  constructor(pc, onStats) {
    this.pc = pc;
    this.onStats = onStats;
    this.interval = null;
  }

  start(ms = 2000) {
    this.interval = setInterval(async () => {
      if (!this.pc) return;
      
      try {
        const stats = await this.pc.getStats();
        const report = {
          timestamp: Date.now(),
          rtt: 0,
          packetLoss: 0,
          bitrate: 0,
          jitter: 0,
          fps: 0,
        };

        stats.forEach((res) => {
          if (res.type === "remote-inbound-rtp") {
            report.rtt = res.roundTripTime || 0;
          }
          if (res.type === "inbound-rtp") {
            report.packetLoss = res.packetsLost || 0;
            report.jitter = res.jitter || 0;
            report.fps = res.framesPerSecond || 0;
          }
          if (res.type === "transport") {
            report.bitrate = res.bytesReceived || 0;
          }
        });

        this.onStats(report);
      } catch (e) {
        console.error("[StatsCollector] Error", e);
      }
    }, ms);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
