import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { authTelegram, setToken, clearToken, getToken, type AuthResult } from "@/lib/api";

interface TgUser {
  id: number;
  telegram_id: number;
  full_name: string;
  username: string | null;
  role: string;
  roles: string[];
}

interface AuthContextType {
  user: TgUser | null;
  loading: boolean;
  displayName: string;
  roles: string[];
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  displayName: "",
  roles: [],
  signOut: async () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<TgUser | null>(null);
  const [loading, setLoading] = useState(true);

  const authenticate = useCallback(async () => {
    try {
      // Try Telegram WebApp initData
      const tg = (window as any).Telegram?.WebApp;
      let initData = tg?.initData;

      // Dev fallback: use stored token or admin ID
      if (!initData) {
        const existingToken = getToken();
        if (existingToken) {
          // Token exists, try to decode user from localStorage
          const cached = localStorage.getItem("sfera_user");
          if (cached) {
            setUser(JSON.parse(cached));
            setLoading(false);
            return;
          }
        }
        // Dev mode: use admin telegram ID
        initData = import.meta.env.VITE_DEV_TELEGRAM_ID || "";
        if (!initData) {
          setLoading(false);
          return;
        }
      }

      const result: AuthResult = await authTelegram(initData);
      setToken(result.token);
      setUser(result.user as TgUser);
      localStorage.setItem("sfera_user", JSON.stringify(result.user));

      // Expand Telegram WebApp
      tg?.ready?.();
      tg?.expand?.();
    } catch (err) {
      console.error("Auth failed:", err);
      clearToken();
      localStorage.removeItem("sfera_user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  const signOut = async () => {
    clearToken();
    localStorage.removeItem("sfera_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        displayName: user?.full_name || "",
        roles: user?.roles || [],
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
