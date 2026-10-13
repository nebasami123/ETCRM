import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/use-auth";
import { LoginPage } from "./features/auth/pages/login-page";
import { ProtectedRoute } from "./routes/protected-route";
import { AdminRoutes } from "./routes/admin-routes";
import { SalesRoutes } from "./routes/sales-routes";
import { SalesAdminRoutes } from "./routes/sales-admin-routes";

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin" : user.role === "SALES_ADMIN" ? "/sales-admin" : user.salesType === "EXTERNAL" ? "/sales/lead-log" : "/sales"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales-admin/*"
        element={
          <ProtectedRoute role="SALES_ADMIN">
            <SalesAdminRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/*"
        element={
          <ProtectedRoute role="SALES">
            <SalesRoutes />
          </ProtectedRoute>
        }
      />
      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
