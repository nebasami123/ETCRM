import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import type { ChildrenProps, Role } from "../types";

export function ProtectedRoute({ children, role }: ChildrenProps & { role?: Role }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/sales"} replace />;

  return children;
}
