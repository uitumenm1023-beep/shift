import { Navigate } from "react-router-dom";
import { getUser } from "../auth";

export default function ProtectedRoute({ role, children }) {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/worker"} replace />;
  }

  return children;
}