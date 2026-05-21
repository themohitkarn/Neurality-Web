import { io } from "socket.io-client";
import { REALTIME_BASE_URL } from "./api";

const QUEUE_KEY = "neurality_offline_queue";

class CommunicationService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = Infinity;
        
        try {
            this.messageQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
        } catch(e) {
            this.messageQueue = [];
        }
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
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5, // Jitter
            timeout: 20000,
            upgrade: true,
            rememberUpgrade: true,
        });

        this.setupDefaultListeners();
        this.reapplyListeners();
    }

    updateToken(newToken) {
        if (this.socket) {
            this.socket.auth.token = newToken;
        }
    }

    setupDefaultListeners() {
        this.socket.on("connect", () => {
            console.log("[CommSDK] Connected to Realtime Engine");
            this.reconnectAttempts = 0;
            this.emit("call:recover");
            this.flushQueue(); // Auto-retry offline messages
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

    // New ACK-based emit with timeout
    emitWithAck(event, data, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error("Socket disconnected"));
                return;
            }
            
            const timer = setTimeout(() => {
                reject(new Error(`Timeout: No ACK received for ${event} after ${timeoutMs}ms`));
            }, timeoutMs);

            this.socket.emit(event, data, (response) => {
                clearTimeout(timer);
                if (response?.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || "Request failed"));
                }
            });
        });
    }

    // Internal flush
    async flushQueue() {
        if (this.messageQueue.length === 0 || !this.socket?.connected) return;
        console.log(`[CommSDK] Flushing ${this.messageQueue.length} queued messages...`);
        
        const queueCopy = [...this.messageQueue];
        this.messageQueue = [];
        localStorage.removeItem(QUEUE_KEY);

        for (const item of queueCopy) {
            try {
                // Retry the emit and wait for ACK
                const res = await this.emitWithAck("message:send", item.data);
                if (item.onSuccess) item.onSuccess(res);
            } catch (err) {
                console.error("[CommSDK] Queue item failed to send:", err);
                if (item.onFail) item.onFail(err);
                // If it fails again, re-queue it if socket disconnected, else fail permanently
                if (!this.socket?.connected) {
                    this.messageQueue.push(item);
                    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.messageQueue.map(m => ({ data: m.data }))));
                }
            }
        }
    }

    // Queue a message for offline sending
    queueMessage(data, onSuccess, onFail) {
        // Prevent duplicates (simple check based on client-side temp ID if provided in data)
        const isDuplicate = this.messageQueue.some(m => m.data.tempId && m.data.tempId === data.tempId);
        if (!isDuplicate) {
            this.messageQueue.push({ data, onSuccess, onFail });
            // Don't serialize functions
            localStorage.setItem(QUEUE_KEY, JSON.stringify(this.messageQueue.map(m => ({ data: m.data }))));
            console.log(`[CommSDK] Message queued. Queue size: ${this.messageQueue.length}`);
        }
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
        this.messageQueue = [];
    }
}

export const commService = new CommunicationService();
export default commService;
