// =====================================================================
// auth.jsx — Konteks autentikasi (menyimpan pengguna & token).
// =====================================================================
import { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, getToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Denyut berkala agar status "online" tetap terbaca selama tab terbuka.
  useEffect(() => {
    if (!user) return;
    api.heartbeat().catch(() => {});
    const t = setInterval(() => {
      api.heartbeat().catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  async function login(username, password) {
    const r = await api.login(username, password);
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  async function updateProfile(data) {
    const r = await api.updateMe(data);
    setUser(r.user);
    return r.user;
  }

  async function updateProfileForm(formData) {
    const r = await api.updateMeForm(formData);
    setUser(r.user);
    return r.user;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, updateProfile, updateProfileForm }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
