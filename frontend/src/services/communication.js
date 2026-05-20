import { io } from "socket.io-client";
import { REALTIME_BASE_URL } from "./api";

class CommunicationService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    connect(token, userId) {
        if (this.socket) {
            if (this.socket.connected && this.userId === userId) {
                console.log("[CommSDK] Socket already connected for user:", userId);
                return;
            }
            if (this.userId === userId) {
                console.log("[CommSDK] Socket exists but disconnected. Calling connect().");
                this.socket.connect();
                return;
            }
            console.log("[CommSDK] User changed or socket obsolete. Recreating...");
            this.disconnect();
        }

        this.userId = userId;
        const realtimeUrl = REALTIME_BASE_URL;

        console.log("[CommSDK] Connecting to Realtime Engine:", realtimeUrl);
        
        this.socket = io(realtimeUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            upgrade: true,
            rememberUpgrade: true,
        });

        this.setupDefaultListeners();
        this.reapplyListeners();
    }

    setupDefaultListeners() {
        this.socket.on("connect", () => {
            console.log("[CommSDK] Connected to Realtime Engine");
            this.reconnectAttempts = 0;
            this.emit("call:recover");
        });

        this.socket.on("disconnect", (reason) => {
            console.warn("[CommSDK] Disconnected:", reason);
        });

        this.socket.on("connect_error", (error) => {
            console.error("[CommSDK] Connection Error:", error);
        });
    }

    reapplyListeners() {
        if (!this.socket) return;
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(callback => {
                this.socket.on(event, callback);
            });
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const callbacks = this.listeners.get(event);
        if (callbacks.includes(callback)) return;

        callbacks.push(callback);
        this.socket?.on(event, callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            this.listeners.set(event, callbacks.filter(l => l !== callback));
        }
        this.socket?.off(event, callback);
    }

    emit(event, data) {
        if (!this.socket?.connected) {
            console.warn(`[CommSDK] Attempted to emit ${event} while disconnected.`);
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

    closeCall(to) {
        this.emit("call:end", { to });
    }

    disconnect() {
        if (this.socket) {
            console.log("[CommSDK] Disconnecting socket cleanly.");
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.userId = null;
        this.listeners.clear();
    }
}

export const commService = new CommunicationService();
export default commService;
