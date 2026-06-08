import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import { useAuth } from "../context/AuthContext";
import {
  ShieldCheck,
  Users,
  Cpu,
  Trash2,
  Edit2,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  model_count: number;
}

interface UserModel {
  id: number;
  slot: number;
  model_name: string;
  accuracy: number | null;
  loss: number | null;
  epochs_trained: number;
  hidden_sizes: number[];
  updated_at: string;
}

interface Preset {
  key: string;
  label: string;
  config: Record<string, unknown>;
  trained: boolean;
  layers: number;
}

// ── Small helpers ──────────────────────────────────────────────────────────
function Badge({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "gray" | "blue" | "green" | "red";
}) {
  const cls = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-600",
  }[color];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, accessToken, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"users" | "presets">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  // ── User management state ─────────────────────────────────────────────
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [userModels, setUserModels] = useState<Record<number, UserModel[]>>({});
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "user" as "user" | "admin",
    password: "",
  });
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
  });

  // ── Preset training state ─────────────────────────────────────────────
  const [trainingPreset, setTrainingPreset] = useState<string | null>(null);
  const [presetProgress, setPresetProgress] = useState<
    Record<string, { epoch: number; total: number; accuracy: number }>
  >({});

  const authH = useCallback(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Guard ─────────────────────────────────────────────────────────────
  // ── Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return; // Chờ restore session xong mới check
    if (!user) {
      navigate("/login");
      return;
    }
    if (!isAdmin) {
      navigate("/");
      return;
    }
  }, [user, isAdmin, isLoading, navigate]);

  // ── Fetch data ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users`,
        authH(),
      );
      setUsers(r.data);
    } catch {
      showToast("Lỗi tải danh sách user", "err");
    } finally {
      setLoading(false);
    }
  }, [authH]);

  const fetchPresets = useCallback(async () => {
    try {
      const r = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/admin/presets`,
        authH(),
      );
      setPresets(r.data);
    } catch {
      /* silent */
    }
  }, [authH]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPresets();
    }
  }, [isAdmin, fetchUsers, fetchPresets]);

  const fetchUserModels = async (uid: number) => {
    if (userModels[uid]) return;
    try {
      const r = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users/${uid}/models`,
        authH(),
      );
      setUserModels((prev) => ({ ...prev, [uid]: r.data }));
    } catch {
      /* silent */
    }
  };

  const toggleExpand = (uid: number) => {
    if (expandedUser === uid) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(uid);
    fetchUserModels(uid);
  };

  // ── User CRUD ─────────────────────────────────────────────────────────
  const handleDeleteUser = async (uid: number) => {
    if (!confirm("Xác nhận xoá người dùng này và toàn bộ model của họ?"))
      return;
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users/${uid}`,
        authH(),
      );
      showToast("Đã xoá người dùng");
      fetchUsers();
    } catch {
      showToast("Lỗi khi xoá", "err");
    }
  };

  const handleDeleteModel = async (uid: number, mid: number) => {
    if (!confirm("Xoá model này?")) return;
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users/${uid}/models/${mid}`,
        authH(),
      );
      showToast("Đã xoá model");
      setUserModels((prev) => ({
        ...prev,
        [uid]: prev[uid].filter((m) => m.id !== mid),
      }));
      fetchUsers();
    } catch {
      showToast("Lỗi khi xoá model", "err");
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, password: "" });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users/${editingUser.id}`,
        editForm,
        authH(),
      );
      showToast("Cập nhật thành công");
      setEditingUser(null);
      fetchUsers();
    } catch {
      showToast("Lỗi cập nhật", "err");
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      showToast("Vui lòng điền đủ thông tin", "err");
      return;
    }
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/admin/users`,
        createForm,
        authH(),
      );
      showToast("Tạo người dùng thành công");
      setShowCreateUser(false);
      setCreateForm({ name: "", email: "", password: "", role: "user" });
      fetchUsers();
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.error
        : "Lỗi tạo user";
      showToast(msg, "err");
    }
  };

  // ── Preset train ──────────────────────────────────────────────────────
  const handleTrainPreset = async (key: string) => {
    if (!confirm(`Train lại preset "${key}"? Quá trình này sẽ mất vài phút.`))
      return;
    setTrainingPreset(key);
    setPresetProgress((p) => ({
      ...p,
      [key]: { epoch: 0, total: 0, accuracy: 0 },
    }));
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/admin/presets/${key}/train`,
        {},
        authH(),
      );
      // Poll status
      const poll = setInterval(async () => {
        try {
          const r = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/admin/presets/${key}/status`,
            authH(),
          );
          const d = r.data;
          setPresetProgress((p) => ({
            ...p,
            [key]: {
              epoch: d.epoch,
              total: d.total_epochs,
              accuracy: d.accuracy,
            },
          }));
          if (!d.running && d.epoch > 0) {
            clearInterval(poll);
            setTrainingPreset(null);
            showToast(
              `Preset "${key}" đã train xong! Accuracy: ${(d.accuracy * 100).toFixed(1)}%`,
            );
            fetchPresets();
          }
        } catch {
          clearInterval(poll);
          setTrainingPreset(null);
        }
      }, 2000);
    } catch {
      showToast("Lỗi khi bắt đầu train preset", "err");
      setTrainingPreset(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      <Nav />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
            toast.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.type === "ok" ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Chỉnh sửa người dùng</h3>
              <button onClick={() => setEditingUser(null)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-700" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Tên", key: "name", type: "text" },
                { label: "Email", key: "email", type: "email" },
                {
                  label: "Mật khẩu mới (để trống = không đổi)",
                  key: "password",
                  type: "password",
                },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(editForm as Record<string, string>)[key]}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Vai trò
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      role: e.target.value as "user" | "admin",
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleUpdateUser}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Lưu thay đổi
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Tạo người dùng mới</h3>
              <button onClick={() => setShowCreateUser(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-700" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Tên", key: "name", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Mật khẩu", key: "password", type: "password" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(createForm as Record<string, string>)[key]}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Vai trò
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      role: e.target.value as "user" | "admin",
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreateUser}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Tạo tài khoản
              </button>
              <button
                onClick={() => setShowCreateUser(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black rounded-xl">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Trang Quản trị
                </h1>
                <p className="text-sm text-gray-400">Xin chào, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchUsers();
                fetchPresets();
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>

          {/* Stats overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Tổng user",
                value: users.length,
                icon: <Users className="w-5 h-5" />,
              },
              {
                label: "Tổng model",
                value: users.reduce((s, u) => s + u.model_count, 0),
                icon: <Cpu className="w-5 h-5" />,
              },
              {
                label: "Preset đã train",
                value: presets.filter((p) => p.trained).length,
                icon: <Check className="w-5 h-5" />,
              },
              {
                label: "Admin",
                value: users.filter((u) => u.role === "admin").length,
                icon: <ShieldCheck className="w-5 h-5" />,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1 text-gray-400">
                  {s.icon}
                  <span className="text-xs">{s.label}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-white p-1 rounded-xl border border-gray-100 w-fit shadow-sm">
            {(["users", "presets"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-black text-white"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "users" ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Người dùng
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    Preset Model
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Users ── */}
          {activeTab === "users" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">
                  Danh sách người dùng ({users.length})
                </h2>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm user
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto" />
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <div key={u.id}>
                      <div className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                            u.role === "admin" ? "bg-blue-600" : "bg-gray-400"
                          }`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {u.name}
                            </p>
                            <Badge color={u.role === "admin" ? "blue" : "gray"}>
                              {u.role === "admin" ? "Admin" : "User"}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {u.email}
                          </p>
                        </div>
                        <div className="shrink-0 text-right hidden sm:block">
                          <p className="text-xs text-gray-400">
                            {u.model_count} model
                          </p>
                          <p className="text-[10px] text-gray-300">
                            {new Date(u.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleExpand(u.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {expandedUser === u.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          {u.role !== "admin" && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded: user models */}
                      {expandedUser === u.id && (
                        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                          <p className="text-xs font-bold text-gray-400 uppercase py-2">
                            Model của {u.name}
                          </p>
                          {(userModels[u.id] ?? []).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">
                              Chưa có model nào
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {(userModels[u.id] ?? []).map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800">
                                      Slot {m.slot} — {m.model_name}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Acc:{" "}
                                      {m.accuracy != null
                                        ? `${(m.accuracy * 100).toFixed(1)}%`
                                        : "—"}{" "}
                                      · Loss: {m.loss?.toFixed(4) ?? "—"} ·{" "}
                                      {m.epochs_trained} epoch · [
                                      {m.hidden_sizes.join(", ")}]
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-gray-300 shrink-0">
                                    {new Date(m.updated_at).toLocaleDateString(
                                      "vi-VN",
                                    )}
                                  </p>
                                  <button
                                    onClick={() =>
                                      handleDeleteModel(u.id, m.id)
                                    }
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Presets ── */}
          {activeTab === "presets" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Chỉ Admin mới có thể train lại 3 model preset của hệ thống. User
                có thể chọn dùng các preset này để predict.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {presets.map((p) => {
                  const prog = presetProgress[p.key];
                  const isTrainingThis = trainingPreset === p.key;
                  return (
                    <div
                      key={p.key}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      <div
                        className={`p-4 ${
                          p.key === "quick"
                            ? "bg-gradient-to-br from-green-500 to-emerald-400"
                            : p.key === "balanced"
                              ? "bg-gradient-to-br from-blue-500 to-cyan-400"
                              : "bg-gradient-to-br from-purple-600 to-pink-500"
                        } text-white`}
                      >
                        <h3 className="font-bold text-lg">{p.label}</h3>
                        <Badge color={p.trained ? "green" : "red"}>
                          {p.trained ? "Đã train" : "Chưa train"}
                        </Badge>
                      </div>
                      <div className="p-4">
                        <div className="space-y-1 text-xs text-gray-500 mb-4">
                          <p>
                            Epochs:{" "}
                            <strong className="text-gray-800">
                              {p.config.epochs as number}
                            </strong>
                          </p>
                          <p>
                            Hidden:{" "}
                            <strong className="text-gray-800">
                              [{(p.config.hidden_sizes as number[]).join(", ")}]
                            </strong>
                          </p>
                          <p>
                            LR:{" "}
                            <strong className="text-gray-800">
                              {p.config.lr as number}
                            </strong>
                          </p>
                          <p>
                            SOM size:{" "}
                            <strong className="text-gray-800">
                              {p.config.som_size as number}×
                              {p.config.som_size as number}
                            </strong>
                          </p>
                        </div>

                        {isTrainingThis && prog && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>
                                Epoch {prog.epoch}/{prog.total}
                              </span>
                              <span>
                                {prog.total > 0
                                  ? `${(prog.accuracy * 100).toFixed(1)}%`
                                  : "—"}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{
                                  width:
                                    prog.total > 0
                                      ? `${(prog.epoch / prog.total) * 100}%`
                                      : "0%",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleTrainPreset(p.key)}
                          disabled={!!trainingPreset}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isTrainingThis ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              Đang train...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              {p.trained ? "Train lại" : "Train ngay"}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
