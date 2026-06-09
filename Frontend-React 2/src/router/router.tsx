import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext.tsx";
import Index from "../page/Index";
import Training from "../page/Training";
import Login from "../page/Login";
import Register from "../page/Register";
import Predict from "../page/Predict";
import Profile from "../page/Profile";
import Guide from "../page/Guide";
import Compare from "../page/Compare";
import Admin from "../page/Admin";

function Router() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/training" element={<Training />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/predict" element={<Predict />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </AuthProvider>
  );
}

export default Router;
