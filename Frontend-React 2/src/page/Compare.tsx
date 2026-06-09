import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import HexagonalGrid from "../components/HexagonalGrid";
import { useAuth } from "../context/AuthContext";
import { GitCompare, Lock } from "lucide-react";
import axios from "axios";

interface MyModel {
  id: number;
  slot: number;
  model_name: string;
  accuracy: number | null;
  loss: number | null;
  epochs_trained: number;
  hidden_sizes: number[];
  created_at: string;
  is_preset?: boolean; // true nếu là preset hệ thống
  preset_key?: string; // "quick" | "balanced" | "high"
}

interface ModelDetail {
  id: number;
  slot: number;
  model_name: string;
  accuracy: number | null;
  loss: number | null;
  epochs_trained: number;
  hidden_sizes: number[] | null;
  created_at: string;
  updated_at?: string;
  layer_soms: unknown[];
}

export default function Compare() {
  const { user, accessToken, isAdmin, isLoading } = useAuth();

  const [myModels, setMyModels] = useState<MyModel[]>([]);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [modelA, setModelA] = useState<ModelDetail | null>(null);
  const [modelB, setModelB] = useState<ModelDetail | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(0);

  useEffect(() => {
    if (!user || !accessToken) return;

    // Fetch song song: model của user + thông tin preset
    Promise.all([
      axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/models/my`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/presets/info`),
    ])
      .then(([userRes, presetRes]) => {
        const userModels: MyModel[] = userRes.data;

        // Map preset info từ API vào MyModel
        const presetKeyMap: Record<string, { id: number; slot: number }> = {
          quick: { id: -1, slot: -1 },
          balanced: { id: -2, slot: -2 },
          high: { id: -3, slot: -3 },
        };

        const presetModels: MyModel[] = presetRes.data.map(
          (p: {
            key: string;
            label: string;
            accuracy: number | null;
            loss: number | null;
            epochs_trained: number;
            hidden_sizes: number[];
          }) => ({
            id: presetKeyMap[p.key]?.id ?? -99,
            slot: presetKeyMap[p.key]?.slot ?? -99,
            model_name: p.label,
            accuracy: p.accuracy,
            loss: p.loss,
            epochs_trained: p.epochs_trained,
            hidden_sizes: p.hidden_sizes ?? [],
            created_at: "",
            is_preset: true,
            preset_key: p.key,
          }),
        );

        setMyModels([...userModels, ...presetModels]);
      })
      .catch(() => setMyModels([]));
  }, [user, accessToken]);

  const fetchModelDetail = async (model: MyModel, side: "A" | "B") => {
    if (side === "A") setLoadingA(true);
    else setLoadingB(true);
    try {
      let data: ModelDetail;

      if (model.is_preset && model.preset_key) {
        // Fetch layer_soms của preset từ /results?preset=...
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/results`,
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {},
            params: { preset: model.preset_key },
          },
        );
        data = {
          ...model,
          hidden_sizes: model.hidden_sizes ?? [],
          layer_soms: res.data.layer_soms ?? [],
        };
      } else {
        // Fetch layer_soms của model user
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/models/${model.id}/layer_soms`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        data = res.data;
      }

      if (side === "A") {
        setModelA(data);
        setSelectedA(model.id);
      } else {
        setModelB(data);
        setSelectedB(model.id);
      }
    } catch {
      if (side === "A") setModelA(null);
      else setModelB(null);
    } finally {
      if (side === "A") setLoadingA(false);
      else setLoadingB(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Nav />
        <div className="min-h-screen ...">
          <div className="text-center p-8">
            <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              Cần đăng nhập
            </h2>
            <p className="text-gray-500 mb-4">
              Đăng nhập để so sánh các model đã train.
            </p>
            <Link
              to="/login"
              className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </>
    );
  }

  const statRow = (
    label: string,
    a: string,
    b: string,
    highlight?: "higher" | "lower",
  ) => {
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);
    const aBetter = highlight === "higher" ? aNum >= bNum : aNum <= bNum;
    return (
      <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-500 self-center">{label}</span>
        <span
          className={`text-sm font-semibold text-center px-2 py-1 rounded ${!isNaN(aNum) && !isNaN(bNum) && aBetter ? "bg-green-50 text-green-700" : "text-gray-700"}`}
        >
          {a}
        </span>
        <span
          className={`text-sm font-semibold text-center px-2 py-1 rounded ${!isNaN(aNum) && !isNaN(bNum) && !aBetter ? "bg-green-50 text-green-700" : "text-gray-700"}`}
        >
          {b}
        </span>
      </div>
    );
  };

  const layerCount = Math.max(
    (modelA?.layer_soms as unknown[])?.length ?? 0,
    (modelB?.layer_soms as unknown[])?.length ?? 0,
  );

  return (
    <>
      <Nav />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <GitCompare className="w-6 h-6 text-gray-700" />
              <h2 className="text-2xl font-bold text-gray-900">
                So sánh Model
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Chọn 2 model để so sánh U-Matrix và các chỉ số trực quan
            </p>
          </div>

          {myModels.length < 2 ? (
            <div className="p-8 bg-white rounded-xl border border-gray-200 text-center">
              <GitCompare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">
                Cần ít nhất 2 model để so sánh.
              </p>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Đi train preset ở trang Admin →
                </Link>
              ) : (
                <Link
                  to="/training"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Đi train model →
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Selector */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {(["A", "B"] as const).map((side) => {
                  const selected = side === "A" ? selectedA : selectedB;
                  const other = side === "A" ? selectedB : selectedA;
                  return (
                    <div
                      key={side}
                      className="p-4 bg-white rounded-xl border border-gray-200"
                    >
                      <p className="text-xs font-bold text-gray-400 uppercase mb-3">
                        Model {side}
                      </p>
                      <div className="space-y-2">
                        {myModels
                          .filter((m) => m.id !== other)
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => fetchModelDetail(m, side)}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selected === m.id
                                  ? "border-black bg-black text-white"
                                  : "border-gray-200 hover:border-gray-400 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {m.is_preset ? "🔧 " : `Slot ${m.slot} — `}
                                  {m.model_name}
                                </p>
                                {m.is_preset && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                      selected === m.id
                                        ? "bg-white/20 text-white"
                                        : "bg-blue-50 text-blue-600"
                                    }`}
                                  >
                                    Hệ thống
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-xs mt-0.5 ${selected === m.id ? "text-gray-300" : "text-gray-400"}`}
                              >
                                {m.epochs_trained} epoch · [
                                {m.hidden_sizes?.join(", ") ?? "—"}]
                              </p>
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparison */}
              {(modelA || modelB) && (
                <>
                  {/* Stats table */}
                  <div className="mb-5 p-4 bg-white rounded-xl border border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-3">
                      So sánh chỉ số
                    </h3>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-400">
                        Chỉ số
                      </span>
                      <span className="text-xs font-bold text-center text-gray-700">
                        Model A{modelA ? ` — ${modelA.model_name}` : ""}
                      </span>
                      <span className="text-xs font-bold text-center text-gray-700">
                        Model B{modelB ? ` — ${modelB.model_name}` : ""}
                      </span>
                    </div>
                    {statRow(
                      "Accuracy",
                      modelA?.accuracy != null
                        ? `${(modelA.accuracy * 100).toFixed(2)}%`
                        : "—",
                      modelB?.accuracy != null
                        ? `${(modelB.accuracy * 100).toFixed(2)}%`
                        : "—",
                      "higher",
                    )}
                    {statRow(
                      "Loss",
                      modelA?.loss != null ? modelA.loss.toFixed(4) : "—",
                      modelB?.loss != null ? modelB.loss.toFixed(4) : "—",
                      "lower",
                    )}
                    {statRow(
                      "Epochs",
                      modelA ? String(modelA.epochs_trained) : "—",
                      modelB ? String(modelB.epochs_trained) : "—",
                    )}
                    {statRow(
                      "Hidden Layers",
                      modelA?.hidden_sizes?.length
                        ? `[${modelA.hidden_sizes.join(", ")}]`
                        : "—",
                      modelB?.hidden_sizes?.length
                        ? `[${modelB.hidden_sizes.join(", ")}]`
                        : "—",
                    )}
                  </div>

                  {/* Layer selector */}
                  {layerCount > 1 && (
                    <div className="mb-4 flex gap-2">
                      <p className="text-sm text-gray-500 self-center mr-2">
                        Xem layer:
                      </p>
                      {Array.from({ length: layerCount }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedLayer(i)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                            selectedLayer === i
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          Hidden {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Side-by-side SOM */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { model: modelA, loading: loadingA, label: "A" },
                      { model: modelB, loading: loadingB, label: "B" },
                    ].map(({ model, loading, label }) => (
                      <div
                        key={label}
                        className="p-4 bg-white rounded-xl border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-800">
                            Model {label}
                            {model ? ` — ${model.model_name}` : ""}
                          </h3>
                          {model && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded font-medium">
                              {model.accuracy != null
                                ? `${(model.accuracy * 100).toFixed(1)}%`
                                : "—"}
                            </span>
                          )}
                        </div>
                        {loading ? (
                          <div className="h-48 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          </div>
                        ) : model ? (
                          <HexagonalGrid
                            layerSoms={
                              (() => {
                                const safeLayer = Math.min(
                                  selectedLayer,
                                  model.layer_soms.length - 1,
                                );
                                const layerData = model.layer_soms[safeLayer];
                                return layerData ? [layerData] : [];
                              })() as Parameters<
                                typeof HexagonalGrid
                              >[0]["layerSoms"]
                            }
                            somSize={(() => {
                              const safeLayer = Math.min(
                                selectedLayer,
                                model.layer_soms.length - 1,
                              );
                              return (
                                (
                                  model.layer_soms[safeLayer] as {
                                    som_size?: number;
                                  }
                                )?.som_size ?? 10
                              );
                            })()}
                          />
                        ) : (
                          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                            Chọn model ở trên
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
