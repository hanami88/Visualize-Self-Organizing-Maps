import eventlet
eventlet.monkey_patch()

print("1.1 Bắt đầu import thư viện chuẩn...")
import os, json, base64, threading, pickle
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from functools import wraps
from flask import abort
print("1.2 Bắt đầu import numpy...")
import numpy as np

print("1.3 Bắt đầu import PIL...")
from PIL import Image

print("2. Bắt đầu import Flask & Web...")
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

print("3. Bắt đầu import DB & JWT...")
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    set_refresh_cookies, jwt_required, get_jwt_identity,
    verify_jwt_in_request, decode_token
)

print("4. Bắt đầu import PyTorch... (Khu vực nguy hiểm nhất)")
import torch
print("   -> Import torch thành công!")
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

print("5. Bắt đầu import MiniSom...")
from minisom import MiniSom

print(">>> ĐÃ IMPORT XONG TẤT CẢ!")

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = "som-viz-secret"

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'default-fallback-secret')
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=15)
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = False

db = SQLAlchemy(app)
jwt = JWTManager(app)

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app,
     supports_credentials=True,
     origins=[FRONTEND_URL],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"])
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
)

# ── Thư mục lưu model ──────────────────────────────────────────────────────
# ── Thư mục lưu model ──────────────────────────────────────────────────────
MODEL_DIR = Path("./saved_models")
GUEST_DIR = MODEL_DIR / "guest"
DEFAULT_DIR = MODEL_DIR / "default"
PRESET_DIRS = {
    "quick":    MODEL_DIR / "preset_quick",
    "balanced": MODEL_DIR / "preset_balanced",
    "high":     MODEL_DIR / "preset_high",
}
PRESET_CONFIGS = {
    "quick":    {"epochs": 3,  "hidden_sizes": [64],        "lr": 0.001, "batch_size": 256, "som_size": 8,  "max_samples": 1000, "label": "Quick Test"},
    "balanced": {"epochs": 5,  "hidden_sizes": [128, 64],   "lr": 0.001, "batch_size": 256, "som_size": 10, "max_samples": 2000, "label": "Balanced"},
    "high":     {"epochs": 10, "hidden_sizes": [256, 128, 64], "lr": 0.0005, "batch_size": 128, "som_size": 12, "max_samples": 3000, "label": "High Accuracy"},
}
MODEL_DIR.mkdir(exist_ok=True)
DEFAULT_DIR.mkdir(exist_ok=True)
for _p in PRESET_DIRS.values():
    _p.mkdir(exist_ok=True)


# ── Database Models ────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'user' | 'admin'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    models = db.relationship('UserModel', backref='owner', lazy=True, cascade='all, delete-orphan')


class UserModel(db.Model):
    """Metadata cho model của từng user — file thực lưu trên disk. Tối đa 3 model/user."""
    __tablename__ = 'user_models'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    model_name = db.Column(db.String(100), nullable=False, default='Model của tôi')
    slot = db.Column(db.Integer, nullable=False, default=1)  # 1, 2, hoặc 3
    model_path = db.Column(db.String(500), nullable=False)
    som_path = db.Column(db.String(500), nullable=False)
    layer_soms_path = db.Column(db.String(500), nullable=False)
    accuracy = db.Column(db.Float, nullable=True)
    loss = db.Column(db.Float, nullable=True)
    epochs_trained = db.Column(db.Integer, default=0)
    hidden_sizes = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

print("[Init] Bắt đầu khởi tạo Database...")
with app.app_context():
    db.create_all()

    # ── Migration: thêm cột mới nếu chưa có (chạy an toàn nhiều lần) ──────
    with db.engine.connect() as conn:
        from sqlalchemy import text, inspect
        inspector = inspect(db.engine)

        # Thêm role vào users nếu chưa có
        user_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'role' not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'"))
            conn.commit()
            print("[Migration] Đã thêm cột 'role' vào bảng users")

        # Thêm model_name + slot vào user_models nếu chưa có
        model_cols = [c['name'] for c in inspector.get_columns('user_models')]
        if 'model_name' not in model_cols:
            conn.execute(text("ALTER TABLE user_models ADD COLUMN model_name VARCHAR(100) NOT NULL DEFAULT 'Model của tôi'"))
            conn.commit()
            print("[Migration] Đã thêm cột 'model_name' vào bảng user_models")
        if 'slot' not in model_cols:
            conn.execute(text("ALTER TABLE user_models ADD COLUMN slot INT NOT NULL DEFAULT 1"))
            conn.commit()
            print("[Migration] Đã thêm cột 'slot' vào bảng user_models")

    # ── Seed admin mặc định nếu chưa có ────────────────────────────────────
    admin = User.query.filter_by(email='admin@som.local').first()
    if not admin:
        db.session.add(User(
            name='Admin',
            email='admin@som.local',
            password=generate_password_hash('123456789'),
            role='admin',
        ))
        db.session.commit()
        print("[Init] Đã tạo tài khoản admin mặc định (admin@som.local / 123456789)")

print("[Init] Database OK!")


# ── Helper: lấy thư mục của user ──────────────────────────────────────────
def get_user_dir(user_id: int) -> Path:
    d = MODEL_DIR / f"user_{user_id}"
    d.mkdir(exist_ok=True)
    return d


def get_user_model_paths(user_id: int, slot: int = 1):
    d = get_user_dir(user_id)
    suffix = f"_slot{slot}"
    return (
        d / f"mnist_net{suffix}.pt",
        d / f"som_list{suffix}.pkl",
        d / f"layer_soms{suffix}.json",
    )


def get_preset_paths(preset_key: str):
    """Trả về (model_path, som_path, layer_soms_path, meta_path) cho preset."""
    d = PRESET_DIRS[preset_key]
    return (
        d / "mnist_net.pt",
        d / "som_list.pkl",
        d / "layer_soms.json",
        d / "mnist_meta.json",
    )


def get_guest_paths():
    return (
        GUEST_DIR / "mnist_net.pt",
        GUEST_DIR / "som_list.pkl",
        GUEST_DIR / "layer_soms.json",
    )


def get_default_paths():
    """Model hệ thống — chỉ đọc, không bao giờ ghi đè."""
    return (
        DEFAULT_DIR / "mnist_net.pt",
        DEFAULT_DIR / "som_list.pkl",
        DEFAULT_DIR / "layer_soms.json",
    )


# ── Neural Network ─────────────────────────────────────────────────────────
class MNISTNet(nn.Module):
    def __init__(self, hidden_sizes: list):
        super().__init__()
        layers = []
        in_size = 784
        for h in hidden_sizes:
            layers += [nn.Linear(in_size, h), nn.ReLU()]
            in_size = h
        layers.append(nn.Linear(in_size, 10))
        self.net = nn.Sequential(*layers)
        self.hidden_sizes = hidden_sizes

    def forward(self, x):
        return self.net(x.view(-1, 784))

    def get_hidden_modules(self):
        relu_modules = []
        for module in self.net:
            if isinstance(module, nn.ReLU):
                relu_modules.append(module)
        return relu_modules


# ── Save / Load helpers ────────────────────────────────────────────────────
def save_model_to_path(model: MNISTNet, model_path: Path, meta_path: Path = None):
    torch.save(model.state_dict(), model_path)
    if meta_path:
        meta_path.write_text(json.dumps({"hidden_sizes": model.hidden_sizes}))


def load_model_from_path(model_path: Path, meta_path: Path = None, hidden_sizes: list = None) -> "MNISTNet | None":
    if not model_path.exists():
        return None
    if hidden_sizes is None:
        if meta_path and meta_path.exists():
            hidden_sizes = json.loads(meta_path.read_text()).get("hidden_sizes", [128, 64])
        else:
            return None
    model = MNISTNet(hidden_sizes)
    model.load_state_dict(torch.load(model_path, map_location="cpu", weights_only=True))
    model.eval()
    return model


def save_soms_to_path(som_list: list, som_path: Path):
    with open(som_path, "wb") as f:
        pickle.dump(som_list, f)


def load_soms_from_path(som_path: Path) -> list:
    if not som_path.exists():
        return []
    with open(som_path, "rb") as f:
        return pickle.load(f)


def save_layer_soms_to_path(layer_soms: list, path: Path):
    path.write_text(json.dumps(layer_soms))


def load_layer_soms_from_path(path: Path) -> list:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


# ── Migrate legacy model → default/ (chạy 1 lần) ─────────────────────────
LEGACY_MODEL_PATH = MODEL_DIR / "mnist_net.pt"
LEGACY_META_PATH = MODEL_DIR / "mnist_meta.json"
LEGACY_SOM_PATH = MODEL_DIR / "som_list.pkl"
LEGACY_LAYER_SOMS_PATH = MODEL_DIR / "layer_soms.json"

if LEGACY_MODEL_PATH.exists() and not (DEFAULT_DIR / "mnist_net.pt").exists():
    import shutil

    shutil.copy2(LEGACY_MODEL_PATH, DEFAULT_DIR / "mnist_net.pt")
    if LEGACY_META_PATH.exists():
        shutil.copy2(LEGACY_META_PATH, DEFAULT_DIR / "mnist_meta.json")
    if LEGACY_SOM_PATH.exists():
        shutil.copy2(LEGACY_SOM_PATH, DEFAULT_DIR / "som_list.pkl")
    if LEGACY_LAYER_SOMS_PATH.exists():
        shutil.copy2(LEGACY_LAYER_SOMS_PATH, DEFAULT_DIR / "layer_soms.json")
    print("[server] Migrated legacy model → default/")

# ── Global training state ──────────────────────────────────────────────────
_training_states: dict = {}
_state_lock = threading.Lock()

# ── Default model: load 1 lần khi server start, KHÔNG BAO GIỜ thay đổi ───
_default_model: "MNISTNet | None" = None
_default_som_objects: list = []
_default_layer_soms: list = []
_default_layer_names: list = []


def get_scope(user_id=None) -> str:
    return f"user_{user_id}" if user_id else "guest"


def _make_empty_state() -> dict:
    return {
        "running": False,
        "stop_flag": False,
        "epoch": 0,
        "total_epochs": 0,
        "loss": 0.0,
        "accuracy": 0.0,
        "layer_soms": [],
        "layer_names": [],
        "model": None,
        "som_objects": [],
        "_loaded": False,
    }


def get_state(scope: str) -> dict:
    with _state_lock:
        if scope not in _training_states:
            _training_states[scope] = _make_empty_state()
        return _training_states[scope]


# ── Load default model khi server start ────────────────────────────────────
def _preload_default():
    global _default_model, _default_som_objects, _default_layer_soms, _default_layer_names
    default_model_path, default_som_path, default_layer_soms_path = get_default_paths()
    default_meta_path = DEFAULT_DIR / "mnist_meta.json"

    model = load_model_from_path(default_model_path, default_meta_path)
    if model:
        _default_model = model
        print("[server] Default model loaded (read-only)")
    else:
        print("[server] WARNING: No default model found in saved_models/default/")

    soms = load_soms_from_path(default_som_path)
    print(f"[preload] default_som_path={default_som_path}, exists={default_som_path.exists()}, count={len(soms)}")
    if soms:
        _default_som_objects = soms

    layer_soms = load_layer_soms_from_path(default_layer_soms_path)
    if layer_soms:
        _default_layer_soms = layer_soms
        _default_layer_names = [
            ls.get("layer_name", f"Hidden {i + 1}") for i, ls in enumerate(layer_soms)
        ]
        print(f"[server] Default layer_soms loaded: {len(layer_soms)} layers")

# ── Pre-download MNIST dataset khi server start ────────────────────────────
print("[Init] Kiểm tra và download MNIST dataset...")
try:
    _mnist_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    datasets.MNIST("./data", train=True, download=True, transform=_mnist_transform)
    datasets.MNIST("./data", train=False, download=True, transform=_mnist_transform)
    print("[Init] MNIST dataset OK!")
except Exception as e:
    print(f"[Init] MNIST download warning: {e}")

print("[Init] Bắt đầu load model mặc định...")
with app.app_context():
    _preload_default()
print("[Init] Load model OK, chuẩn bị chạy server!")


# ── Helper: lấy user_id từ JWT token string (dùng được cả trong HTTP lẫn socket) ──
def _decode_user_id_from_token(token: str) -> "int | None":
    """
    Decode JWT token thủ công — dùng cho socket context không có request HTTP.
    Trả về user_id (int) hoặc None nếu token không hợp lệ / hết hạn.
    """
    if not token:
        return None
    try:
        with app.app_context():
            decoded = decode_token(token)
            identity = decoded.get("sub")
            return int(identity) if identity else None
    except Exception as e:
        print(f"[auth] Token decode failed: {e}")
        return None


# ── Helper: lấy current_user_id nếu có token (optional JWT, chỉ dùng trong HTTP request) ──
def get_optional_user_id():
    """
    Chỉ dùng trong HTTP request context (Flask route handlers).
    Với socket handlers, dùng _decode_user_id_from_token() thay thế.
    """
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except Exception:
        return None
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = User.query.get(user_id)
            if not user or user.role != 'admin':
                return jsonify({"error": "Chỉ admin mới có quyền thực hiện thao tác này"}), 403
        except Exception:
            return jsonify({"error": "Token không hợp lệ"}), 401
        return fn(*args, **kwargs)
    return wrapper

# ── Load state của user từ disk ────────────────────────────────────────────
def ensure_user_state_loaded(user_id: int, slot: int = None):
    """
    Load model/SOM của user từ disk.
    - slot=None → load slot mới nhất (updated_at lớn nhất)
    - slot=1/2/3 → load slot cụ thể
    """
    scope = get_scope(user_id)
    state = get_state(scope)

    # Nếu đã load và không yêu cầu slot cụ thể → skip
    if state.get("_loaded") and slot is None:
        return

    with app.app_context():
        if slot is None:
            record = UserModel.query.filter_by(user_id=user_id)\
                        .order_by(UserModel.updated_at.desc()).first()
            slot = record.slot if record else 1

    model_path, som_path, layer_soms_path = get_user_model_paths(user_id, slot)
    meta_path = get_user_dir(user_id) / f"mnist_meta_slot{slot}.json"

    model = load_model_from_path(model_path, meta_path)
    if model:
        state["model"]       = model
        state["som_objects"] = load_soms_from_path(som_path)
        layer_soms           = load_layer_soms_from_path(layer_soms_path)
        state["layer_soms"]  = layer_soms
        state["layer_names"] = [
            ls.get("layer_name", f"Hidden {i+1}") for i, ls in enumerate(layer_soms)
        ]
        state["active_slot"] = slot
        print(f"[server] Loaded model slot={slot} for user_{user_id}")
    else:
        state["model"]       = None
        state["som_objects"] = []
        state["layer_soms"]  = []
        state["layer_names"] = []
        state["active_slot"] = None
        print(f"[server] user_{user_id} slot={slot} not found → will use default")

    state["_loaded"] = True


def get_predict_resources(user_id=None):
    """
    Trả về (model, som_objects, layer_names, layer_soms) để predict.

    Ưu tiên:
      1. User đã đăng nhập VÀ đã train model riêng → dùng model của user
      2. Còn lại (guest hoặc user chưa train) → dùng _default_model (model hệ thống)
    """
    if user_id:
        ensure_user_state_loaded(user_id)
        state = get_state(get_scope(user_id))
        if state["model"] is not None:
            return (
                state["model"],
                state["som_objects"],
                state["layer_names"],
                state["layer_soms"],
            )

    return (
        _default_model,
        _default_som_objects,
        _default_layer_names,
        _default_layer_soms,
    )


# ==============================================================================
# AUTH ENDPOINTS
# ==============================================================================
@app.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "Không tìm thấy người dùng"}), 404

    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({"error": "Vui lòng nhập đủ thông tin"}), 400
    if not check_password_hash(user.password, current_password):
        return jsonify({"error": "Mật khẩu hiện tại không chính xác"}), 401
    if check_password_hash(user.password, new_password):
        return jsonify({"error": "Mật khẩu mới không được trùng với mật khẩu cũ"}), 400

    user.password = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "Đổi mật khẩu thành công!"}), 200


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"error": "Vui lòng cung cấp đủ tên, email và mật khẩu"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email này đã được sử dụng"}), 409

    new_user = User(name=name, email=email, password=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Đăng ký thành công"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"error": "Email hoặc mật khẩu không chính xác"}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    ensure_user_state_loaded(user.id)

    response = jsonify({
        "message": "Đăng nhập thành công",
        "access_token": access_token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    })
    set_refresh_cookies(response, refresh_token)
    return response, 200


@app.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    new_access_token = create_access_token(identity=current_user_id)
    ensure_user_state_loaded(user.id)

    return jsonify({
        "access_token": new_access_token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }), 200


@app.route("/logout", methods=["POST"])
def logout():
    response = jsonify({"message": "Đăng xuất thành công"})
    response.set_cookie('refresh_token_cookie', '', expires=0)
    return response, 200


@app.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user.id, "name": user.name, "email": user.email, "role": user.role}), 200


# ==============================================================================
# SOM CORE FUNCTIONS
# ==============================================================================
INFER_TRANSFORM = transforms.Compose([
    transforms.Grayscale(),
    transforms.Resize((28, 28)),
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])


def get_activations_all_layers(model: MNISTNet, dataloader: DataLoader, max_samples: int = 2000):
    relu_modules = model.get_hidden_modules()
    n_layers = len(relu_modules)
    layer_buffers = [[] for _ in range(n_layers)]
    hooks = []

    def make_hook(layer_idx):
        def hook_fn(module, input, output):
            layer_buffers[layer_idx].append(output.detach().cpu().numpy())

        return hook_fn

    for i, module in enumerate(relu_modules):
        hooks.append(module.register_forward_hook(make_hook(i)))

    label_list = []
    sample_count = 0
    model.eval()
    with torch.no_grad():
        for bx, by in dataloader:
            if sample_count >= max_samples:
                break
            remaining = max_samples - sample_count
            bx = bx[:remaining]
            by = by[:remaining]
            model(bx)
            label_list.append(by.numpy())
            sample_count += len(by)

    for h in hooks:
        h.remove()

    return [np.vstack(buf) for buf in layer_buffers], np.concatenate(label_list)


def get_activation_single(model: MNISTNet, tensor: torch.Tensor) -> list:
    relu_modules = model.get_hidden_modules()
    buffers = [None] * len(relu_modules)
    hooks = []

    def make_hook(idx):
        def hook_fn(module, input, output):
            buffers[idx] = output.detach().cpu().numpy()[0]

        return hook_fn

    for i, module in enumerate(relu_modules):
        hooks.append(module.register_forward_hook(make_hook(i)))

    model.eval()
    with torch.no_grad():
        model(tensor)

    for h in hooks:
        h.remove()
    return buffers


def train_som_on_activations(activations, labels, som_size=10, num_iteration=1000):
    n_samples, n_dims = activations.shape
    som = MiniSom(som_size, som_size, n_dims, sigma=1.5, learning_rate=0.5,
                  neighborhood_function="gaussian", random_seed=42)
    som.random_weights_init(activations)
    som.train(activations, num_iteration=num_iteration, verbose=False)

    sample_positions = []
    for i, vec in enumerate(activations):
        bmu = som.winner(vec)
        sample_positions.append({"idx": int(i), "label": int(labels[i]),
                                 "som_x": int(bmu[0]), "som_y": int(bmu[1])})

    u_matrix = som.distance_map().tolist()
    activation_map = np.zeros((som_size, som_size))
    for vec in activations:
        activation_map[som.winner(vec)] += 1
    mx = activation_map.max()
    activation_map = (activation_map / mx if mx > 0 else activation_map).tolist()

    label_map = [[[] for _ in range(som_size)] for _ in range(som_size)]
    for sp in sample_positions:
        label_map[sp["som_x"]][sp["som_y"]].append(sp["label"])

    dominant_label_map = []
    label_distribution_map = []
    for row in label_map:
        dominant_row = []
        distribution_row = []
        for cell in row:
            if cell:
                dominant_row.append(int(np.bincount(cell).argmax()))
                total = len(cell)
                counts = np.bincount(cell, minlength=10)
                dist = {str(d): round(float(counts[d]) / total, 4)
                        for d in range(10) if counts[d] > 0}
                distribution_row.append(dist)
            else:
                dominant_row.append(-1)
                distribution_row.append({})
        dominant_label_map.append(dominant_row)
        label_distribution_map.append(distribution_row)

    return som, {
        "som_size": som_size, "n_samples": n_samples, "n_dims": n_dims,
        "sample_positions": sample_positions, "u_matrix": u_matrix,
        "activation_map": activation_map,
        "dominant_label_map": dominant_label_map,
        "label_distribution_map": label_distribution_map,
    }

# Các message giải thích phase training để emit real-time
_PHASE_MESSAGES = [
    "Khởi tạo trọng số ngẫu nhiên cho mạng neural...",
    "Bắt đầu forward pass — tính toán output của từng lớp...",
    "Tính toán Cross-Entropy Loss giữa output và nhãn thật...",
    "Backpropagation — lan truyền gradient ngược về các lớp...",
    "Adam Optimizer đang cập nhật trọng số (lr={lr})...",
    "Đang điều chỉnh learning rate theo momentum...",
    "BMU (Best Matching Unit) đang được xác định cho từng mẫu...",
    "Cập nhật vùng lân cận Gaussian quanh BMU...",
    "SOM đang co lại neighborhood radius theo thời gian...",
    "Tính toán U-Matrix — khoảng cách giữa các neuron lân cận...",
    "Mapping dữ liệu lên lưới SOM — tìm vị trí BMU cho mỗi điểm...",
    "Cập nhật dominant label map cho từng ô SOM...",
]



# ==============================================================================
# API ENDPOINTS
# ==============================================================================
@app.route("/status")
def get_status():
    user_id = get_optional_user_id()
    scope = get_scope(user_id)
    if user_id:
        ensure_user_state_loaded(user_id)
    state = get_state(scope)

    if user_id:
        model_path, som_path, _ = get_user_model_paths(user_id)
    else:
        model_path = GUEST_DIR / "mnist_net.pt"
        som_path = GUEST_DIR / "som_list.pkl"

    has_results = len(state["layer_soms"]) > 0
    if not has_results and not user_id:
        has_results = len(_default_layer_soms) > 0

    return jsonify({
        "running": state["running"],
        "epoch": state["epoch"],
        "total_epochs": state["total_epochs"],
        "loss": state["loss"],
        "accuracy": state["accuracy"],
        "layer_names": state["layer_names"] if state["layer_names"] else _default_layer_names,
        "has_results": has_results,
        "model_saved": model_path.exists(),
        "som_saved": som_path.exists(),
    })


@app.route("/results")
def get_results():
    user_id = get_optional_user_id()
    preset  = request.args.get("preset", None)   # "quick" | "balanced" | "high"
    slot    = request.args.get("slot",   None)   # "1" | "2" | "3"
    if slot:
        slot = int(slot)

    # ── Preset được chỉ định → trả về layer_soms của preset đó ──────────
    if preset and preset in PRESET_DIRS:
        _, _, p_layer, _ = get_preset_paths(preset)
        layer_soms = load_layer_soms_from_path(p_layer)
        layer_names = [ls.get("layer_name", "") for ls in layer_soms]
        return jsonify({
            "layer_soms": layer_soms,
            "layer_names": layer_names,
            "epoch": 0, "loss": 0.0, "accuracy": 0.0,
            "is_default": False,
            "is_preset": preset,
        })

    # ── Slot cụ thể của user ─────────────────────────────────────────────
    if user_id and slot:
        ensure_user_state_loaded(user_id, slot)
        state = get_state(get_scope(user_id))
        if state["layer_soms"]:
            return jsonify({
                "layer_soms": state["layer_soms"],
                "layer_names": state["layer_names"],
                "epoch": state["epoch"],
                "loss": state["loss"],
                "accuracy": state["accuracy"],
                "is_default": False,
            })

    # ── User đã train (slot mới nhất) ────────────────────────────────────
    if user_id:
        ensure_user_state_loaded(user_id)
        state = get_state(get_scope(user_id))
        if state["layer_soms"]:
            return jsonify({
                "layer_soms": state["layer_soms"],
                "layer_names": state["layer_names"],
                "epoch": state["epoch"],
                "loss": state["loss"],
                "accuracy": state["accuracy"],
                "is_default": False,
            })

    # ── Fallback: default model ──────────────────────────────────────────
    return jsonify({
        "layer_soms": _default_layer_soms,
        "layer_names": _default_layer_names,
        "epoch": 0, "loss": 0.0, "accuracy": 0.0,
        "is_default": True,
    })


@app.route("/stop", methods=["POST"])
def stop_training():
    user_id = get_optional_user_id()
    scope = get_scope(user_id)
    state = get_state(scope)
    state["stop_flag"] = True
    return jsonify({"message": "Stop signal sent"})

# Các message giải thích phase training để emit real-time
_PHASE_MESSAGES = [
    "Khởi tạo trọng số ngẫu nhiên cho mạng neural...",
    "Bắt đầu forward pass — tính toán output của từng lớp...",
    "Tính toán Cross-Entropy Loss giữa output và nhãn thật...",
    "Backpropagation — lan truyền gradient ngược về các lớp...",
    "Adam Optimizer đang cập nhật trọng số (lr={lr})...",
    "Đang điều chỉnh learning rate theo momentum...",
    "BMU (Best Matching Unit) đang được xác định cho từng mẫu...",
    "Cập nhật vùng lân cận Gaussian quanh BMU...",
    "SOM đang co lại neighborhood radius theo thời gian...",
    "Tính toán U-Matrix — khoảng cách giữa các neuron lân cận...",
    "Mapping dữ liệu lên lưới SOM — tìm vị trí BMU cho mỗi điểm...",
    "Cập nhật dominant label map cho từng ô SOM...",
]


def _training_thread(scope, user_id, slot, model_name, epochs, hidden_sizes, lr,
                     batch_size, som_interval, som_size, max_samples, emit_every_n_batches=20):
    state = get_state(scope)
    state.update({
        "running": True, "stop_flag": False,
        "epoch": 0, "total_epochs": epochs,
        "layer_soms": [], "loss": 0.0, "accuracy": 0.0,
        "som_objects": [], "current_slot": slot,
    })
    state["layer_names"] = [f"Hidden {i + 1} ({h} neurons)" for i, h in enumerate(hidden_sizes)]

    socketio.emit("training_started", {
        "scope": scope,
        "slot": slot,
        "model_name": model_name,
        "config": {
            "epochs": epochs, "hidden_sizes": hidden_sizes,
            "lr": lr, "batch_size": batch_size,
            "som_size": som_size, "max_samples": max_samples,
        },
    })

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    train_ds = datasets.MNIST("./data", train=True, download=True, transform=transform)
    test_ds  = datasets.MNIST("./data", train=False, download=True, transform=transform)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  num_workers=0)
    test_loader  = DataLoader(test_ds,  batch_size=256,        shuffle=False, num_workers=0)
    som_loader   = DataLoader(test_ds,  batch_size=256,        shuffle=False, num_workers=0)

    model = MNISTNet(hidden_sizes)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    total_batches = len(train_loader)
    phase_idx = 0

    for epoch in range(1, epochs + 1):
        if state["stop_flag"]:
            break

        model.train()
        total_loss = 0.0
        batch_losses = []

        for batch_idx, (bx, by) in enumerate(train_loader):
            if state["stop_flag"]:
                break

            optimizer.zero_grad()
            loss = criterion(model(bx), by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            batch_losses.append(loss.item())

            # ── Emit mỗi N batch ──────────────────────────────────────────
            if (batch_idx + 1) % emit_every_n_batches == 0:
                progress_in_epoch = (batch_idx + 1) / total_batches
                current_loss = sum(batch_losses) / len(batch_losses)
                batch_losses = []

                # Chọn phase message phù hợp với giai đoạn
                msg_template = _PHASE_MESSAGES[phase_idx % len(_PHASE_MESSAGES)]
                phase_msg = msg_template.replace("{lr}", str(lr))
                phase_idx += 1

                # BMU message động — chọn neuron ngẫu nhiên để minh hoạ
                bmu_x, bmu_y = np.random.randint(0, som_size, size=2)
                if "BMU" in phase_msg or phase_idx % 4 == 0:
                    phase_msg = f"BMU neuron ({bmu_x},{bmu_y}) đang cập nhật vùng lân cận Gaussian..."

                socketio.emit("batch_update", {
                    "scope": scope,
                    "epoch": epoch,
                    "total_epochs": epochs,
                    "batch": batch_idx + 1,
                    "total_batches": total_batches,
                    "progress_in_epoch": round(progress_in_epoch, 3),
                    "batch_loss": round(current_loss, 4),
                    "phase_message": phase_msg,
                })

        # ── Cuối epoch: tính accuracy ──────────────────────────────────────
        model.eval()
        correct = total = 0
        with torch.no_grad():
            for bx, by in test_loader:
                pred = model(bx).argmax(dim=1)
                correct += (pred == by).sum().item()
                total += by.size(0)

        state["epoch"] = epoch
        state["loss"]  = round(total_loss / len(train_loader), 4)
        state["accuracy"] = round(correct / total, 4)

        # ── Train SOM ──────────────────────────────────────────────────────
        if epoch % som_interval == 0 or epoch == epochs:
            socketio.emit("batch_update", {
                "scope": scope,
                "epoch": epoch,
                "total_epochs": epochs,
                "batch": total_batches,
                "total_batches": total_batches,
                "progress_in_epoch": 1.0,
                "batch_loss": state["loss"],
                "phase_message": f"Epoch {epoch} hoàn thành! Đang huấn luyện lưới SOM {som_size}×{som_size}...",
            })

            all_activations, all_labels = get_activations_all_layers(
                model, som_loader, max_samples=max_samples)

            layer_soms = []
            new_som_objects = []
            for i, (activations, layer_name) in enumerate(
                    zip(all_activations, state["layer_names"])):
                som_obj, result = train_som_on_activations(
                    activations, all_labels, som_size=som_size,
                    num_iteration=max(500, max_samples // 2))
                result.update({"layer_idx": i, "layer_name": layer_name})
                layer_soms.append(result)
                new_som_objects.append(som_obj)

            state["layer_soms"]  = layer_soms
            state["som_objects"] = new_som_objects

        socketio.emit("epoch_update", {
            "scope": scope,
            "epoch": state["epoch"],
            "total_epochs": epochs,
            "loss": state["loss"],
            "accuracy": state["accuracy"],
            "layer_soms": state["layer_soms"],
            "slot": slot,
            "model_name": model_name,
        })

    # ── Lưu model vào slot ────────────────────────────────────────────────
    state["model"] = model
    model_path, som_path, layer_soms_path = get_user_model_paths(user_id, slot)
    meta_path = get_user_dir(user_id) / f"mnist_meta_slot{slot}.json"

    save_model_to_path(model, model_path, meta_path)
    save_soms_to_path(state["som_objects"], som_path)
    save_layer_soms_to_path(state["layer_soms"], layer_soms_path)

    with app.app_context():
        existing = UserModel.query.filter_by(user_id=user_id, slot=slot).first()
        if existing:
            existing.model_name     = model_name
            existing.accuracy       = state["accuracy"]
            existing.loss           = state["loss"]
            existing.epochs_trained = state["epoch"]
            existing.hidden_sizes   = json.dumps(hidden_sizes)
            existing.model_path     = str(model_path)
            existing.som_path       = str(som_path)
            existing.layer_soms_path = str(layer_soms_path)
            existing.updated_at     = datetime.utcnow()
        else:
            db.session.add(UserModel(
                user_id=user_id,
                slot=slot,
                model_name=model_name,
                model_path=str(model_path),
                som_path=str(som_path),
                layer_soms_path=str(layer_soms_path),
                accuracy=state["accuracy"],
                loss=state["loss"],
                epochs_trained=state["epoch"],
                hidden_sizes=json.dumps(hidden_sizes),
            ))
        db.session.commit()

    print(f"[server] Saved model slot={slot} for user_{user_id} → {model_path}")

    state["_loaded"] = False
    ensure_user_state_loaded(user_id)
    state["running"] = False

    socketio.emit("training_complete", {
        "scope": scope,
        "epoch": state["epoch"],
        "accuracy": state["accuracy"],
        "slot": slot,
        "model_name": model_name,
        "model_saved": True,
        "som_saved": True,
    })

def _preset_training_thread(scope, preset_key, epochs, hidden_sizes, lr,
                             batch_size, som_size, max_samples):
    """Train model cho preset (chỉ admin gọi được)."""
    state = get_state(scope)
    state.update({
        "running": True, "stop_flag": False,
        "epoch": 0, "total_epochs": epochs,
        "layer_soms": [], "loss": 0.0, "accuracy": 0.0,
        "som_objects": [],
    })
    state["layer_names"] = [f"Hidden {i+1} ({h})" for i, h in enumerate(hidden_sizes)]

    socketio.emit("preset_training_started", {"preset": preset_key, "scope": scope})

    transform = transforms.Compose([
        transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,)),
    ])
    train_ds = datasets.MNIST("./data", train=True,  download=True, transform=transform)
    test_ds  = datasets.MNIST("./data", train=False, download=True, transform=transform)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  num_workers=0)
    test_loader  = DataLoader(test_ds,  batch_size=256,        shuffle=False, num_workers=0)
    som_loader   = DataLoader(test_ds,  batch_size=256,        shuffle=False, num_workers=0)

    model = MNISTNet(hidden_sizes)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(1, epochs + 1):
        if state["stop_flag"]:
            break
        model.train()
        total_loss = 0.0
        for bx, by in train_loader:
            if state["stop_flag"]:
                break
            optimizer.zero_grad()
            loss = criterion(model(bx), by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        correct = total = 0
        with torch.no_grad():
            for bx, by in test_loader:
                pred = model(bx).argmax(dim=1)
                correct += (pred == by).sum().item()
                total   += by.size(0)

        state["epoch"]    = epoch
        state["loss"]     = round(total_loss / len(train_loader), 4)
        state["accuracy"] = round(correct / total, 4)

        all_activations, all_labels = get_activations_all_layers(
            model, som_loader, max_samples=max_samples)
        layer_soms, new_soms = [], []
        for i, (acts, lname) in enumerate(zip(all_activations, state["layer_names"])):
            som_obj, result = train_som_on_activations(
                acts, all_labels, som_size=som_size,
                num_iteration=max(500, max_samples // 2))
            result.update({"layer_idx": i, "layer_name": lname})
            layer_soms.append(result)
            new_soms.append(som_obj)

        state["layer_soms"]  = layer_soms
        state["som_objects"] = new_soms

        socketio.emit("preset_epoch_update", {
            "preset": preset_key, "scope": scope,
            "epoch": epoch, "total_epochs": epochs,
            "loss": state["loss"], "accuracy": state["accuracy"],
        })

    # Lưu preset model
        # Lưu preset model
        p_model, p_som, p_layer, p_meta = get_preset_paths(preset_key)
        # Lưu model weights
        torch.save(model.state_dict(), p_model)
        # Lưu meta kèm accuracy/loss
        p_meta.write_text(json.dumps({
            "hidden_sizes": hidden_sizes,
            "accuracy": state["accuracy"],
            "loss": state["loss"],
            "epochs_trained": state["epoch"],
        }))
        save_soms_to_path(state["som_objects"], p_som)
        save_layer_soms_to_path(state["layer_soms"], p_layer)

    state["running"] = False
    socketio.emit("preset_training_complete", {
        "preset": preset_key,
        "accuracy": state["accuracy"],
        "epoch": state["epoch"],
    })
    print(f"[server] Preset '{preset_key}' trained & saved → {p_model}")

@app.route("/train", methods=["POST"])
@jwt_required()
def start_training():
    user_id = int(get_jwt_identity())

    # Kiểm tra slot hợp lệ
    cfg = request.get_json() or {}
    slot = int(cfg.get("slot", 0))  # 0 = tạo mới, 1-3 = ghi đè slot cụ thể
    model_name = cfg.get("model_name", f"Model {datetime.utcnow().strftime('%d/%m %H:%M')}")

    # Kiểm tra số lượng model hiện có
    existing_models = UserModel.query.filter_by(user_id=user_id).order_by(UserModel.created_at).all()

    if slot == 0:
        if len(existing_models) >= 3:
            # Đã đủ 3 model → báo FE cần chọn slot để ghi đè
            return jsonify({
                "error": "MAX_MODELS_REACHED",
                "message": "Bạn đã có 3 model. Vui lòng chọn model muốn ghi đè.",
                "models": [
                    {
                        "id": m.id,
                        "slot": m.slot,
                        "model_name": m.model_name,
                        "accuracy": m.accuracy,
                        "epochs_trained": m.epochs_trained,
                        "created_at": m.created_at.isoformat(),
                    }
                    for m in existing_models
                ]
            }), 409
        # Tạo slot mới
        slot = len(existing_models) + 1
    else:
        # Ghi đè slot được chỉ định — validate slot hợp lệ
        if slot not in [1, 2, 3]:
            return jsonify({"error": "Slot không hợp lệ"}), 400

    scope = get_scope(user_id)
    state = get_state(scope)
    if state["running"]:
        return jsonify({"error": "Already training"}), 400

    epochs = int(cfg.get("epochs", 5))
    hidden_sizes = cfg.get("hidden_sizes", [128, 64])
    lr = float(cfg.get("lr", 0.001))
    batch_size = int(cfg.get("batch_size", 256))
    som_interval = int(cfg.get("som_interval", 1))
    som_size = int(cfg.get("som_size", 10))
    max_samples = int(cfg.get("max_samples", 2000))
    emit_every_n_batches = int(cfg.get("emit_every_n_batches", 20))

    threading.Thread(
        target=_training_thread,
        args=(scope, user_id, slot, model_name, epochs, hidden_sizes, lr,
              batch_size, som_interval, som_size, max_samples, emit_every_n_batches),
        daemon=True,
    ).start()
    return jsonify({"message": "Training started", "slot": slot, "model_name": model_name})


@app.route("/predict", methods=["POST"])
def predict():
    user_id = get_optional_user_id()
    data_json = request.get_json(silent=True) or {}
    preset = data_json.get("preset", None)  # "quick" | "balanced" | "high" | None
    slot = data_json.get("slot", None)  # 1 | 2 | 3 | None
    if slot:
        slot = int(slot)

    print(f"[predict] user_id={user_id}, preset={preset}, slot={slot}")
    resources = get_predict_resources(user_id, slot, preset)

    # Kiểm tra xem kết quả có bị None không
    if resources is None:
        print(f"[predict] get_predict_resources returned None! user_id={user_id}, preset={preset}, slot={slot}")
        return jsonify({"error": "Không tìm thấy tài nguyên dự đoán (model/som)"}), 404

    # Nếu có dữ liệu, lúc này mới unpack an toàn
    model, som_objects, layer_names, layer_soms = resources

    if user_id and model is not None and model is not _default_model:
        print(f"[predict] using PERSONAL model of user_{user_id}")
    else:
        print(f"[predict] using DEFAULT model (user_id={user_id})")

    if model is None:
        return jsonify({
            "error": "Chưa có model. Admin cần upload model mặc định vào saved_models/default/"
        }), 400

    try:
        if request.is_json:
            data = request.get_json()
            img_b64 = data.get("image", "")
            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            img = Image.open(BytesIO(base64.b64decode(img_b64)))
        else:
            file = request.files.get("file")
            if file is None:
                return jsonify({"error": "Không tìm thấy ảnh"}), 400
            img = Image.open(file.stream)

        tensor = INFER_TRANSFORM(img).unsqueeze(0)

        model.eval()
        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            pred = int(probs.argmax().item())
            conf = float(probs.max().item())

        layer_activations = get_activation_single(model, tensor)

        som_positions = []
        for i, (act_vec, som_obj) in enumerate(zip(layer_activations, som_objects)):
            if som_obj is not None:
                bmu = som_obj.winner(act_vec)
                # Lấy layer_idx từ layer_soms nếu có để đảm bảo khớp với FE
                actual_layer_idx = layer_soms[i].get("layer_idx", i) if i < len(layer_soms) else i
                som_positions.append({
                    "layer_idx": actual_layer_idx,
                    "layer_name": layer_names[i] if i < len(layer_names) else f"Hidden {i + 1}",
                    "som_x": int(bmu[0]),
                    "som_y": int(bmu[1]),
                    "activation": act_vec.tolist(),
                })

        print(
            f"[predict] som_positions count: {len(som_positions)}, layer_soms count: {len(layer_soms)}, som_objects count: {len(som_objects)}")
        for sp in som_positions:
            print(f"  → layer_idx={sp['layer_idx']}, bmu=({sp['som_x']},{sp['som_y']})")
        return jsonify({
            "prediction": pred,
            "confidence": round(conf, 4),
            "probabilities": {str(i): round(float(p), 4) for i, p in enumerate(probs)},
            "som_positions": som_positions,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# TRAINING THREAD
# ==============================================================================
def get_predict_resources(user_id=None, slot: int = None, preset: str = None):
    # Preset được chỉ định
    if preset and preset in PRESET_DIRS:
        p_model, p_som, p_layer, p_meta = get_preset_paths(preset)
        m = load_model_from_path(p_model, p_meta)
        if m:
            soms = load_soms_from_path(p_som)
            layer_soms = load_layer_soms_from_path(p_layer)
            print(
                f"[predict] preset={preset}, som_objects={len(soms)}, layer_soms={len(layer_soms)}, p_som_exists={p_som.exists()}")
            return m, soms, \
                [ls.get("layer_name", "") for ls in layer_soms], \
                layer_soms

    # Model của user
    if user_id:
        ensure_user_state_loaded(user_id, slot)
        state = get_state(get_scope(user_id))
        if state["model"] is not None:
            return state["model"], state["som_objects"], \
                   state["layer_names"], state["layer_soms"]

        print(f"[predict] using default, som_objects={len(_default_som_objects)}, layer_soms={len(_default_layer_soms)}")
        return _default_model, _default_som_objects, _default_layer_names, _default_layer_soms



# ==============================================================================
# SOCKET
# ==============================================================================
@socketio.on("connect")
def on_connect():
    """
    Đọc token từ socket handshake auth (ưu tiên) hoặc query string (fallback).
    Frontend gửi: io(URL, { auth: { token: accessToken } })
    Flask-SocketIO expose qua: request.environ.get("HTTP_...") không phải chuẩn,
    nên ta dùng socketio's built-in environ: request.args hoặc environ trực tiếp.

    Với flask-socketio, handshake auth data không được expose trực tiếp qua
    request.args — ta nhận qua environ key "HTTP_AUTHORIZATION" hoặc
    dùng event data. Cách đơn giản nhất: client truyền token qua query param.
    Xem comment trong on_connect_with_auth() bên dưới.
    """
    # ── Đọc token từ nhiều nguồn theo thứ tự ưu tiên ──────────────────────
    # 1. Socket.IO auth object (client: io(url, { auth: { token } }))
    #    → Flask-SocketIO expose qua environ["HTTP_AUTHORIZATION"] khi dùng
    #      custom transport, nhưng không phải lúc nào cũng có.
    #    → Cách đáng tin cậy nhất: lấy từ request.environ trực tiếp.
    token = None

    # Cách 1: lấy từ environ (Flask-SocketIO đặt auth vào đây)
    environ = getattr(request, "environ", {})

    # Cách 2: query string ?token=... (fallback nếu auth object không hoạt động)
    token = request.args.get("token")

    # Cách 3: Authorization header (Bearer ...)
    if not token:
        auth_header = environ.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    # Decode token thủ công (không dùng verify_jwt_in_request vì không có HTTP context chuẩn)
    user_id = _decode_user_id_from_token(token) if token else None

    scope = get_scope(user_id)
    if user_id:
        ensure_user_state_loaded(user_id)
        print(f"[socket] connect user_{user_id}")
    else:
        print("[socket] connect guest")

    state = get_state(scope)

    # Xác định layer_soms để emit init
    if user_id and state["layer_soms"]:
        # User đã train → hiển thị model riêng
        display_layer_soms = state["layer_soms"]
        display_layer_names = state["layer_names"]
    else:
        # User chưa train hoặc guest → hiển thị default
        display_layer_soms = _default_layer_soms
        display_layer_names = _default_layer_names

    if user_id:
        model_path, som_path, _ = get_user_model_paths(user_id)
    else:
        model_path = GUEST_DIR / "mnist_net.pt"
        som_path = GUEST_DIR / "som_list.pkl"

    emit("init", {
        "status": {
            "running": state["running"],
            "epoch": state["epoch"],
            "total_epochs": state["total_epochs"],
            "loss": state["loss"],
            "accuracy": state["accuracy"],
            "layer_names": display_layer_names,
            "model_saved": model_path.exists(),
            "som_saved": som_path.exists(),
            # Flag để frontend biết đang dùng model nào
            "is_default": not (user_id and state["layer_soms"]),
        },
        "results": display_layer_soms,
    })

# ==============================================================================
# ADMIN API
# ==============================================================================

@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([{
        "id": u.id, "name": u.name, "email": u.email,
        "role": u.role, "created_at": u.created_at.isoformat(),
        "model_count": len(u.models),
    } for u in users])


@app.route("/admin/users/<int:uid>", methods=["PUT"])
@admin_required
def admin_update_user(uid):
    user = User.query.get_or_404(uid)
    data = request.get_json() or {}
    if "name" in data:
        user.name = data["name"]
    if "email" in data:
        if User.query.filter(User.email == data["email"], User.id != uid).first():
            return jsonify({"error": "Email đã được sử dụng"}), 409
        user.email = data["email"]
    if "role" in data and data["role"] in ("user", "admin"):
        user.role = data["role"]
    if "password" in data and data["password"]:
        user.password = generate_password_hash(data["password"])
    db.session.commit()
    return jsonify({"message": "Cập nhật thành công"})


@app.route("/admin/users", methods=["POST"])
@admin_required
def admin_create_user():
    data = request.get_json() or {}
    name  = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role  = data.get("role", "user")
    if not name or not email or not password:
        return jsonify({"error": "Thiếu thông tin bắt buộc"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email đã được sử dụng"}), 409
    u = User(name=name, email=email,
             password=generate_password_hash(password), role=role)
    db.session.add(u)
    db.session.commit()
    return jsonify({"message": "Tạo người dùng thành công", "id": u.id}), 201


@app.route("/admin/users/<int:uid>", methods=["DELETE"])
@admin_required
def admin_delete_user(uid):
    user = User.query.get_or_404(uid)
    # Xoá file model trên disk
    user_dir = MODEL_DIR / f"user_{uid}"
    if user_dir.exists():
        import shutil
        shutil.rmtree(user_dir)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Đã xoá người dùng"})


@app.route("/admin/users/<int:uid>/models", methods=["GET"])
@admin_required
def admin_list_user_models(uid):
    models = UserModel.query.filter_by(user_id=uid)\
                .order_by(UserModel.slot).all()
    return jsonify([{
        "id": m.id, "slot": m.slot, "model_name": m.model_name,
        "accuracy": m.accuracy, "loss": m.loss,
        "epochs_trained": m.epochs_trained,
        "hidden_sizes": json.loads(m.hidden_sizes) if m.hidden_sizes else [],
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    } for m in models])


@app.route("/admin/users/<int:uid>/models/<int:mid>", methods=["DELETE"])
@admin_required
def admin_delete_user_model(uid, mid):
    m = UserModel.query.filter_by(id=mid, user_id=uid).first_or_404()
    for path_str in [m.model_path, m.som_path, m.layer_soms_path]:
        p = Path(path_str)
        if p.exists():
            p.unlink()
    db.session.delete(m)
    db.session.commit()
    # Reset loaded state
    scope = get_scope(uid)
    if scope in _training_states:
        _training_states[scope]["_loaded"] = False
    return jsonify({"message": "Đã xoá model"})


@app.route("/admin/presets", methods=["GET"])
@admin_required
def admin_list_presets():
    result = []
    for key, cfg in PRESET_CONFIGS.items():
        p_model, _, p_layer, _ = get_preset_paths(key)
        layer_soms = load_layer_soms_from_path(p_layer)
        result.append({
            "key": key,
            "label": cfg["label"],
            "config": cfg,
            "trained": p_model.exists(),
            "layers": len(layer_soms),
        })
    return jsonify(result)



@app.route("/admin/presets/<string:preset_key>/train", methods=["POST"])
def admin_train_preset(preset_key):
    if preset_key not in PRESET_CONFIGS:
        return jsonify({"error": "Preset không tồn tại"}), 404

    scope = f"preset_{preset_key}"
    state = get_state(scope)
    if state["running"]:
        return jsonify({"error": "Preset này đang được train"}), 400

    cfg = PRESET_CONFIGS[preset_key]
    # Cho phép admin override config
    body = request.get_json() or {}
    epochs       = int(body.get("epochs",       cfg["epochs"]))
    hidden_sizes = body.get("hidden_sizes",      cfg["hidden_sizes"])
    lr           = float(body.get("lr",          cfg["lr"]))
    batch_size   = int(body.get("batch_size",    cfg["batch_size"]))
    som_size     = int(body.get("som_size",      cfg["som_size"]))
    max_samples  = int(body.get("max_samples",   cfg["max_samples"]))

    threading.Thread(
        target=_preset_training_thread,
        args=(scope, preset_key, epochs, hidden_sizes, lr,
              batch_size, som_size, max_samples),
        daemon=True,
    ).start()
    return jsonify({"message": f"Bắt đầu train preset '{cfg['label']}'", "preset": preset_key})


@app.route("/admin/presets/<string:preset_key>/status", methods=["GET"])
@admin_required
def admin_preset_status(preset_key):
    scope = f"preset_{preset_key}"
    state = get_state(scope)
    return jsonify({
        "preset": preset_key,
        "running": state["running"],
        "epoch": state["epoch"],
        "total_epochs": state["total_epochs"],
        "loss": state["loss"],
        "accuracy": state["accuracy"],
    })


@app.route("/api/models/my", methods=["GET"])
@jwt_required()
def get_my_models():
    """Lấy danh sách model của user hiện tại."""
    user_id = int(get_jwt_identity())
    models = UserModel.query.filter_by(user_id=user_id)\
                .order_by(UserModel.slot).all()
    return jsonify([{
        "id": m.id, "slot": m.slot, "model_name": m.model_name,
        "accuracy": m.accuracy, "loss": m.loss,
        "epochs_trained": m.epochs_trained,
        "hidden_sizes": json.loads(m.hidden_sizes) if m.hidden_sizes else [],
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    } for m in models])


@app.route("/api/models/<int:mid>/layer_soms", methods=["GET"])
@jwt_required()
def get_model_layer_soms(mid):
    """Lấy layer_soms của 1 model cụ thể để dùng trong trang Compare."""
    user_id = int(get_jwt_identity())
    m = UserModel.query.filter_by(id=mid, user_id=user_id).first_or_404()
    layer_soms = load_layer_soms_from_path(Path(m.layer_soms_path))
    return jsonify({
        "model_id": mid,
        "slot": m.slot,
        "model_name": m.model_name,
        "accuracy": m.accuracy,
        "loss": m.loss,
        "epochs_trained": m.epochs_trained,
        "layer_soms": layer_soms,
    })


@app.route("/api/presets/info", methods=["GET"])
def get_presets_info():
    """Public route — trả về thông tin các preset đã train"""
    result = []
    for key, cfg in PRESET_CONFIGS.items():
        p_model, _, p_layer, p_meta = get_preset_paths(key)
        layer_soms = load_layer_soms_from_path(p_layer)

        accuracy = None
        loss = None
        epochs_trained = cfg["epochs"]
        hidden_sizes = cfg["hidden_sizes"]

        if p_meta.exists():
            try:
                meta = json.loads(p_meta.read_text())
                accuracy = meta.get("accuracy", None)
                loss = meta.get("loss", None)
                epochs_trained = meta.get("epochs_trained", cfg["epochs"])
                hidden_sizes = meta.get("hidden_sizes", cfg["hidden_sizes"])
            except Exception:
                pass

        result.append({
            "key": key,
            "label": cfg["label"],
            "trained": p_model.exists(),
            "accuracy": accuracy,
            "loss": loss,
            "epochs_trained": epochs_trained,
            "hidden_sizes": hidden_sizes,
            "layers": len(layer_soms),
        })
    return jsonify(result)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=False,
        use_reloader=False,
    )