import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { adminLogin } from "@/services/authService";

export interface AdminUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem("admin_user");
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("admin_token"),
  );

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await adminLogin(email, password);

      setUser(res.user);
      setToken(res.token);

      localStorage.setItem("admin_user", JSON.stringify(res.user));
      localStorage.setItem("admin_token", res.token);

      return true;
    } catch (err) {
      console.error("Login failed", err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("admin_user");
    localStorage.removeItem("admin_token");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
