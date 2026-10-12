import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { adminLogin, type AdminUser } from "@/services/authService";
import { clearSession, tokenExpiry, SESSION_EVENT } from "@/services/api";
type Session = { token: string; user: AdminUser };
function storedSession(): Session | null {
  try {
    const token = localStorage.getItem("admin_token");
    const user = JSON.parse(localStorage.getItem("admin_user") || "null");
    if (
      token &&
      (tokenExpiry(token) ?? 0) > Date.now() &&
      typeof user?.id === "string" &&
      typeof user?.email === "string"
    )
      return { token, user };
  } catch {
    /* Corrupt storage must never crash the application. */
  }
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  return null;
}
const AuthContext = createContext<{
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(storedSession);
  useEffect(() => {
    const sync = () => setSession(storedSession());
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = (tokenExpiry(session.token) ?? 0) - Date.now();
      if (remaining <= 0) clearSession();
      else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [session]);
  const login = useCallback(async (email: string, password: string) => {
    const result = await adminLogin(email.trim(), password);
    if (
      !result.token ||
      (tokenExpiry(result.token) ?? 0) <= Date.now() ||
      typeof result.user?.id !== "string" ||
      typeof result.user?.email !== "string"
    )
      throw new Error("The server returned an invalid session.");
    localStorage.setItem("admin_token", result.token);
    localStorage.setItem("admin_user", JSON.stringify(result.user));
    setSession(result);
    return true;
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token: session?.token ?? null,
        isAuthenticated: !!session,
        login,
        logout: clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
