import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-[9999]">

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6">
        
        {/* N Logo */}
        <div 
          className="w-24 h-24 rounded-3xl border bg-white/5  flex items-center justify-center shadow-2xl transition-all duration-300"
          
        >
          <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent, #e11d48)" />
                <stop offset="100%" stopColor="var(--gradient-end, #f97316)" />
              </linearGradient>
              <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path 
              d="M30 75V25L70 75V25" 
              stroke="url(#logo-grad)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              filter="url(#logo-glow)"
            />
            <circle cx="30" cy="25" r="5" fill="var(--accent, #e11d48)" />
            <circle cx="70" cy="75" r="5" fill="var(--accent, #e11d48)" />
          </svg>
        </div>

        {/* Brand */}
        <h1 className="mt-6 text-white text-3xl font-black tracking-tight drop-shadow-md">
          Neurality
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-white/60 text-sm tracking-wide text-center max-w-xs font-medium">
          syncing your universe...
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