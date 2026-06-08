import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonBlue } from "../components/Button";
import { Eye, EyeOff } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const passwordStrength = getPasswordStrength(formData.password);
  const isPasswordValid = formData.password.length >= 8;
  const isFormValid =
    formData.name &&
    formData.email &&
    isPasswordValid &&
    formData.password === formData.confirmPassword &&
    agreedTerms;

  function getPasswordStrength(password: string): "weak" | "medium" | "strong" {
    if (password.length < 8) return "weak";
    if (password.length < 12) return "medium";
    return "strong";
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate inputs
    if (!formData.name || !formData.email || !formData.password) {
      setError("Vui lòng điền đầy đủ thông tin");
      setIsLoading(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Email không hợp lệ");
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      setIsLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }

    if (!agreedTerms) {
      setError("Vui lòng đồng ý với điều khoản dịch vụ");
      setIsLoading(false);
      return;
    }

    try {
      // Gọi API thực tế đến Backend Flask
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đăng ký thất bại");
      }

      // Thông báo thành công và chuyển hướng sang trang đăng nhập
      alert("Đăng ký thành công! Vui lòng đăng nhập.");
      navigate("/login");
    } catch (err: any) {
      // Hiển thị lỗi từ server (ví dụ: "Email đã được sử dụng")
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50">
      {/* Header */}
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
          {/* Register Card */}
          <div className="bg-white rounded-2xl border border-blue-200 shadow-lg p-8">
            {/* Title */}
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Đăng Ký Tài Khoản
              </h2>
              <p className="text-sm text-muted-foreground">
                Tạo tài khoản để bắt đầu sử dụng SOM Visualizer
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Input */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Họ và Tên
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Nhập họ và tên của bạn"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="pt-2 space-y-2">
                    <div className="flex gap-1">
                      <div
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength === "weak" ||
                          passwordStrength === "medium" ||
                          passwordStrength === "strong"
                            ? "bg-red-400"
                            : "bg-gray-200"
                        }`}
                      />
                      <div
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength === "medium" ||
                          passwordStrength === "strong"
                            ? "bg-yellow-400"
                            : "bg-gray-200"
                        }`}
                      />
                      <div
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength === "strong"
                            ? "bg-green-400"
                            : "bg-gray-200"
                        }`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {passwordStrength === "weak" && "Mật khẩu yếu"}
                      {passwordStrength === "medium" && "Mật khẩu trung bình"}
                      {passwordStrength === "strong" && "Mật khẩu mạnh"}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  Xác Nhận Mật Khẩu
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 border-blue-200 rounded mt-0.5"
                  />
                  <span className="text-sm text-muted-foreground">
                    Tôi đồng ý với{" "}
                    <Link
                      to="#"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      điều khoản dịch vụ
                    </Link>{" "}
                    và{" "}
                    <Link
                      to="#"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      chính sách bảo mật
                    </Link>
                  </span>
                </label>
              </div>

              {/* Register Button */}
              <ButtonBlue
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full h-10 text-base font-semibold gap-2 mt-6"
              >
                {isLoading ? "Đang xử lý..." : "Đăng Ký"}
              </ButtonBlue>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-blue-100" />
              <span className="text-xs text-muted-foreground">HOẶC</span>
              <div className="flex-1 h-px bg-blue-100" />
            </div>

            {/* Login Link */}
            <p className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                Đăng nhập
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
