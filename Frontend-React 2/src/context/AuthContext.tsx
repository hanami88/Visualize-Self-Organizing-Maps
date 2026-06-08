import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  accessToken: string;
  isLoading: boolean;
  isAdmin: boolean;
  login: (userData: User, token: string) => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // ── Helpers nội bộ ────────────────────────────────────────────────────────

  const _setSession = (token: string, userData: User) => {
    sessionStorage.setItem("access_token", token);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setAccessToken(token);
    setUser(userData);
  };

  const _clearSession = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    setAccessToken("");
    setUser(null);
  };

  /**
   * Gọi GET /me với access token.
   * Trả về true nếu token còn hợp lệ, false nếu đã hết hạn / không hợp lệ.
   */
  const _verifyAccessToken = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok; // 200 = còn sống, 401/422 = hết hạn
    } catch {
      return false; // lỗi mạng → coi như invalid, sẽ thử refresh
    }
  };

  /**
   * Gọi POST /refresh với HttpOnly cookie.
   * Nếu thành công → cập nhật state + sessionStorage, trả về token mới.
   * Nếu thất bại (refresh token hết hạn) → trả về null.
   */
  const _callRefresh = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        _setSession(data.access_token, data.user);
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  };

  // ── Restore session khi F5 / mở app lần đầu ───────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true);

      const savedToken = sessionStorage.getItem("access_token");
      const savedUser = sessionStorage.getItem("user");

      if (savedToken && savedUser) {
        // BƯỚC 1: Có token trong sessionStorage → verify còn hợp lệ không
        const stillValid = await _verifyAccessToken(savedToken);

        if (stillValid) {
          // Token còn sống → dùng luôn, không cần round-trip thêm
          setAccessToken(savedToken);
          setUser(JSON.parse(savedUser));
          setIsLoading(false);
          return;
        }

        // BƯỚC 2: Access token hết hạn → thử dùng refresh token (cookie)
        const newToken = await _callRefresh();

        if (newToken) {
          // Refresh thành công → state đã được set trong _callRefresh
          setIsLoading(false);
          return;
        }

        // BƯỚC 3: Refresh cũng hết hạn → về guest, clear session
        _clearSession();
      } else {
        // Không có token trong sessionStorage (tab mới, đóng tab trước đó, v.v.)
        // Vẫn thử refresh phòng trường hợp cookie còn hiệu lực
        await _callRefresh(); // nếu thất bại, _clearSession không cần gọi vì state đã là null
      }

      setIsLoading(false);
    };

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const login = (userData: User, token: string) => {
    _setSession(token, userData);
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Lỗi logout:", err);
    } finally {
      _clearSession();
      navigate("/");
    }
  };

  /**
   * Dùng khi gặp lỗi 401 trong component:
   *   const token = await refreshAccessToken();
   *   if (token) retry với token mới, else đã bị logout tự động.
   */
  const refreshAccessToken = async (): Promise<string | null> => {
    const newToken = await _callRefresh();
    if (!newToken) {
      // Refresh hết hạn → buộc logout
      _clearSession();
      navigate("/login");
    }
    return newToken;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAdmin: user?.role === "admin",
        login,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
