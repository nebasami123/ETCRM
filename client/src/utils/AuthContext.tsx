import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../features/auth/api/authApi";
import type { AuthUser } from "../types";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("etcrm_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("etcrm_user");
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });

  async function login(email: string, password: string) {
    const data = await authApi.login(email, password);
    localStorage.setItem("etcrm_token", data.token);
    localStorage.setItem("etcrm_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("etcrm_token");
    localStorage.removeItem("etcrm_user");
    setToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({ token, user, login, logout, isAuthenticated: Boolean(token && user) }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
