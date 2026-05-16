import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import NotificationManager from "../utils/NotificationManager";

export default function NotificationHandler() {
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    NotificationManager.requestPermission();
  }, []);

  useEffect(() => {
    if (!socket || !user) return;

    const onReceiveMessage = (message) => {
      // Show notification if:
      // 1. Message is not from self
      // 2. We are not on the chat page OR we are on the chat page but this conversation is NOT selected
      const isNotFromMe = String(message.sender_id) !== String(user.id);
      const isNotActiveChat = !window.location.pathname.includes("/chat") || 
                             (window.selectedContactId && String(window.selectedContactId) !== String(message.sender_id));

      if (isNotFromMe && isNotActiveChat) {
        NotificationManager.show(message.sender.username, {
          body: message.content,
          icon: message.sender.profile_pic,
          url: "/chat"
        });
      }
    };

    socket.on("receive_message", onReceiveMessage);

    return () => {
      socket.off("receive_message", onReceiveMessage);
    };
  }, [socket, user]);

  return null;
}
