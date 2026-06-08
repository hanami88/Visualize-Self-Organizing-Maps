import { useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBlack } from "./Button";
import { useAuth } from "../context/AuthContext";
import { User, ShieldCheck, BookOpen, GitCompare } from "lucide-react";

export default function Nav() {
  const { user, logout, isLoading, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const renderAuthSection = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          <div className="hidden sm:block w-20 h-4 rounded bg-gray-200 animate-pulse" />
        </div>
      );
    }

    if (user) {
      return (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                isAdmin ? "bg-blue-600" : "bg-black"
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <span className="text-sm font-medium hidden sm:block">
              {user.name}
            </span>
            {isAdmin && (
              <span className="hidden sm:block text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                ADMIN
              </span>
            )}
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-2">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  {isAdmin && (
                    <span className="inline-block mt-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                      Quản trị viên
                    </span>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Hồ sơ cá nhân
                  </Link>
                  <Link
                    to="/compare"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    So sánh Model
                  </Link>
                </div>

                {isAdmin && (
                  <div className="border-t border-gray-100 py-1">
                    <Link
                      to="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Trang Quản trị
                    </Link>
                  </div>
                )}

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        <Link to="/login">
          <ButtonBlack>Đăng nhập</ButtonBlack>
        </Link>
        <Link to="/register">
          <ButtonBlack>Đăng ký</ButtonBlack>
        </Link>
      </>
    );
  };

  return (
    <nav className="border-b border-black-100 backdrop-blur-sm bg-white/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">
            SOM
          </div>
          <h1 className="text-xl font-bold text-foreground">SOM Visualizer</h1>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/guide"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:block">Hướng dẫn</span>
          </Link>
          <Link to="/predict">
            <ButtonBlack>Chuẩn đoán</ButtonBlack>
          </Link>
          {renderAuthSection()}
        </div>
      </div>
    </nav>
  );
}
