import { io } from "socket.io-client";

class CommunicationService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(token, userId) {
        if (this.socket?.connected) return;

        this.userId = userId;
        const realtimeUrl = import.meta.env.VITE_REALTIME_URL || "http://localhost:5001";
        this.socket = io(realtimeUrl, {
            auth: { token },
            reconnection: true,

            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
        });

        this.setupDefaultListeners();
    }

    setupDefaultListeners() {
        this.socket.on("connect", () => {
            console.log("[CommSDK] Connected to Realtime Engine");
            this.reconnectAttempts = 0;
            // Recover state
            this.emit("call:recover");
        });

        this.socket.on("disconnect", (reason) => {
            console.warn("[CommSDK] Disconnected:", reason);
        });

        this.socket.on("connect_error", (error) => {
            console.error("[CommSDK] Connection Error:", error);
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        this.socket?.on(event, callback);
    }

    off(event, callback) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.listeners.set(event, eventListeners.filter(l => l !== callback));
        }
        this.socket?.off(event, callback);
    }

    emit(event, data) {
        if (!this.socket?.connected) {
            console.warn(`[CommSDK] Attempted to emit ${event} while disconnected. Data:`, data);
            return;
        }
        this.socket.emit(event, data);
    }

    // --- High Level Messaging API ---

    sendMessage(conversationId, content, options = {}) {
        this.emit("message:send", {
            conversationId,
            content,
            type: options.type || "text",
            replyToId: options.replyToId,
            isVanish: options.isVanish,
            expiresIn: options.expiresIn
        });
    }

    sendTyping(conversationId, isTyping) {
        this.emit("message:typing", { conversationId, isTyping });
    }

    markAsSeen(conversationId, messageIds) {
        this.emit("message:seen", { conversationId, messageIds });
    }

    toggleReaction(messageId, emoji) {
        this.emit("reaction:toggle", { messageId, emoji });
    }

    // --- Calling API ---

    initiateCall(receiverId, type, signal) {
        this.emit("call:initiate", { receiverId, type, signal });
    }

    acceptCall(callerId, signal) {
        this.emit("call:accept", { callerId, signal });
    }

    rejectCall(callerId) {
        this.emit("call:reject", { callerId });
    }

    sendSignal(to, signal) {
        this.emit("call:signal", { to, signal });
    }

    endCall(to) {
        this.emit("call:end", { to });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const commService = new CommunicationService();
export default commService;
