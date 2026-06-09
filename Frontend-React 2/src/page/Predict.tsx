import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ButtonBlack, ButtonBlue } from "../components/Button";
import { RotateCcw, Upload, Zap, X } from "lucide-react";
import axios from "axios";
import HexagonalGrid from "../components/HexagonalGrid";
import Nav from "../components/Nav.tsx";
import { useAuth } from "../context/AuthContext";
// ── Preset options ─────────────────────────────────────────────────────────

interface MyModel {
  id: number;
  slot: number;
  model_name: string;
  accuracy: number | null;
  epochs_trained: number;
}
// ── Types ─────────────────────────────────────────────────────────────────
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

interface SOMPosition {
  layer_idx: number;
  layer_name: string;
  som_x: number;
  som_y: number;
  activation: number[];
}

interface PredictResult {
  prediction: number;
  confidence: number;
  probabilities: Record<string, number>;
  som_positions: SOMPosition[];
}

// ── Màu sắc ───────────────────────────────────────────────────────────────
const DIGIT_COLORS: Record<number, string> = {
  0: "#e24b4a",
  1: "#378add",
  2: "#639922",
  3: "#ba7517",
  4: "#533ab7",
  5: "#d85a30",
  6: "#1d9e75",
  7: "#d4537e",
  8: "#888780",
  9: "#0f6e56",
};

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
    ? "#1a1a1a"
    : "#ffffff";
}

// ── Prob bar ──────────────────────────────────────────────────────────────
function ProbBar({
  digit,
  prob,
  isTop,
}: {
  digit: number;
  prob: number;
  isTop: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0"
        style={{ backgroundColor: DIGIT_COLORS[digit] }}
      >
        {digit}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(prob * 100).toFixed(1)}%`,
            backgroundColor: isTop ? DIGIT_COLORS[digit] : "#cbd5e1",
          }}
        />
      </div>
      <span
        className={`w-10 text-right font-mono ${isTop ? "font-bold text-gray-800" : "text-gray-400"}`}
      >
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function Predict() {
  const { user, accessToken, refreshAccessToken } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<"canvas" | "upload">(
    "canvas",
  );

  const [result, setResult] = useState<PredictResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [layerSoms, setLayerSoms] = useState<LayerSOM[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("balanced");
  const [myModels, setMyModels] = useState<MyModel[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>("Balanced");
  // ── Helper: tạo axios config với Authorization header nếu có token ───────
  const authHeaders = useCallback(() => {
    if (accessToken) {
      return { headers: { Authorization: `Bearer ${accessToken}` } };
    }
    return {};
  }, [accessToken]);

  // ── Init canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // ── Lấy layer_soms từ /results — kèm token để server biết user nào ───────
  // ── Lấy layer_soms theo model/preset được chọn ───────────────────────────
  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Xây dựng params theo selectedSource
        let url = `${import.meta.env.VITE_BACKEND_URL}/results`;
        const params: Record<string, string> = {};

        if (["quick", "balanced", "high"].includes(selectedSource)) {
          params.preset = selectedSource;
        } else if (selectedSource.startsWith("slot_")) {
          params.slot = selectedSource.replace("slot_", "");
        }

        const res = await axios.get(url, {
          ...authHeaders(),
          params,
        });
        const soms: LayerSOM[] = res.data.layer_soms ?? [];
        setLayerSoms(soms);
      } catch {
        setLayerSoms([]);
      }
    };

    fetchResults();
  }, [accessToken, authHeaders, selectedSource]);

  // Fetch danh sách model của user
  // Fetch danh sách model của user
  useEffect(() => {
    if (!user || !accessToken) {
      // Khách chưa đăng nhập → mặc định dùng balanced
      setSelectedSource("balanced");
      setSourceLabel("Balanced");
      return;
    }
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/models/my`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((r) => {
        setMyModels(r.data);
        // Nếu user có model riêng → tự động chọn slot mới nhất
        if (r.data.length > 0) {
          const latest = r.data[r.data.length - 1];
          setSelectedSource(`slot_${latest.slot}`);
          setSourceLabel(latest.model_name);
        }
      })
      .catch(() => setMyModels([]));
  }, [user, accessToken]);

  // ── Canvas drawing ───────────────────────────────────────────────────────
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    setActiveSource("canvas");
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPos) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getTouchPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    setActiveSource("canvas");
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !lastPos) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getTouchPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setResult(null);
    setError(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
      setActiveSource("upload");
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // ── Predict — kèm Authorization header để server biết user nào ───────────
  const handlePredict = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    console.log("BACKEND URL:", import.meta.env.VITE_BACKEND_URL);
    console.log("selectedSource:", selectedSource);
    try {
      let imageB64: string;

      if (activeSource === "upload" && uploadedImage) {
        imageB64 = uploadedImage;
      } else {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const W = canvas.width;
        const H = canvas.height;
        const imgData = ctx.getImageData(0, 0, W, H);
        const data = imgData.data;

        let minX = W,
          maxX = 0,
          minY = H,
          maxY = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const r = data[(y * W + x) * 4];
            if (r > 30) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const offscreen = document.createElement("canvas");
        offscreen.width = 28;
        offscreen.height = 28;
        const octx = offscreen.getContext("2d")!;
        octx.fillStyle = "#000000";
        octx.fillRect(0, 0, 28, 28);

        if (maxX > minX && maxY > minY) {
          const pad = Math.max(maxX - minX, maxY - minY) * 0.1;
          const srcX = Math.max(0, minX - pad);
          const srcY = Math.max(0, minY - pad);
          const srcW = Math.min(W, maxX + pad) - srcX;
          const srcH = Math.min(H, maxY + pad) - srcY;
          const scale = 20 / Math.max(srcW, srcH);
          const dstW = srcW * scale;
          const dstH = srcH * scale;
          const offsetX = (28 - dstW) / 2;
          const offsetY = (28 - dstH) / 2;
          octx.drawImage(
            canvas,
            srcX,
            srcY,
            srcW,
            srcH,
            offsetX,
            offsetY,
            dstW,
            dstH,
          );
        } else {
          octx.drawImage(canvas, 0, 0, 28, 28);
        }

        imageB64 = offscreen.toDataURL("image/png");
      }

      // ── Gọi /predict với Authorization header ────────────────────────────
      // Server dùng token để biết đây là user nào, từ đó chọn đúng model
      // Xây dựng body predict theo model được chọn
      const predictBody: Record<string, unknown> = { image: imageB64 };
      if (["quick", "balanced", "high"].includes(selectedSource)) {
        predictBody.preset = selectedSource;
      } else if (selectedSource.startsWith("slot_")) {
        predictBody.slot = parseInt(selectedSource.replace("slot_", ""));
      }
      // "my_model" → không thêm gì, server tự dùng model mới nhất của user

      let res;
      try {
        res = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/predict`,
          predictBody,
          authHeaders(),
        );
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            res = await axios.post(
              `${import.meta.env.VITE_BACKEND_URL}/predict`,
              predictBody,
              { headers: { Authorization: `Bearer ${newToken}` } },
            );
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      setResult(res!.data as PredictResult);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : "Lỗi không xác định";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [activeSource, uploadedImage, authHeaders, refreshAccessToken]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50">
      <Nav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-1">
            Chuẩn đoán chữ số
          </h2>
          <p className="text-sm text-muted-foreground">
            Vẽ một chữ số hoặc tải lên một hình ảnh, SOM sẽ làm nổi bật vị trí
            mà đầu vào của bạn tương ứng
            {user && (
              <span className="ml-2 text-blue-600 font-medium">
                · Sử dụng model của {user.name}
              </span>
            )}
          </p>
        </div>

        {/* Banner thông báo khi chưa đăng nhập */}
        {!user && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-amber-700">
              Bạn đang dùng model mặc định của hệ thống.{" "}
              <strong>Đăng nhập</strong> để train và dùng model riêng.
            </p>
            <Link
              to="/login"
              className="ml-4 shrink-0 text-sm font-medium text-amber-800 underline hover:text-amber-900"
            >
              Đăng nhập →
            </Link>
          </div>
        )}
        {/* Model selector */}
        <div className="mb-4 p-4 bg-white rounded-lg border border-[0.1rem] border-black/20">
          <h3 className="font-semibold text-sm mb-2 text-gray-700">
            Chọn model để dự đoán
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* My model slots */}
            {user && myModels.length > 0 ? (
              <>
                {myModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedSource(`slot_${m.slot}`);
                      setSourceLabel(m.model_name);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedSource === `slot_${m.slot}`
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Slot {m.slot} — {m.model_name}
                    {m.accuracy != null && (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({(m.accuracy * 100).toFixed(0)}%)
                      </span>
                    )}
                  </button>
                ))}
              </>
            ) : user ? (
              <span className="text-xs text-gray-400 italic">
                Chưa có model riêng
              </span>
            ) : null}

            {/* Preset buttons */}
            <div className="w-full mt-1 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
              <span className="text-[10px] text-gray-400 w-full mb-1">
                Model hệ thống:
              </span>
              {[
                { value: "quick", label: "Quick Test" },
                { value: "balanced", label: "Balanced" },
                { value: "high", label: "High Accuracy" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    setSelectedSource(p.value);
                    setSourceLabel(p.label);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedSource === p.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {sourceLabel && (
            <p className="mt-2 text-xs text-blue-600 font-medium">
              Đang dùng: {sourceLabel}
            </p>
          )}
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Left: Canvas + Upload + Result ── */}
          <div className="space-y-4">
            {/* Canvas */}
            <div className="p-4 bg-white rounded-lg border border-[0.1rem] border-black/20">
              <h3 className="font-semibold text-base mb-3 text-foreground">
                Draw a Digit
              </h3>
              <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={280}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawingTouch}
                  onTouchMove={drawTouch}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full border-2 border-blue-200 rounded-lg cursor-crosshair bg-black touch-none"
                  style={{ display: "block" }}
                />
                {activeSource === "canvas" && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium">
                    active
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <ButtonBlack
                  onClick={clearCanvas}
                  className="w-full gap-2 px-[1rem] py-[0.6rem] flex justify-center items-center"
                >
                  <RotateCcw className="w-4 h-4" />
                  Xoá chữ số
                </ButtonBlack>
              </div>
            </div>

            {/* Upload */}
            <div className="p-4 bg-white rounded-lg border border-[0.1rem] border-black/20">
              <h3 className="font-semibold text-base mb-3 text-foreground">
                Tải hình ảnh lên
              </h3>
              {uploadedImage ? (
                <div className="relative mb-3">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className={`w-full rounded-lg border-2 object-cover max-h-48 ${
                      activeSource === "upload"
                        ? "border-blue-500"
                        : "border-blue-200"
                    }`}
                  />
                  <button
                    onClick={() => {
                      setUploadedImage(null);
                      setResult(null);
                      setError(null);
                      if (activeSource === "upload") setActiveSource("canvas");
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {activeSource === "upload" && (
                    <span className="absolute top-1.5 left-1.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium">
                      active
                    </span>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors mb-3"
                >
                  <div className="text-center">
                    <Upload className="w-7 h-7 text-primary mx-auto mb-1" />
                    <p className="text-xs font-medium text-foreground">
                      Click để tải lên
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <ButtonBlack
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2 px-[1rem] py-[0.6rem] flex justify-center items-center"
              >
                <Upload className="w-4 h-4" />
                Chọn File
              </ButtonBlack>
            </div>

            {/* Predict button + Result */}
            <div className="p-4 bg-white rounded-lg border border-[0.1rem] border-black/20">
              <h3 className="font-semibold text-base mb-3 text-foreground">
                Kết quả chuẩn đoán
              </h3>

              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}

              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <div
                      className="w-20 h-20 rounded-xl flex items-center justify-center text-5xl font-black text-white shadow-lg shrink-0"
                      style={{
                        backgroundColor: DIGIT_COLORS[result.prediction],
                      }}
                    >
                      {result.prediction}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">
                        Confidence
                      </p>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(result.confidence * 100).toFixed(0)}%`,
                            backgroundColor: DIGIT_COLORS[result.prediction],
                          }}
                        />
                      </div>
                      <p
                        className="text-sm font-bold"
                        style={{ color: DIGIT_COLORS[result.prediction] }}
                      >
                        {(result.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Tất cả tỉ lệ chuẩn đoán
                    </p>
                    {Object.entries(result.probabilities)
                      .sort((a, b) => b[1] - a[1])
                      .map(([digit, prob]) => (
                        <ProbBar
                          key={digit}
                          digit={parseInt(digit)}
                          prob={prob}
                          isTop={parseInt(digit) === result.prediction}
                        />
                      ))}
                  </div>

                  <ButtonBlue
                    onClick={handlePredict}
                    disabled={isProcessing}
                    className="w-full gap-2 px-[1rem] py-[0.6rem] flex justify-center items-center"
                  >
                    <Zap className="w-4 h-4" />
                    Chuẩn đoán lại
                  </ButtonBlue>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Draw a digit or upload an image, then click Predict
                  </p>
                  <ButtonBlue
                    onClick={handlePredict}
                    disabled={isProcessing}
                    className="w-full gap-2 px-[1rem] py-[0.6rem] flex justify-center items-center"
                  >
                    <Zap className="w-4 h-4" />
                    {isProcessing ? "Processing…" : "Predict"}
                  </ButtonBlue>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: SOM layers ── */}
          <div className="lg:col-span-2 space-y-4">
            {layerSoms.length === 0 ? (
              <div className="p-6 bg-white rounded-lg border border-[0.1rem] border-black/20 flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm font-medium mb-1">
                    Chưa có dữ liệu SOM
                  </p>
                  <p className="text-xs">
                    Hãy train model trước ở trang Training
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-lg border border-[0.1rem] border-black/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base text-foreground">
                    SOM Activation Map
                  </h3>
                  <span className="text-xs text-gray-400">
                    {layerSoms.length} hidden layer
                    {layerSoms.length > 1 ? "s" : ""}
                    {result && (
                      <span className="ml-2 text-yellow-600 font-medium">
                        · Predicting {result.prediction}
                      </span>
                    )}
                  </span>
                </div>
                <HexagonalGrid
                  layerSoms={layerSoms}
                  somSize={layerSoms[0]?.som_size ?? 10}
                  probabilities={result?.probabilities}
                  bmuPositions={
                    result?.som_positions?.map((p) => ({
                      layer_idx: p.layer_idx,
                      som_x: p.som_x,
                      som_y: p.som_y,
                    })) ?? []
                  }
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
