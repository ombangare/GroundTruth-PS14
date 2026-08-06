"use client";

/**
 * DEMO-LEVEL AUTH — NOT PRODUCTION SECURE.
 *
 * This is a client-side password check so the citizen/admin split can be
 * demonstrated in the UI. It is NOT real authentication:
 *   - The password check runs in the browser, so a determined user could
 *     bypass it via devtools.
 *   - NEXT_PUBLIC_ env vars are bundled into client JS and are NOT secret.
 *
 * Before any real deployment, replace this with proper backend sessions
 * (e.g. NextAuth, a JWT issued by FastAPI after a real login endpoint,
 * httpOnly cookies). This file exists to make the ADMIN-ONLY UI PATTERN
 * demonstrable now — swap the implementation, keep the same useAuth()
 * interface, and every page using it keeps working unchanged.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextValue {
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "groundtruth_admin_session";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "groundtruth-admin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  };

  return <AuthContext.Provider value={{ isAdmin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
