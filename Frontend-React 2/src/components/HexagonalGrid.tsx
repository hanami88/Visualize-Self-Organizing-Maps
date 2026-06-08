import { useState, useMemo } from "react";

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

type ViewMode = "umatrix" | "scatter" | "markers";

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

interface HexagonalGridProps {
  layerSoms: LayerSOM[];
  somSize: number;
  probabilities?: Record<string, number>;
  bmuPositions?: { layer_idx: number; som_x: number; som_y: number }[];
}

// ── Seeded random để jitter ổn định ────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── ViewMode Toggle ─────────────────────────────────────────────────────────
function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const options: { value: ViewMode; label: string; desc: string }[] = [
    {
      value: "umatrix",
      label: "U-Matrix",
      desc: "Cấu trúc cluster — vùng sáng = cụm, vùng tối = ranh giới",
    },
    {
      value: "scatter",
      label: "Scatter Plot",
      desc: "Phân bố mẫu thực tế — mỗi chấm = 1 mẫu, màu = chữ số",
    },
    {
      value: "markers",
      label: "U-Matrix + Markers",
      desc: "Kết hợp chuẩn học thuật — nền U-Matrix + nhãn theo neuron",
    },
  ];

  return (
    <div className="flex flex-col gap-1 mb-3">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        Chế độ hiển thị
      </span>
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.desc}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
              ${
                mode === opt.value
                  ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-gray-400 italic">
        {options.find((o) => o.value === mode)?.desc}
      </span>
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────
function Legend({
  mode,
  probabilities,
}: {
  mode: ViewMode;
  probabilities?: Record<string, number>;
}) {
  const maxProb = probabilities ? Math.max(...Object.values(probabilities)) : 1;

  return (
    <div className="mt-3 space-y-2">
      {/* U-matrix gradient bar */}
      {(mode === "umatrix" || mode === "markers") && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium w-20 shrink-0">
            U-Matrix:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Cụm</span>
            <div
              className="w-24 h-3 rounded"
              style={{
                background:
                  "linear-gradient(to right, #e2e7f1, #808590, #1e2330)",
              }}
            />
            <span className="text-xs text-gray-400">Ranh giới</span>
          </div>
        </div>
      )}

      {/* Digit colors — scatter + markers */}
      {(mode === "scatter" || mode === "markers") && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, i) => {
            const prob = probabilities?.[String(i)];
            const hasPred = probabilities !== undefined;
            const opacity = hasPred
              ? prob !== undefined && prob > 0
                ? 0.3 + (prob / maxProb) * 0.7
                : 0.2
              : 1;
            return (
              <div
                key={i}
                className="flex items-center gap-1 text-xs transition-opacity duration-500"
                style={{ opacity }}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: DIGIT_COLORS[i] }}
                />
                <span className="text-gray-600">
                  {i}
                  {prob !== undefined ? ` ${(prob * 100).toFixed(0)}%` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* BMU legend */}
      <div className="flex items-center gap-1 text-xs border-t border-gray-100 pt-2">
        <span className="inline-block w-4 h-4 rounded-sm border-2 border-yellow-400 bg-yellow-100" />
        <span className="text-yellow-600 font-medium">BMU của input</span>
      </div>
    </div>
  );
}

// ── Single Layer Grid ───────────────────────────────────────────────────────
function SingleLayerGrid({
  layer,
  somSize: somSizeProp,
  probabilities,
  bmu,
  mode,
}: {
  layer: LayerSOM;
  somSize: number;
  probabilities?: Record<string, number>;
  bmu?: { som_x: number; som_y: number } | null;
  mode: ViewMode;
}) {
  // Ưu tiên dùng som_size từ data layer (chính xác hơn prop)
  const somSize = layer.som_size ?? somSizeProp;
  const isPredicting = probabilities !== undefined && bmu != null;

  const cellSize = 60;
  const hexHeight = (cellSize * Math.sqrt(3)) / 1.6;
  const spacingX = cellSize * 1;
  const spacingY = hexHeight * 0.75;
  const svgWidth = somSize * spacingX + cellSize * 3;
  const svgHeight = somSize * spacingY + cellSize - 30;
  const paddingLeft = cellSize * 2;
  const paddingTop = cellSize - 20;

  const uMatrix = layer.u_matrix;
  const dominantMap = layer.dominant_label_map;
  const distributionMap = layer.label_distribution_map;

  // ── Normalize u_matrix → [0,1] ──────────────────────────────────────────
  const { uNorm } = useMemo(() => {
    const flat = uMatrix?.flat() ?? [];
    const uMin = flat.length ? Math.min(...flat) : 0;
    const uMax = flat.length ? Math.max(...flat) : 1;
    const uNorm = (col: number, row: number) => {
      const raw = uMatrix?.[col]?.[row] ?? 0;
      return uMax > uMin ? (raw - uMin) / (uMax - uMin) : 0;
    };
    return { uNorm };
  }, [uMatrix]);

  // u=0 (cụm) → sáng, u=1 (ranh giới) → tối (chuẩn học thuật)
  const uToGray = (u: number): string => {
    const invU = 1 - u;
    const v = Math.round(30 + invU * 196);
    return `rgb(${v},${v + 5},${v + 15})`;
  };

  // ── Scatter: sample ngẫu nhiên tối đa 1000 + jitter ─────────────────────
  const scatterDots = useMemo(() => {
    if (mode !== "scatter") return [];
    const positions = layer.sample_positions ?? [];
    // Sample ngẫu nhiên tối đa 1000
    const sampled =
      positions.length <= 1000
        ? positions
        : (() => {
            const arr = [...positions];
            // Fisher-Yates shuffle với seed cố định
            const rand = seededRandom(42);
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(rand() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr.slice(0, 1000);
          })();

    return sampled.map((sp, idx) => {
      const col = sp.som_x;
      const row = sp.som_y;
      const cx = col * spacingX + (row % 2) * (spacingX / 2) + paddingLeft;
      const cy = row * spacingY + paddingTop;

      // Jitter trong phạm vi hexagon (tối đa ~30% cellSize)
      const rand = seededRandom(sp.idx * 1000 + idx);
      const angle = rand() * 2 * Math.PI;
      const radius = rand() * cellSize * 0.28;
      const jx = cx + Math.cos(angle) * radius;
      const jy = cy + Math.sin(angle) * radius;

      return { x: jx, y: jy, label: sp.label };
    });
  }, [
    mode,
    layer.sample_positions,
    spacingX,
    spacingY,
    paddingLeft,
    paddingTop,
    cellSize,
  ]);

  // ── Markers: top-3 labels mỗi neuron ────────────────────────────────────
  const markersMap = useMemo(() => {
    if (mode !== "markers") return null;
    const result: {
      [key: string]: { label: number; count: number; fontSize: number }[];
    } = {};
    for (let col = 0; col < somSize; col++) {
      for (let row = 0; row < somSize; row++) {
        const dist = distributionMap?.[col]?.[row] ?? {};
        if (Object.keys(dist).length === 0) continue;

        // Sắp xếp theo tỉ lệ giảm dần, lấy top 3
        const sorted = Object.entries(dist)
          .map(([label, ratio]) => ({ label: parseInt(label), ratio }))
          .sort((a, b) => b.ratio - a.ratio)
          .slice(0, 3);

        // Font size: label nhiều nhất = 16, ít hơn scale xuống
        const maxRatio = sorted[0]?.ratio ?? 1;
        result[`${col}-${row}`] = sorted.map(({ label, ratio }) => ({
          label,
          count: ratio,
          fontSize: Math.round(9 + (ratio / maxRatio) * 9), // 9 → 18
        }));
      }
    }
    return result;
  }, [mode, distributionMap, somSize]);

  const getHexPoints = (cx: number, cy: number) =>
    [
      `${cx},${cy - hexHeight / 2}`,
      `${cx + cellSize / 2},${cy - hexHeight / 4}`,
      `${cx + cellSize / 2},${cy + hexHeight / 4}`,
      `${cx},${cy + hexHeight / 2}`,
      `${cx - cellSize / 2},${cy + hexHeight / 4}`,
      `${cx - cellSize / 2},${cy - hexHeight / 4}`,
    ].join(" ");

  // ── Render ───────────────────────────────────────────────────────────────
  const baseCells: React.ReactNode[] = [];
  let bmuCell: React.ReactNode = null;

  for (let row = 0; row < somSize; row++) {
    for (let col = 0; col < somSize; col++) {
      const x = col * spacingX + (row % 2) * (spacingX / 2) + paddingLeft;
      const y = row * spacingY + paddingTop;
      const pts = getHexPoints(x, y);
      const uVal = uNorm(col, row);
      const isBMU = isPredicting && bmu!.som_x === col && bmu!.som_y === row;

      if (mode === "umatrix") {
        // ── Chế độ 1: U-Matrix thuần ──────────────────────────────────
        baseCells.push(
          <g key={`${col}-${row}`}>
            <polygon
              points={pts}
              fill={uToGray(uVal)}
              fillOpacity={1}
              stroke="#ffffff"
              strokeWidth="0.5"
            />
          </g>,
        );
      } else if (mode === "scatter") {
        // ── Chế độ 2: Scatter — nền xám nhạt đồng đều ────────────────
        baseCells.push(
          <g key={`${col}-${row}`}>
            <polygon
              points={pts}
              fill="#e8edf5"
              fillOpacity={1}
              stroke="gray"
              strokeWidth="0.5"
            />
          </g>,
        );
      } else {
        // ── Chế độ 3: U-Matrix + Markers ──────────────────────────────
        const markers = markersMap?.[`${col}-${row}`] ?? [];

        // Layout markers trong ô: 1 → giữa, 2 → trên/dưới, 3 → tam giác
        const offsets: { dx: number; dy: number }[] =
          markers.length === 1
            ? [{ dx: 0, dy: 0 }]
            : markers.length === 2
              ? [
                  { dx: 0, dy: -hexHeight * 0.2 },
                  { dx: 0, dy: hexHeight * 0.2 },
                ]
              : [
                  { dx: 0, dy: -hexHeight * 0.22 },
                  { dx: -cellSize * 0.22, dy: hexHeight * 0.15 },
                  { dx: cellSize * 0.22, dy: hexHeight * 0.15 },
                ];

        baseCells.push(
          <g key={`${col}-${row}`}>
            {/* Nền U-Matrix */}
            <polygon
              points={pts}
              fill={uToGray(uVal)}
              fillOpacity={1}
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            {/* Class markers */}
            {markers.map((m, i) => {
              const off = offsets[i] ?? { dx: 0, dy: 0 };
              const color = DIGIT_COLORS[m.label] ?? "#888";
              return (
                <text
                  key={i}
                  x={x + off.dx}
                  y={y + off.dy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={m.fontSize}
                  fill={color}
                  fontWeight="bold"
                  style={{
                    filter: "drop-shadow(0 0 1.5px rgba(0,0,0,0.6))",
                  }}
                >
                  {m.label}
                </text>
              );
            })}
          </g>,
        );
      }

      // ── BMU highlight — giữ cho cả 3 mode ───────────────────────────
      if (isBMU) {
        const label = dominantMap?.[col]?.[row] ?? -1;
        const isEmpty = label === -1;

        bmuCell = (
          <g key={`bmu-${col}-${row}`}>
            {/* 1. Đã xóa lớp màu nền đặc bmuFill ở đây để làm trong suốt */}

            {/* 2. Giữ nguyên Viền màu vàng bo góc */}
            <polygon
              points={pts}
              fill="none"
              stroke="#facc15"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* 3. Phủ một lớp vàng thật nhạt (opacity thấp) để đánh dấu vùng chọn, 
                   nếu bạn muốn TRONG SUỐT HOÀN TOÀN thì có thể đổi fillOpacity={0} */}
            <polygon
              points={pts}
              fill="#facc15"
              fillOpacity={0}
              stroke="none"
            />

            {/* 4. Số bên trong */}
            {!isEmpty && (
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
                fill="#1a1a1a"
                fontWeight="900"
                // Thêm drop-shadow màu trắng để chữ nổi bật trên nền U-Matrix tối hoặc chấm Scatter
                style={{
                  filter: "drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.9))",
                }}
              ></text>
            )}

            {/* Mũi tên chỉ xuống */}
            <text
              x={x}
              y={y - hexHeight / 2 - 8}
              textAnchor="middle"
              fontSize="12"
              fill="#facc15"
              fontWeight="bold"
              style={{ filter: "drop-shadow(0 0 2px #000)" }}
            >
              ▼
            </text>
          </g>
        );
      }
    }
  }

  // ── Scatter dots render sau baseCells ────────────────────────────────────
  const scatterLayer =
    mode === "scatter"
      ? scatterDots.map((dot, i) => (
          <circle
            key={`dot-${i}`}
            cx={dot.x}
            cy={dot.y}
            r={3.5}
            fill={DIGIT_COLORS[dot.label] ?? "#888"}
            fillOpacity={1}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={0.5}
          />
        ))
      : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-gray-700">
          {layer.layer_name}
        </span>
        <div className="flex items-center gap-2">
          {isPredicting && bmu && (
            <span className="text-xs font-mono bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-0.5 rounded-full">
              BMU ({bmu.som_x}, {bmu.som_y})
            </span>
          )}
          <span className="text-xs text-gray-400">
            {layer.n_samples} samples · {somSize}×{somSize}
            {mode === "scatter" &&
              ` · hiển thị ${Math.min(scatterDots.length, 1000)} chấm`}
          </span>
        </div>
      </div>
      <svg
        width="100%"
        height="340"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="bg-blue-100 rounded-lg border border-blue-200"
        preserveAspectRatio="xMidYMid meet"
      >
        {baseCells}
        {scatterLayer}
        {bmuCell}
      </svg>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function HexagonalGrid({
  layerSoms,
  somSize,
  probabilities,
  bmuPositions,
}: HexagonalGridProps) {
  const [mode, setMode] = useState<ViewMode>("umatrix");

  if (!layerSoms || layerSoms.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
        Chưa có dữ liệu SOM — hãy bắt đầu training
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ViewModeToggle mode={mode} onChange={setMode} />
      {layerSoms.map((layer, arrayIdx) => {
        // Tìm BMU: khớp layer_idx chính xác trước
        // Fallback theo arrayIdx nếu layer_idx không khớp
        // Guard: chỉ show BMU nếu bmuPositions có đủ data
        const bmuByIdx = bmuPositions?.find(
          (b) => b.layer_idx === layer.layer_idx,
        );
        const bmuByOrder =
          bmuPositions && bmuPositions.length > arrayIdx
            ? bmuPositions[arrayIdx]
            : null;
        const bmu = bmuByIdx ?? bmuByOrder ?? null;

        // Nếu tổng số bmuPositions không khớp với layerSoms → không show BMU
        // tránh trường hợp layerSoms 3 layer nhưng bmuPositions chỉ có 2
        const bmuSafe =
          bmuPositions && bmuPositions.length === layerSoms.length
            ? bmu
            : (bmuByIdx ?? null);
        return (
          <SingleLayerGrid
            key={`${layer.layer_idx}-${arrayIdx}`}
            layer={layer}
            somSize={layer.som_size ?? somSize}
            probabilities={probabilities}
            bmu={bmuSafe}
            mode={mode}
          />
        );
      })}
      <Legend mode={mode} probabilities={probabilities} />
    </div>
  );
}
