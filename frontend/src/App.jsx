import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";

import Navbar from "./components/Navbar";
import MobileBottomNav from "./components/MobileBottomNav";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute, GuestRoute } from "./components/ProtectedRoute";
import NotificationHandler from "./components/NotificationHandler";
import CallInterface from "./components/CallInterface";
import MediaViewer from "./components/MediaViewer";
import { useCall } from "./context/CallContext";
import BiometricLock from "./components/BiometricLock";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Explore from "./pages/Explore";
import Login from "./pages/Login";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Beat from "./pages/Beat";
import Settings from "./pages/Settings";
import Stalk from "./pages/Stalk";
import Signup from "./pages/Signup";
import Drop from "./pages/Drop";
import Saved from "./pages/Saved";
import Admin from "./pages/Admin";


function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isLocked, setIsLocked] = useState(user?.settings?.biometric_lock_enabled || false);
  const isChatPage = location.pathname.startsWith("/chat");
  
  const { 
    isCallInterfaceOpen, 
    setIsCallInterfaceOpen,
    activeCall,
    callStatus,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall
  } = useCall();

  return (
    <>
      <AnimatePresence>
        {isLocked && <BiometricLock onUnlock={() => setIsLocked(false)} />}
      </AnimatePresence>
      <div
        className={`min-h-screen min-h-[100dvh] ${!isChatPage ? "lg:grid lg:grid-cols-[240px_minmax(0,1fr)]" : "flex flex-col"} ${isLocked ? "blur-xl grayscale opacity-50 pointer-events-none" : ""}`}
        style={{ background: "var(--bg)" }}
      >
        {!isChatPage && <Navbar onLogout={logout} />}
        <main className={`relative min-w-0 pb-0 lg:pb-0 ${isChatPage ? "flex-1 h-full" : ""}`}>
          <Outlet />
        </main>
        <NotificationHandler />
        <MediaViewer />
        <CallInterface 
          isOpen={isCallInterfaceOpen}
          onClose={() => setIsCallInterfaceOpen(false)}
          callData={activeCall || {}}
          status={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAnswer={acceptCall}
          onReject={rejectCall}
          onHangup={endCall}
        />
        {!isChatPage && <MobileBottomNav />}
      </div>
    </>
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
          <Route path="/chat" element={<Chat />}>
            <Route path=":conversationId" element={<Chat />} />
            <Route path=":conversationId/details" element={<Chat />} />
          </Route>
          <Route path="/explore" element={<Explore />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/drop" element={<Drop />} />
          <Route path="/beat" element={<Beat />} />
          <Route path="/reels" element={<Navigate to="/beat" replace />} />
          <Route path="/settings" element={<Settings />}>
            <Route path=":category" element={<Settings />} />
          </Route>
          <Route path="/stalk" element={<Stalk />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
