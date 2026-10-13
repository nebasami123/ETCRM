import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authClient } from "../lib/auth-client";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: { id: string; name: string; email: string; role?: string; salesType?: "INTERNAL" | "EXTERNAL" | null }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" : user.role === "SALES_ADMIN" ? "SALES_ADMIN" : "SALES",
    salesType: user.salesType ?? null
  } as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession()
      .then((result: { data?: { user?: { id: string; name: string; email: string; role?: string; salesType?: "INTERNAL" | "EXTERNAL" | null } } | null }) =>
        setUser(result.data?.user ? toAuthUser(result.data.user) : null)
      )
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error || !result.data?.user) {
      throw new Error(result.error?.message || "Unable to sign in");
    }
    const signedIn = toAuthUser(result.data.user);
    setUser(signedIn);
    return signedIn;
  }

  async function logout() {
    await authClient.signOut();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: Boolean(user),
      loading
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
