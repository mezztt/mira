import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { TOKEN_KEY } from "../config";

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!localStorage.getItem(TOKEN_KEY)) return <Navigate to="/" replace />;
  return children;
}

export default ProtectedRoute;
