import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import PartnerSite from "./pages/PartnerSite";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <div>Carregando...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      {/* Site público */}
      <Route path="/" element={<PartnerSite />} />
      <Route path="/register" element={<Register />} />

      {/* Área logada */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;