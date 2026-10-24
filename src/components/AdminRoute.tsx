import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ADMIN_TOKEN_KEY } from "../config";

function AdminRoute({ children }: { children: ReactNode }) {
  if (!localStorage.getItem(ADMIN_TOKEN_KEY)) return <Navigate to="/" replace />;
  return children;
}

export default AdminRoute;
