import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useLang } from "./i18n";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Measurements from "./pages/Measurements";
import Orders from "./pages/Orders";
import Appointments from "./pages/Appointments";
import Catalog from "./pages/Catalog";

function ProtectedRoute({ children }) {
  const { t } = useLang();
  const { token, loading } = useAuth();
  if (loading) return <div className="loading-text" style={{ padding: 40 }}>{t("Loading…")}</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute>
            <CustomerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/measurements"
        element={
          <ProtectedRoute>
            <Measurements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <Catalog />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
