import axios from "axios";


export const TOKEN_STORAGE_KEY = "neurality_token";

const getEnvVariable = (key, localDefault, prodDefault) => {
  const envVal = import.meta.env[key];
  if (envVal) return envVal;
  
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  console.warn(`[EnvCheck] ${key} is missing in environment variables. Dynamically falling back.`);
  return isLocal ? localDefault : prodDefault;
};

const rawApiUrl = getEnvVariable(
  "VITE_API_URL", 
  "http://localhost:5000/api", 
  "https://neurality-web-api.onrender.com/api"
);
export const API_BASE_URL = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

const getBaseUrl = () => {
  try {
    const url = new URL(API_BASE_URL);
    return `${url.protocol}//${url.hostname}`;
  } catch (e) {
    console.error("Invalid VITE_API_URL format:", API_BASE_URL);
    return window.location.origin;
  }
};

export const SOCKET_BASE_URL = getBaseUrl();
export const REALTIME_BASE_URL = getEnvVariable(
  "VITE_REALTIME_URL",
  "http://localhost:5001",
  "https://neurality-realtime.onrender.com"
);
export const REALTIME_API_URL = import.meta.env.VITE_REALTIME_API_URL || `${REALTIME_BASE_URL}/api`;


const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const realtimeApi = axios.create({
  baseURL: REALTIME_API_URL,
  withCredentials: true,
});

const setupRequestInterceptor = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

setupRequestInterceptor(api);
setupRequestInterceptor(realtimeApi);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const setupResponseInterceptor = (instance) => {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      // Check if error is 401 and hasn't been retried yet
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Skip retry if it was a refresh or credentials request to prevent infinite loops
        const url = originalRequest.url || "";
        if (
          url.includes("/auth/refresh") ||
          url.includes("/auth/login") ||
          url.includes("/auth/signup") ||
          url.includes("/auth/check-identity")
        ) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return instance(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Send request to /auth/refresh to rotate cookies and get a new access token
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const { token } = response.data;
          localStorage.setItem(TOKEN_STORAGE_KEY, token);

          // Update common authorization header
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          realtimeApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          processQueue(null, token);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return instance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // If refresh fails, session is completely invalid. Clear tokens.
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
};

setupResponseInterceptor(api);
setupResponseInterceptor(realtimeApi);

export const getErrorMessage = (error) => {
  const msg = error?.response?.data?.message;
  if (!msg) return "Something went wrong. Please try again.";
  
  // Sanitize internal trace leakages
  const lowerMsg = msg.toLowerCase();
  if (
    lowerMsg.includes("sqlalchemy") ||
    lowerMsg.includes("traceback") ||
    lowerMsg.includes("internal server error") ||
    lowerMsg.includes("psycopg2") ||
    lowerMsg.includes("werkzeug")
  ) {
    return "Something went wrong. Please try again later.";
  }
  
  return msg;
};

export const authApi = {
  checkIdentity: (payload) => api.post("/auth/check-identity", payload),
  sendOtp: (payload) => api.post("/auth/send-otp", payload),
  verifyOtp: (payload) => api.post("/auth/verify-otp", payload),
  loginVerify: (payload) => api.post("/auth/login-verify", payload),
  signup: (payload) =>
    api.post("/auth/signup", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
  changePassword: (payload) => api.post("/auth/change-password", payload),
  deleteAccount: (payload) => api.post("/auth/delete-account", payload),
  getSessions: () => api.get("/auth/sessions"),
  logoutOthers: () => api.post("/auth/sessions/logout-others"),
  deleteSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
  linkIdentifier: (payload) => api.post("/auth/link-identifier", payload),
  unlinkIdentifier: (payload) => api.post("/auth/unlink-identifier", payload),
};

export const aiApi = {
  generateCaption: (payload) =>
    api.post("/ai/caption", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  editSuggestions: (payload) =>
    api.post("/ai/edit-suggestions", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  getSmartReplies: (context) => api.post("/ai/suggest-replies", { context }),
  translateText: (text, target_lang) => api.post("/ai/translate", { text, target_lang }),
  summarizeChat: (context) => api.post("/ai/summarize", { context }),
};

export const postApi = {
  create: (payload) =>
    api.post("/posts/create", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  feed: (page = 1, perPage = 6) => api.get(`/posts/feed?page=${page}&per_page=${perPage}`),
  recommended: (limit = 6) => api.get(`/posts/recommended?limit=${limit}`),
  toggleLike: (postId) => api.post(`/posts/like/${postId}`),
  toggleRepost: (postId) => api.post(`/posts/repost/${postId}`),
  delete: (postId) => api.delete(`/posts/${postId}`),
};

export const reelApi = {
  upload: (payload, onProgress) =>
    api.post("/reels/upload", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }),
  feed: (page = 1, perPage = 8) => api.get(`/reels/feed?page=${page}&per_page=${perPage}`),
  getUserReels: (userId, page = 1) => api.get(`/reels/user/${userId}?page=${page}`),
  get: (reelId) => api.get(`/reels/${reelId}`),
  delete: (reelId) => api.delete(`/reels/${reelId}`),
  toggleLike: (reelId) => api.post(`/reels/like/${reelId}`),
  toggleRepost: (reelId) => api.post(`/reels/repost/${reelId}`),
  toggleSave: (reelId) => api.post(`/reels/save/${reelId}`),
};

export const commentApi = {
  add: (payload) => api.post("/comments/add", payload),
  remove: (commentId) => api.delete(`/comments/${commentId}`),
};

export const chatApi = {
  getConversations: () => realtimeApi.get("/conversations"),
  getMessages: (userId) => realtimeApi.get(`/chat/dm/${userId}`),
  getMessageRequests: () => api.get("/chat/requests"),
  createRequest: (payload) => api.post("/chat/request", payload),
  acceptRequest: (payload) => api.post("/chat/accept", payload),
  rejectRequest: (payload) => api.post("/chat/reject", payload),
  
  // Group Chat
  getGroups: () => realtimeApi.get("/conversations"), // Conversations includes groups
  getGroupMessages: (conversationId) => realtimeApi.get(`/messages/${conversationId}`),
  groupDetails: (conversationId) => realtimeApi.get(`/messages/${conversationId}`),
  createGroup: (payload) => realtimeApi.post("/groups/create", payload, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  saveFCMToken: (payload) => api.post("/user/fcm-token", payload),
  upload: (formData) => api.post("/chat/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  getSharedMedia: (conversationId) => realtimeApi.get(`/conversations/${conversationId}/media`),
};

export const shareApi = {
  searchUsers: (query) => api.get(`/search-users?q=${encodeURIComponent(query)}`),
  recentChats: () => api.get("/share/recent-chats"),
  following: () => api.get("/share/following"),
  suggestedUsers: () => api.get("/share/suggested-users"),
  sendShare: (payload) => realtimeApi.post("/chat/share", payload),
};

export const userApi = {
  getMe: () => api.get("/user/me"),
  getProfile: (userId) => api.get(`/user/${userId}`),
  connections: (userId, type = "followers") => api.get(`/user/${userId}/connections?type=${type}`),
  toggleFollow: (userId) => api.post(`/user/follow/${userId}`),
  getFollowRequests: () => api.get("/user/follow-requests"),
  respondFollowRequest: (payload) => api.post("/user/follow-requests/respond", payload),
  search: (query) => api.get(`/user/search?q=${encodeURIComponent(query)}`),
  updateProfile: (payload) =>
    api.put("/user/me", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  getSettings: () => api.get("/user/settings"),
  updateSettings: (payload) => api.put("/user/settings", payload),
};

export const followApi = {
  follow: (userId) => api.post(`/follow/${userId}`),
  unfollow: (userId) => api.post(`/unfollow/${userId}`),
  request: (payload) => api.post("/follow/request", payload),
  requests: () => api.get("/follow/requests"),
  accept: (payload) => api.post("/follow/accept", payload),
  reject: (payload) => api.post("/follow/reject", payload),
};

export const storyApi = {
  create: (payload) =>
    api.post("/stories/create", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  feed: () => api.get("/stories/feed"),
  markSeen: (storyId) => api.post(`/stories/${storyId}/seen`),
  react: (storyId, emoji) => api.post(`/stories/${storyId}/react`, { emoji }),
};

export const notificationApi = {
  list: (page = 1) => api.get(`/notifications?page=${page}`),
  markRead: (ids = null) => api.post("/notifications/read", ids ? { ids } : {}),
  unreadCount: () => api.get("/notifications/unread-count"),
};

export const socialApi = {
  toggleSave: (postId) => api.post(`/social/posts/${postId}/save`),
  getSaved: (page = 1) => api.get(`/social/saved?page=${page}`),
  togglePin: (postId) => api.post(`/social/posts/${postId}/pin`),
  toggleBlock: (userId) => api.post(`/social/users/${userId}/block`),
  listBlocked: () => api.get("/social/blocked"),
  report: (payload) => api.post("/social/report", payload),
  hideContent: (payload) => api.post("/social/hide", payload),
};

export const highlightApi = {
  create: (payload) =>
    api.post("/highlights/create", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  addStories: (highlightId, storyIds) =>
    api.post(`/highlights/${highlightId}/add`, { story_ids: storyIds }),
  getUserHighlights: (userId) => api.get(`/highlights/user/${userId}`),
  getStories: (highlightId) => api.get(`/highlights/${highlightId}/stories`),
  delete: (highlightId) => api.delete(`/highlights/${highlightId}`),
  toggleCloseFriend: (userId) => api.post(`/highlights/close-friends/${userId}`),
  listCloseFriends: () => api.get("/highlights/close-friends"),
};

// ── Admin API ──
export const adminApi = {
  dashboard: () => api.get("/admin/dashboard"),
  listUsers: (page = 1, q = "") => api.get(`/admin/users?page=${page}&q=${encodeURIComponent(q)}`),
  toggleVerify: (userId) => api.post(`/admin/users/${userId}/verify`),
  banUser: (userId) => api.post(`/admin/users/${userId}/ban`),
  toggleAdmin: (userId) => api.post(`/admin/users/${userId}/make-admin`),
  listReports: (page = 1, status = "") =>
    api.get(`/admin/reports?page=${page}${status ? `&status=${status}` : ""}`),
  resolveReport: (reportId, action) =>
    api.post(`/admin/reports/${reportId}/resolve`, { action }),
  deletePost: (postId) => api.delete(`/admin/posts/${postId}`),
  deleteReel: (reelId) => api.delete(`/admin/reels/${reelId}`),
};

export default api;
