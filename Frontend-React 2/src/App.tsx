import Router from "./router/router";
import { useAuth } from "./context/AuthContext.tsx";

function App() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>Đang kiểm tra phiên đăng nhập...</span>
      </div>
    );
  }
  return (
    <>
      <Router />
    </>
  );
}

export default App;
