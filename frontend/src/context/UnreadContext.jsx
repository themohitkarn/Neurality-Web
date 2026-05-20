import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { chatApi } from "../services/api";

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const { socket } = useSocket();
  const { token } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [chatUnreads, setChatUnreads] = useState({}); // chat_id -> count

  const fetchInitialUnread = useCallback(async () => {
    if (!token) {
      setTotalUnread(0);
      setChatUnreads({});
      return;
    }
    try {
      const { data } = await chatApi.getConversations();
      const users = data.users || [];
      const sum = users.reduce((acc, u) => acc + (u.unread_count || 0), 0);
      setTotalUnread(sum);
      
      const unreads = {};
      users.forEach(u => {
        if (u.unread_count > 0) {
          unreads[`user_${u.id}`] = u.unread_count;
        }
      });
      setChatUnreads(unreads);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("[Unread] Initial fetch failed", err);
      }
    }
  }, [token]);

  useEffect(() => {
    fetchInitialUnread();
  }, [fetchInitialUnread]);

  useEffect(() => {
    if (!socket) return;

    const onUnreadUpdate = (data) => {
      console.log("[Unread] Received update:", data);
      if (data.total_unread !== undefined) {
        setTotalUnread(data.total_unread);
      }
      
      if (data.sender_id || data.group_id) {
        const id = data.group_id ? `group_${data.group_id}` : `user_${data.sender_id}`;
        setChatUnreads(prev => ({
          ...prev,
          [id]: (prev[id] || 0) + 1
        }));
      }
    };

    const onMessagesRead = (data) => {
      // Recalculate everything to stay in sync
      fetchInitialUnread();
    };

    socket.on("unread_update", onUnreadUpdate);
    socket.on("messages_read", onMessagesRead);

    return () => {
      socket.off("unread_update", onUnreadUpdate);
      socket.off("messages_read", onMessagesRead);
    };
  }, [socket, fetchInitialUnread]);

  const value = {
    totalUnread,
    setTotalUnread,
    chatUnreads,
    setChatUnreads
  };

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) throw new Error("useUnread must be used within UnreadProvider");
  return context;
}
