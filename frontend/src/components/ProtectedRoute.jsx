import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";


function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel soft-ring w-full max-w-md p-8 text-center">
        <p className="font-display text-2xl text-ink">Loading Neurality</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Restoring your session and getting the feed ready.
        </p>
      </div>
    </div>
  );
}


export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}


export function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
