import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import commService from "../services/communication";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      commService.disconnect();
      setIsConnected(false);
      return;
    }

    console.log("[Socket] Initializing production Communication SDK...");
    commService.connect(token, user.id);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    commService.on("connect", onConnect);
    commService.on("disconnect", onDisconnect);

    // Latency monitoring
    const interval = setInterval(() => {
      const start = Date.now();
      commService.emit("ping", () => setLatency(Date.now() - start));
    }, 15000);

    return () => {
      clearInterval(interval);
      commService.off("connect", onConnect);
      commService.off("disconnect", onDisconnect);
      commService.disconnect();
    };
  }, [token, user]);

  const value = {
    commService,
    socket: commService.socket,
    isConnected,
    latency,
    registerListener: (e, c) => commService.on(e, c),
    unregisterListener: (e, c) => commService.off(e, c)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
}
