import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonBlue } from "../components/Button";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đăng nhập thất bại");
      }
      // Lưu thông tin user và access_token vào sessionStorage
      login(data.user, data.access_token);

      // Refresh token đã tự động nằm an toàn trong trình duyệt (không xem được bằng JS)

      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50">
      <header className="border-b border-blue-100 backdrop-blur-sm bg-white/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">
              SOM
            </div>
            <h1 className="text-xl font-bold text-foreground">
              SOM Visualizer
            </h1>
          </Link>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-70px)] px-4 py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-blue-200 shadow-lg p-8">
            {/* Title */}
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Đăng Nhập
              </h2>
              <p className="text-sm text-muted-foreground">
                Chào mừng trở lại SOM Visualizer
              </p>
            </div>
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="border-blue-200 focus:ring-2 focus:ring-primary pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Mật Khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="border-blue-200 focus:ring-2 focus:ring-primary pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 border-blue-200 rounded "
                  />
                  <span className="text-muted-foreground">Ghi nhớ tôi</span>
                </label>
                <Link
                  to="#"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>

              {/* Login Button */}
              <ButtonBlue
                type="submit"
                disabled={isLoading}
                className="w-full h-10 text-base font-semibold gap-2"
              >
                {isLoading ? "Đang xử lý..." : "Đăng Nhập"}
              </ButtonBlue>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-blue-100" />
              <span className="text-xs text-muted-foreground">HOẶC</span>
              <div className="flex-1 h-px bg-blue-100" />
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-muted-foreground">
              Chưa có tài khoản?{" "}
              <Link
                to="/register"
                className="text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>

          {/* Footer Link */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
