import Nav from "../components/Nav";
import {
  BookOpen,
  ChevronRight,
  Brain,
  Grid,
  Layers,
  Target,
} from "lucide-react";

// ── Math formula component ────────────────────────────────────────────────
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800 overflow-x-auto">
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  id,
}: {
  icon: React.ReactNode;
  title: string;
  id: string;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 text-xl font-bold text-gray-900 mt-10 mb-4 pt-4 border-t border-gray-100"
    >
      <span className="p-2 bg-black rounded-lg text-white">{icon}</span>
      {title}
    </h2>
  );
}

// ── Param row ─────────────────────────────────────────────────────────────
function ParamRow({
  name,
  type,
  desc,
  tip,
}: {
  name: string;
  type: string;
  desc: string;
  tip?: string;
}) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors bg-white">
      <div className="flex items-start justify-between gap-2 mb-1">
        <code className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {name}
        </code>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono shrink-0">
          {type}
        </span>
      </div>
      <p className="text-sm text-gray-700">{desc}</p>
      {tip && (
        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          {tip}
        </p>
      )}
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────
function StepCard({
  step,
  title,
  desc,
}: {
  step: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg shrink-0">
        {step}
      </div>
      <div>
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Guide() {
  const sections = [
    { id: "som-intro", label: "SOM là gì?" },
    { id: "algorithm", label: "Thuật toán SOM" },
    { id: "math", label: "Công thức toán học" },
    { id: "params", label: "Ý nghĩa tham số" },
    { id: "viz", label: "3 kiểu hiển thị" },
    { id: "workflow", label: "Quy trình sử dụng" },
  ];

  return (
    <>
      <Nav />
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Hero */}
          <div className="mb-10 p-8 bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl text-white">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Hướng dẫn sử dụng</h1>
            </div>
            <p className="text-gray-300 text-lg max-w-2xl">
              Tìm hiểu cách hoạt động của Self-Organizing Map, ý nghĩa các tham
              số và cách sử dụng SOM Visualizer hiệu quả nhất.
            </p>
            {/* TOC */}
            <div className="mt-5 flex flex-wrap gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm text-white transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar sticky */}
            <div className="hidden lg:block">
              <div className="sticky top-24 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">
                  Mục lục
                </p>
                <nav className="space-y-1">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="block px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                    >
                      {s.label}
                    </a>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-3 space-y-2">
              {/* ── 1. SOM là gì ── */}
              <SectionHeader
                id="som-intro"
                icon={<Brain className="w-5 h-5" />}
                title="Self-Organizing Map (SOM) là gì?"
              />
              <p className="text-gray-700 leading-relaxed">
                <strong>Self-Organizing Map</strong> (SOM) hay còn gọi là{" "}
                <em>Kohonen Map</em> là một loại mạng neural học không có giám
                sát (unsupervised learning). SOM chiếu dữ liệu nhiều chiều xuống
                một lưới 2D trong khi vẫn bảo toàn cấu trúc topo của dữ liệu
                gốc, tức là các điểm dữ liệu gần nhau trong không gian nhiều
                chiều sẽ được chiếu vào các neuron gần nhau trên lưới.
              </p>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-3">
                <p className="text-sm text-blue-800">
                  <strong>Ứng dụng:</strong> SOM được dùng để trực quan hoá
                  không gian activation của các hidden layer trong mạng neural
                  phân loại chữ số MNIST. Qua đó, bạn có thể thấy được cách mạng
                  "học" và "phân cụm" các chữ số theo từng lớp.
                </p>
              </div>

              {/* ── 2. Thuật toán ── */}
              <SectionHeader
                id="algorithm"
                icon={<Layers className="w-5 h-5" />}
                title="Các bước thuật toán SOM"
              />
              <div className="space-y-3">
                <StepCard
                  step={1}
                  title="Khởi tạo trọng số"
                  desc="Mỗi neuron trên lưới N×N được khởi tạo một vector trọng số ngẫu nhiên có cùng số chiều với dữ liệu đầu vào. Trong dự án này, chiều = số neuron trong hidden layer tương ứng."
                />
                <StepCard
                  step={2}
                  title="Chọn Best Matching Unit (BMU)"
                  desc="Với mỗi vector dữ liệu đầu vào x, tìm neuron có trọng số gần nhất (khoảng cách Euclidean nhỏ nhất). Neuron đó được gọi là BMU — Best Matching Unit."
                />
                <StepCard
                  step={3}
                  title="Cập nhật vùng lân cận (Neighborhood)"
                  desc="BMU và các neuron xung quanh nó (trong bán kính σ) đều được cập nhật để 'kéo' về phía vector đầu vào. Mức độ cập nhật giảm dần theo khoảng cách tới BMU (hàm Gaussian)."
                />
                <StepCard
                  step={4}
                  title="Giảm dần learning rate và sigma"
                  desc="Sau mỗi iteration, learning rate (α) và sigma (σ) đều giảm dần theo thời gian. Đầu tiên SOM học rộng (topological ordering), sau đó học chi tiết (convergence)."
                />
                <StepCard
                  step={5}
                  title="Lặp lại cho đến khi hội tụ"
                  desc="Lặp lại bước 2-4 với tất cả các mẫu dữ liệu cho đến khi hết số iteration. Lưới SOM dần tự tổ chức để phản ánh cấu trúc của dữ liệu."
                />
              </div>

              {/* ── 3. Công thức ── */}
              <SectionHeader
                id="math"
                icon={<Target className="w-5 h-5" />}
                title="Công thức toán học"
              />

              <p className="font-semibold text-gray-800 mt-4 mb-1">
                1. Tìm BMU
              </p>
              <Formula>BMU = argmin_i ‖x(t) − w_i(t)‖</Formula>
              <p className="text-sm text-gray-600 mb-3">
                Với <code>x(t)</code> là vector đầu vào tại thời điểm t,{" "}
                <code>w_i</code> là trọng số của neuron i. Khoảng cách dùng
                chuẩn Euclidean.
              </p>

              <p className="font-semibold text-gray-800 mt-4 mb-1">
                2. Hàm lân cận Gaussian
              </p>
              <Formula>
                h(i, BMU, t) = exp( −‖r_i − r_BMU‖² / (2σ(t)²) )
              </Formula>
              <p className="text-sm text-gray-600 mb-3">
                <code>r_i</code> và <code>r_BMU</code> là vị trí trên lưới 2D.{" "}
                <code>σ(t)</code> là bán kính lân cận giảm dần theo thời gian.
              </p>

              <p className="font-semibold text-gray-800 mt-4 mb-1">
                3. Cập nhật trọng số
              </p>
              <Formula>
                w_i(t+1) = w_i(t) + α(t) · h(i, BMU, t) · [x(t) − w_i(t)]
              </Formula>
              <p className="text-sm text-gray-600 mb-3">
                <code>α(t)</code> là learning rate giảm dần. Cả <code>α</code>{" "}
                và <code>σ</code> thường giảm tuyến tính hoặc theo hàm mũ theo
                số iteration.
              </p>

              <p className="font-semibold text-gray-800 mt-4 mb-1">
                4. U-Matrix (Unified Distance Matrix)
              </p>
              <Formula>U(i) = (1/|N_i|) · Σ_ ‖w_i − w_j‖</Formula>
              <p className="text-sm text-gray-600">
                U-Matrix thể hiện khoảng cách trung bình giữa trọng số của một
                neuron và các neuron lân cận trực tiếp. Giá trị cao (màu tối) =
                ranh giới giữa cụm, giá trị thấp (màu sáng) = trung tâm cụm.
              </p>

              {/* ── 4. Params ── */}
              <SectionHeader
                id="params"
                icon={<Grid className="w-5 h-5" />}
                title="Ý nghĩa các tham số"
              />

              <div className="mb-4">
                <p className="text-sm font-bold text-gray-500 uppercase mb-2">
                  Tham số mạng Neural
                </p>
                <div className="space-y-2">
                  <ParamRow
                    name="Hidden Layers"
                    type="VD: 128,64"
                    desc="Số neuron ở mỗi hidden layer. '128,64' nghĩa là 2 lớp: lớp 1 có 128 neuron, lớp 2 có 64 neuron."
                    tip="Nhiều neuron hơn = học tốt hơn nhưng chậm hơn. Bắt đầu với 128,64 là hợp lý."
                  />
                  <ParamRow
                    name="Epochs"
                    type="1–20"
                    desc="Số lần mạng duyệt qua toàn bộ 60,000 ảnh MNIST."
                    tip="5–8 epoch là đủ để đạt >95% accuracy với cấu hình mặc định."
                  />
                  <ParamRow
                    name="Learning Rate (α)"
                    type="0.01 | 0.001 | 0.0001"
                    desc="Tốc độ cập nhật trọng số của Adam Optimizer. Giá trị lớn = học nhanh nhưng dễ dao động."
                    tip="0.001 là lựa chọn an toàn nhất cho hầu hết trường hợp."
                  />
                  <ParamRow
                    name="Batch Size"
                    type="64–512"
                    desc="Số ảnh xử lý mỗi lần trước khi cập nhật trọng số. Batch lớn = tính toán nhanh hơn nhưng cần nhiều RAM."
                    tip="256 là cân bằng tốt giữa tốc độ và độ chính xác gradient."
                  />
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-bold text-gray-500 uppercase mb-2">
                  Tham số SOM
                </p>
                <div className="space-y-2">
                  <ParamRow
                    name="SOM Grid Size (N×N)"
                    type="3–20"
                    desc="Kích thước lưới SOM. Lưới 10×10 = 100 neuron SOM. Lưới lớn hơn = chi tiết hơn nhưng cần nhiều dữ liệu hơn."
                    tip="10×10 là lý tưởng cho 10 lớp chữ số. Dùng 12×12 nếu muốn thấy chi tiết hơn."
                  />
                  <ParamRow
                    name="SOM Update Interval"
                    type="1–5"
                    desc="Cập nhật lưới SOM sau mỗi N epoch. Interval=1 nghĩa là cập nhật sau mỗi epoch (chậm nhưng chi tiết)."
                    tip="Để ở 1 để quan sát SOM thay đổi theo từng epoch."
                  />
                  <ParamRow
                    name="Max Samples"
                    type="500–5000"
                    desc="Số mẫu dùng để train SOM (lấy từ test set). Nhiều mẫu hơn = SOM chính xác hơn nhưng chậm hơn."
                    tip="2000 mẫu là đủ để thấy cấu trúc rõ ràng."
                  />
                  <ParamRow
                    name="Tần suất cập nhật (batch)"
                    type="5–50"
                    desc="Emit socket event sau mỗi N batch để cập nhật progress bar và panel thông tin."
                    tip="20 là cân bằng tốt. Giảm xuống 5–10 nếu muốn quan sát chi tiết từng bước."
                  />
                </div>
              </div>

              {/* ── 5. Viz types ── */}
              <SectionHeader
                id="viz"
                icon={<Grid className="w-5 h-5" />}
                title="3 kiểu hiển thị lưới SOM"
              />
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {
                    title: "U-Matrix",
                    color: "from-gray-800 to-gray-600",
                    desc: "Hiển thị khoảng cách giữa các neuron lân cận. Màu tối = ranh giới cụm, màu sáng = trung tâm cụm.",
                    use: "Dùng để xác định số cụm và ranh giới giữa các chữ số.",
                    image: "/umatrix.png",
                  },
                  {
                    title: "Scatter",
                    color: "from-blue-600 to-cyan-500",
                    desc: "Hiển thị vị trí từng điểm dữ liệu trên lưới SOM với màu sắc tương ứng nhãn (0–9).",
                    use: "Dùng để xem mỗi chữ số được phân bố ở đâu trên lưới.",
                    image: "/scatter.png",
                  },
                  {
                    title: "U-Matrix + Marker",
                    color: "from-purple-600 to-pink-500",
                    desc: "Kết hợp U-Matrix với nhãn chữ số thắng nhiều nhất (top-3 BMU) ở mỗi neuron.",
                    use: "Dùng để xem vùng nào của lưới chuyên nhận dạng chữ số nào.",
                    image: "/umatrix-marker.png",
                  },
                ].map((v) => (
                  <div
                    key={v.title}
                    className="rounded-xl border border-gray-100 overflow-hidden"
                  >
                    <div
                      className={`p-4 bg-gradient-to-br ${v.color} text-white`}
                    >
                      <p className="font-bold text-base">{v.title}</p>
                    </div>
                    <div className="p-4 bg-white">
                      <p className="text-sm text-gray-700 mb-2">{v.desc}</p>
                      <p className="text-xs text-green-700 font-medium">
                        {v.use}
                      </p>
                      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
                        {v.image ? (
                          <img
                            src={v.image}
                            alt={`Minh hoạ ${v.title}`}
                            className="w-full h-50 object-cover"
                          />
                        ) : (
                          <div className="h-36 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <p className="text-xs text-gray-400">
                              [ Ảnh minh hoạ ]
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 6. Workflow ── */}
              <SectionHeader
                id="workflow"
                icon={<ChevronRight className="w-5 h-5" />}
                title="Quy trình sử dụng tối ưu"
              />
              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    title: "Đăng ký và đăng nhập",
                    desc: "Tạo tài khoản để lưu model riêng. 'Khách' chỉ có thể dùng model mặc định của hệ thống.",
                  },
                  {
                    step: 2,
                    title: "Chọn preset hoặc cấu hình thủ công",
                    desc: "Dùng Quick Test để kiểm tra nhanh (3 epoch). Dùng Balanced cho kết quả tốt. Dùng High Accuracy để đạt độ chính xác tối đa.",
                  },
                  {
                    step: 3,
                    title: "Quan sát quá trình train",
                    desc: "Xem panel 'Đang thực hiện' để biết mạng đang làm gì. Theo dõi loss giảm và accuracy tăng trên biểu đồ.",
                  },
                  {
                    step: 4,
                    title: "Phân tích lưới SOM",
                    desc: "Chuyển giữa 3 kiểu hiển thị. Quan sát cách các cụm chữ số hình thành rõ hơn theo từng epoch.",
                  },
                  {
                    step: 5,
                    title: "Dự đoán chữ số",
                    desc: "Vào trang Chuẩn đoán, vẽ chữ số hoặc upload ảnh. Chọn model muốn dùng từ dropdown, sau đó bấm Predict.",
                  },
                  {
                    step: 6,
                    title: "So sánh các model",
                    desc: "Vào trang So sánh Model, chọn 2 trong 3 model đã train để so sánh U-Matrix trực quan cạnh nhau.",
                  },
                ].map((s) => (
                  <StepCard key={s.step} {...s} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
