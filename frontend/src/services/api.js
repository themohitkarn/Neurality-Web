import axios from "axios";


export const TOKEN_STORAGE_KEY = "neurality_token";
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getErrorMessage = (error) =>
  error?.response?.data?.message || "Something went wrong. Please try again.";

export const authApi = {
  signup: (payload) =>
    api.post("/auth/signup", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
};

export const aiApi = {
  generateCaption: (payload) =>
    api.post("/ai/caption", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
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
};

export const reelApi = {
  upload: (payload) =>
    api.post("/reels/upload", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  feed: (page = 1, perPage = 8) => api.get(`/reels/feed?page=${page}&per_page=${perPage}`),
  toggleLike: (reelId) => api.post(`/reels/like/${reelId}`),
};

export const commentApi = {
  add: (payload) => api.post("/comments/add", payload),
  remove: (commentId) => api.delete(`/comments/${commentId}`),
};

export const chatApi = {
  users: () => api.get("/chat/users"),
  messages: (userId) => api.get(`/chat/messages/${userId}`),
  requests: () => api.get("/chat/requests"),
  createRequest: (payload) => api.post("/chat/request", payload),
  acceptRequest: (payload) => api.post("/chat/accept", payload),
  rejectRequest: (payload) => api.post("/chat/reject", payload),
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
};

export default api;
