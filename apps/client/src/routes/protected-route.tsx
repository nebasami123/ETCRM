import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import type { Role } from "../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: Role;
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-xs font-semibold text-muted">
        Validating session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/sales"} replace />;
  }

  return <>{children}</>;
}
export default ProtectedRoute;
