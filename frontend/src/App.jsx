import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import MobileBottomNav from "./components/MobileBottomNav";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute, GuestRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Explore from "./pages/Explore";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Reels from "./pages/Reels";
import Settings from "./pages/Settings";
import Stalk from "./pages/Stalk";
import Signup from "./pages/Signup";
import Drop from "./pages/Drop";


function AppShell() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen pb-24 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:pb-0">
      <Navbar onLogout={logout} />
      <div className="pb-2 lg:min-w-0 lg:pb-0">
        <Outlet />
      </div>
      <MobileBottomNav />
    </div>
  );
}


export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <Signup />
          </GuestRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/drop" element={<Drop />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stalk" element={<Stalk />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
