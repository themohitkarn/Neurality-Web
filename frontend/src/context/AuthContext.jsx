import { createContext, useContext, useEffect, useState } from "react";

import { TOKEN_STORAGE_KEY, authApi } from "../services/api";


const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data } = await authApi.me();
        if (isMounted) {
          setUser(data.user);
        }
      } catch (_error) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const persistSession = (sessionToken, sessionUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, sessionToken);
    setToken(sessionToken);
    setUser(sessionUser);
  };

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    if (response.status === 202) {
      return { requires_verification: true, identifier: response.data.identifier, message: response.data.message };
    }
    persistSession(response.data.token, response.data.user);
    return response.data.user;
  };

  const verifyLogin = async (payload) => {
    const { data } = await authApi.loginVerify(payload);
    persistSession(data.token, data.user);
    return data.user;
  };

  const signup = async (formData) => {
    const { data } = await authApi.signup(formData);
    persistSession(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    login,
    verifyLogin,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
