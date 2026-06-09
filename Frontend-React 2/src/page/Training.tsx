import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ButtonBlack, ButtonBlue } from "../components/Button";
import { Play, Pause, RotateCcw, Lock, ChevronDown } from "lucide-react";
import Nav from "../components/Nav.tsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import HexagonalGrid from "../components/HexagonalGrid.tsx";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../context/AuthContext.tsx/index.ts";

// ── Types ────────────────────────────────────────────────────────────────────
interface LayerSOM {
  layer_idx: number;
  layer_name: string;
  som_size: number;
  dominant_label_map: number[][];
  label_distribution_map: Record<string, number>[][];
  activation_map: number[][];
  sample_positions: {
    idx: number;
    label: number;
    som_x: number;
    som_y: number;
  }[];
  u_matrix: number[][];
  n_samples: number;
  n_dims: number;
}

interface ExistingModel {
  id: number;
  slot: number;
  model_name: string;
  accuracy: number | null;
  epochs_trained: number;
  created_at: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Training() {
  const { user, accessToken, refreshAccessToken } = useAuth();

  // ── Config ───────────────────────────────────────────────────────────────
  const [layers, setLayers] = useState("128,64");
  const [epochs, setEpochs] = useState(8);
  const [lr, setLr] = useState(0.001);
  const [batchSize, setBatchSize] = useState(256);
  const [somInterval, setSomInterval] = useState(1);
  const [maxSamples, setMaxSamples] = useState(2000);
  const [somSize, setSomSize] = useState(10);
  const [modelName, setModelName] = useState("");
  const [emitEveryN, setEmitEveryN] = useState(20);

  // ── Slot / override dialog ────────────────────────────────────────────────
  const [existingModels, setExistingModels] = useState<ExistingModel[]>([]);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  // ── Training state ────────────────────────────────────────────────────────
  const [isTraining, setIsTraining] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lossHistory, setLossHistory] = useState<
    {
      epoch: number;
      loss: number;
      accuracy: number;
    }[]
  >([]);

  // ── Batch progress (sub-epoch) ────────────────────────────────────────────
  const [batchProgress, setBatchProgress] = useState(0); // 0–1
  const [batchLoss, setBatchLoss] = useState<number | null>(null);
  const [phaseMessage, setPhaseMessage] = useState("");
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  // ── SOM ───────────────────────────────────────────────────────────────────
  const [layerSoms, setLayerSoms] = useState<LayerSOM[]>([]);
  const [isDefaultModel, setIsDefaultModel] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // ── Fetch danh sách model hiện có của user ────────────────────────────────
  const fetchMyModels = async (token = accessToken) => {
    if (!token) return;
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/models/my`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setExistingModels(res.data);
    } catch {
      setExistingModels([]);
    }
  };

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL as string, {
      transports: ["websocket"],
      query: accessToken ? { token: accessToken } : {},
    });
    socketRef.current = socket;

    socket.on(
      "init",
      (data: { status: Record<string, unknown>; results: LayerSOM[] }) => {
        if (data.results?.length > 0) {
          setLayerSoms(data.results);
          setSomSize(data.results[0].som_size);
        }
        setIsDefaultModel(data.status?.is_default === true);
      },
    );

    socket.on(
      "batch_update",
      (data: {
        epoch: number;
        total_epochs: number;
        batch: number;
        total_batches: number;
        progress_in_epoch: number;
        batch_loss: number;
        phase_message: string;
      }) => {
        setCurrentEpoch(data.epoch);
        setTotalEpochs(data.total_epochs);
        setBatchProgress(data.progress_in_epoch);
        setBatchLoss(data.batch_loss);
        setPhaseMessage(data.phase_message);
        setCurrentBatch(data.batch);
        setTotalBatches(data.total_batches);
      },
    );

    socket.on(
      "epoch_update",
      (data: {
        epoch: number;
        total_epochs: number;
        loss: number;
        accuracy: number;
        layer_soms: LayerSOM[];
      }) => {
        setCurrentEpoch(data.epoch);
        setTotalEpochs(data.total_epochs);
        setLoss(data.loss);
        setAccuracy(data.accuracy);
        setBatchProgress(1);
        setLossHistory((prev) => [
          ...prev,
          { epoch: data.epoch, loss: data.loss, accuracy: data.accuracy },
        ]);
        if (data.layer_soms?.length > 0) setLayerSoms(data.layer_soms);
      },
    );

    socket.on(
      "training_complete",
      (data: { epoch: number; accuracy: number }) => {
        setIsTraining(false);
        setCurrentEpoch(data.epoch);
        setAccuracy(data.accuracy);
        setIsDefaultModel(false);
        setBatchProgress(1);
        setPhaseMessage("Huấn luyện hoàn tất! Model đã được lưu.");
        fetchMyModels();
      },
    );

    socket.on("connect_error", (err) => console.error("[socket]", err));
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (user) fetchMyModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Gọi API train ─────────────────────────────────────────────────────────
  const callTrainAPI = async (slot: number, token: string) => {
    const hidden_sizes = layers
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    const finalName =
      modelName.trim() ||
      `Model ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;

    const body = {
      slot,
      model_name: finalName,
      epochs,
      hidden_sizes,
      lr,
      batch_size: batchSize,
      som_interval: somInterval,
      max_samples: maxSamples,
      som_size: somSize,
      emit_every_n_batches: emitEveryN,
    };

    const res = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/train`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res;
  };

  const handleStartTraining = async () => {
    if (!user || !accessToken) return;

    // Kiểm tra max model
    if (existingModels.length >= 3) {
      setShowOverrideDialog(true);
      return;
    }

    setIsTraining(true);
    setLossHistory([]);
    setCurrentEpoch(0);
    setBatchProgress(0);
    setPhaseMessage("Đang chuẩn bị dữ liệu MNIST...");

    try {
      await callTrainAPI(0, accessToken);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          // Backend báo MAX_MODELS_REACHED (race condition) → hiện dialog
          setShowOverrideDialog(true);
          setIsTraining(false);
          return;
        }
        if (err.response?.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            await callTrainAPI(0, newToken);
            return;
          }
        }
      }
      setIsTraining(false);
      console.error("[train]", err);
    }
  };

  const handleOverrideConfirm = async (slot: number) => {
    setShowOverrideDialog(false);
    setPendingSlot(slot);
    setIsTraining(true);
    setLossHistory([]);
    setCurrentEpoch(0);
    setBatchProgress(0);
    setPhaseMessage("Đang chuẩn bị dữ liệu MNIST...");

    try {
      await callTrainAPI(slot, accessToken);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          await callTrainAPI(slot, newToken);
          return;
        }
      }
      setIsTraining(false);
      console.error("[train override]", err);
    }
  };

  const handleStop = async () => {
    await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/stop`,
      {},
      accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : {},
    );
  };

  const handleReset = () => {
    setLayerSoms([]);
    setLossHistory([]);
    setCurrentEpoch(0);
    setTotalEpochs(0);
    setLoss(null);
    setAccuracy(null);
    setIsTraining(false);
    setBatchProgress(0);
    setPhaseMessage("");
    setPendingSlot(null);
  };

  // Progress tổng: epoch progress + batch progress trong epoch hiện tại
  const overallProgress =
    totalEpochs > 0
      ? Math.round(((currentEpoch - 1 + batchProgress) / totalEpochs) * 100)
      : 0;

  const epochProgress = Math.round(batchProgress * 100);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Nav />

      {/* Override Dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Bạn đã có 3 model
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Chọn model muốn ghi đè để tiếp tục huấn luyện:
            </p>
            <div className="space-y-2 mb-5">
              {existingModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleOverrideConfirm(m.slot)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                        Slot {m.slot} — {m.model_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Accuracy:{" "}
                        {m.accuracy != null
                          ? `${(m.accuracy * 100).toFixed(1)}%`
                          : "—"}{" "}
                        · {m.epochs_trained} epoch ·{" "}
                        {new Date(m.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 rotate-[-90deg]" />
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowOverrideDialog(false)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Huấn Luyện Model và hiển thị quá trình bằng Self-Organizing Map
              (SOM)
            </h2>
            <p className="text-sm text-muted-foreground">
              Cấu hình các tham số
            </p>
          </div>

          {/* Banners */}
          {!user && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  Bạn cần đăng nhập để huấn luyện model
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  Guest chỉ có thể xem SOM và predict bằng model mặc định.
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-3 py-1.5 border border-amber-400 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Đăng ký
                  </Link>
                </div>
              </div>
            </div>
          )}
          {user && isDefaultModel && (
            <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <div className="w-5 h-5 text-blue-500 shrink-0 mt-0.5">ℹ️</div>
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  Đang hiển thị model mặc định
                </p>
                <p className="text-xs text-blue-700">
                  Hãy cấu hình thông số và bấm{" "}
                  <strong>Bắt đầu huấn luyện</strong> để tạo model riêng.
                </p>
              </div>
            </div>
          )}
          {user && !isDefaultModel && layerSoms.length > 0 && (
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <p className="text-sm font-semibold text-green-800">
                Đang hiển thị model riêng của bạn
                {pendingSlot && ` (Slot ${pendingSlot})`}
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            {/* ── Left: Config ── */}
            <div className="space-y-3">
              <div className="p-4 rounded-lg border-[0.1rem] border-black/20 bg-white">
                <h3 className="font-semibold text-base mb-3">
                  Thông số huấn luyện
                </h3>
                <div className="space-y-3">
                  {/* Model Name */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tên model</label>
                    <input
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      disabled={isTraining || !user}
                      placeholder="VD: Thử nghiệm LR=0.001"
                      className="border-black border-[0.1rem] rounded-md h-[40px] w-full px-[12px] py-[8px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Để trống = tự động đặt tên theo ngày giờ
                    </p>
                  </div>

                  {/* Hidden Layers */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Hidden Layers</label>
                    <input
                      value={layers}
                      onChange={(e) => setLayers(e.target.value)}
                      disabled={isTraining || !user}
                      placeholder="e.g. 128,64"
                      className="border-black border-[0.1rem] rounded-md h-[40px] w-full px-[12px] py-[8px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Epochs */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Epochs</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={epochs}
                      onChange={(e) => setEpochs(Number(e.target.value) || 8)}
                      disabled={isTraining || !user}
                      className="border-black border-[0.1rem] rounded-md h-[40px] w-full px-[12px] py-[8px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Learning Rate */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Learning Rate</label>
                    <select
                      value={lr}
                      onChange={(e) => setLr(Number(e.target.value))}
                      disabled={isTraining || !user}
                      className="border-black border-[0.1rem] w-full rounded-md h-[40px] px-[12px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={0.01}>0.01</option>
                      <option value={0.001}>0.001</option>
                      <option value={0.0001}>0.0001</option>
                    </select>
                  </div>

                  {/* Batch Size */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Batch Size</label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      disabled={isTraining || !user}
                      className="border-black border-[0.1rem] rounded-md h-[40px] w-full px-[12px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={64}>64</option>
                      <option value={128}>128</option>
                      <option value={256}>256</option>
                      <option value={512}>512</option>
                    </select>
                  </div>

                  {/* Emit every N batches */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Tần suất cập nhật (batch)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={5}
                        max={50}
                        step={5}
                        value={emitEveryN}
                        onChange={(e) => setEmitEveryN(Number(e.target.value))}
                        disabled={isTraining || !user}
                        className="flex-1 accent-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-500 w-16">
                        mỗi {emitEveryN}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cập nhật mỗi N batch — càng nhỏ càng chi tiết
                    </p>
                  </div>

                  {/* SOM Interval */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      SOM Update Interval
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={somInterval}
                        onChange={(e) => setSomInterval(Number(e.target.value))}
                        disabled={isTraining || !user}
                        className="flex-1 accent-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-500 w-4">
                        {somInterval}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cập nhật SOM mỗi N epoch
                    </p>
                  </div>

                  {/* Max Samples */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Samples for SOM
                    </label>
                    <select
                      value={maxSamples}
                      onChange={(e) => setMaxSamples(Number(e.target.value))}
                      disabled={isTraining || !user}
                      className="border-black border-[0.1rem] rounded-md h-[40px] w-full px-[12px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                      <option value={2000}>2000</option>
                      <option value={5000}>5000</option>
                    </select>
                  </div>

                  {/* SOM Size */}
                  {/* SOM Size */}
                  <div className="pt-3 border-t border-black/20 space-y-1">
                    <label className="text-sm font-medium">
                      Grid size (N × N)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={3}
                        max={20}
                        value={somSize}
                        onChange={(e) =>
                          setSomSize(parseInt(e.target.value) || 10)
                        }
                        disabled={isTraining || !user}
                        className="border-black border-[0.1rem] flex-1 rounded-md h-[40px] px-[12px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {somSize}×{somSize}
                      </span>
                    </div>
                    {/* Thông báo nếu somSize khác với lưới đang hiển thị */}
                    {layerSoms.length > 0 &&
                      layerSoms[0]?.som_size !== somSize &&
                      !isTraining && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          ⚠️ Lưới hiện tại {layerSoms[0].som_size}×
                          {layerSoms[0].som_size} — sẽ đổi thành {somSize}×
                          {somSize} sau khi train
                        </p>
                      )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="p-4 rounded-lg border-[0.1rem] border-black/20 bg-white">
                <h3 className="font-semibold text-base mb-3">
                  Kiểm soát huấn luyện
                </h3>
                {!user && (
                  <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Đăng nhập để mở khóa
                  </p>
                )}
                <div className="space-y-2">
                  <ButtonBlue
                    onClick={handleStartTraining}
                    disabled={isTraining || !user}
                    className="w-full gap-2 px-4 py-2.5 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    {!user ? "Cần đăng nhập" : "Bắt đầu huấn luyện"}
                  </ButtonBlue>
                  <ButtonBlack
                    onClick={handleStop}
                    disabled={!isTraining}
                    className="w-full gap-2 px-4 py-2.5 flex justify-center items-center"
                  >
                    <Pause className="w-4 h-4" />
                    Dừng
                  </ButtonBlack>
                  <ButtonBlack
                    onClick={handleReset}
                    disabled={isTraining}
                    className="w-full gap-2 px-4 py-2.5 flex justify-center items-center"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </ButtonBlack>
                </div>

                {/* My Models list */}
                {user && existingModels.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-black/10">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Model của bạn ({existingModels.length}/3)
                    </p>
                    <div className="space-y-1.5">
                      {existingModels.map((m) => (
                        <div
                          key={m.id}
                          className="p-2 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          <p className="text-xs font-medium text-gray-800 truncate">
                            Slot {m.slot} — {m.model_name}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {m.accuracy != null
                              ? `${(m.accuracy * 100).toFixed(1)}%`
                              : "—"}{" "}
                            · {m.epochs_trained} epoch
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Overall progress */}
              <div className="p-4 bg-white rounded-lg border-[0.1rem] border-black/20">
                <h3 className="font-semibold text-base mb-3">
                  Quá trình huấn luyện
                </h3>
                <div className="space-y-3">
                  {/* Tổng progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">
                        Tổng tiến trình — Epoch {currentEpoch}/{totalEpochs}
                      </span>
                      <span
                        className={
                          isTraining
                            ? "text-blue-500 font-medium"
                            : "text-gray-400"
                        }
                      >
                        {isTraining
                          ? "Đang train…"
                          : currentEpoch > 0
                            ? "Hoàn tất ✓"
                            : "Sẵn sàng"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300"
                        style={{ width: `${Math.min(overallProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.min(overallProgress, 100)}%
                    </p>
                  </div>

                  {/* Batch progress trong epoch hiện tại */}
                  {isTraining && totalBatches > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">
                          Batch {currentBatch}/{totalBatches} trong epoch{" "}
                          {currentEpoch}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px]">
                          {batchLoss != null
                            ? `loss: ${batchLoss.toFixed(4)}`
                            : ""}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-300 h-full transition-all duration-150"
                          style={{ width: `${epochProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase message panel */}
              {(isTraining || phaseMessage) && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isTraining ? (
                        <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px]">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-800 mb-0.5">
                        Đang thực hiện:
                      </p>
                      <p className="text-sm text-blue-700 leading-relaxed">
                        {phaseMessage}
                      </p>
                      {isTraining && loss !== null && (
                        <div className="mt-2 flex gap-4 text-xs text-blue-600">
                          <span>
                            Loss: <strong>{loss.toFixed(4)}</strong>
                          </span>
                          {accuracy !== null && (
                            <span>
                              Accuracy:{" "}
                              <strong>{(accuracy * 100).toFixed(1)}%</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Stats */}
              {(loss !== null || accuracy !== null) && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">Epoch</p>
                    <p className="font-bold text-lg text-gray-800">
                      {currentEpoch}
                      <span className="text-sm text-gray-400">
                        /{totalEpochs}
                      </span>
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-green-200 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">Accuracy</p>
                    <p className="font-bold text-lg text-green-600">
                      {accuracy != null
                        ? `${(accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-orange-200 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">Loss</p>
                    <p className="font-bold text-lg text-orange-600">
                      {loss != null ? loss.toFixed(4) : "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Loss/Accuracy chart */}
              <div className="p-4 bg-white rounded-lg border-[0.1rem] border-black/20">
                <h3 className="font-semibold text-base mb-3">
                  Độ lỗi &amp; Độ chính xác
                </h3>
                {lossHistory.length > 0 ? (
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lossHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                        <XAxis
                          dataKey="epoch"
                          stroke="#94a3b8"
                          style={{ fontSize: "10px" }}
                        />
                        <YAxis
                          yAxisId="loss"
                          stroke="#f97316"
                          style={{ fontSize: "10px" }}
                        />
                        <YAxis
                          yAxisId="acc"
                          orientation="right"
                          domain={[0, 1]}
                          stroke="#22c55e"
                          style={{ fontSize: "10px" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                          formatter={(value: number, name: string) => [
                            name === "loss"
                              ? value.toFixed(4)
                              : `${(value * 100).toFixed(1)}%`,
                            name === "loss" ? "Loss" : "Accuracy",
                          ]}
                        />
                        <Line
                          yAxisId="loss"
                          type="monotone"
                          dataKey="loss"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          yAxisId="acc"
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                    Bắt đầu huấn luyện để thấy biểu đồ
                  </div>
                )}
              </div>

              {/* SOM Grid */}
              <div className="p-4 bg-white rounded-lg border-[0.1rem] border-black/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base">
                    SOM — Hidden Layers
                  </h3>
                  {layerSoms.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {layerSoms.length} layer{layerSoms.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <HexagonalGrid layerSoms={layerSoms} somSize={somSize} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
