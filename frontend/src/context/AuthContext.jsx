import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("tn_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("tn_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email, password) {
    const data = await api.login({ email, password });
    localStorage.setItem("tn_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(payload) {
    const data = await api.register(payload);
    localStorage.setItem("tn_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("tn_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
