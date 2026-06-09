import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Eye, EyeOff, User, Mail, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { ButtonBlack, ButtonBlue } from "../components/Button";

export default function Profile() {
  const { user, accessToken, isLoading: authLoading } = useAuth();

  // State cho form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // State UI
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Chờ restore session xong mới check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-cyan-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  // BẢO VỆ ROUTE: Nếu chưa đăng nhập, đá thẳng về trang Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    // Validate cơ bản
    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Đính kèm Access Token vào Header để chứng minh thân phận
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Lỗi 401 Unauthorized có thể do sai pass cũ hoặc token hết hạn
        if (response.status === 401 && data.msg === "Token has expired") {
          throw new Error(
            "Phiên đăng nhập đã hết hạn, vui lòng F5 hoặc đăng nhập lại.",
          );
        }
        throw new Error(data.error || "Đổi mật khẩu thất bại");
      }

      // Thành công
      setMessage({ type: "success", text: "Đổi mật khẩu thành công!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
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
          <Link to="/" className="flex-1 sm:flex-none">
            <ButtonBlack className="px-[1rem] py-[0.6rem] flex justify-between items-center">
              Trở lại trang chủ
            </ButtonBlack>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h2>
          <p className="text-gray-500 mt-2">
            Quản lý thông tin và bảo mật tài khoản của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Cột trái: Thông tin cơ bản */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <User className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
                <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium">
                  <Shield className="w-4 h-4" /> Tài khoản Active
                </span>
              </div>

              <div className="mt-8 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Họ và tên
                  </label>
                  <div className="flex items-center gap-3 mt-1 text-gray-900 font-medium">
                    <User className="w-5 h-5 text-gray-400" />
                    {user.name}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Email
                  </label>
                  <div className="flex items-center gap-3 mt-1 text-gray-900 font-medium break-all">
                    <Mail className="w-5 h-5 text-gray-400" />
                    {user.email}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Form đổi mật khẩu */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">
                Đổi mật khẩu
              </h3>

              {message.text && (
                <div
                  className={`mb-6 p-4 rounded-lg text-sm border ${
                    message.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-5">
                {/* Mật khẩu hiện tại */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="border-blue-200 focus:ring-2 focus:ring-blue-500 pr-10 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="border-blue-200 focus:ring-2 focus:ring-blue-500 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div className="pt-4">
                  <ButtonBlue
                    type="submit"
                    disabled={
                      isLoading ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="w-full md:w-auto px-8"
                  >
                    {isLoading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                  </ButtonBlue>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
