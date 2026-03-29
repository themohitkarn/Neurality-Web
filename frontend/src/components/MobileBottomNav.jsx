import { Compass, Home, MessageCircleMore, Search, SquarePlus, UserCircle2 } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";


const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/stalk", label: "Stalk", icon: Search },
  { to: "/drop", label: "Drop", icon: SquarePlus },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/chat", label: "Chat", icon: MessageCircleMore },
];


export default function MobileBottomNav() {
  const { user } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)] bg-[rgba(253,240,246,0.92)] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-3 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-6 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-[rgba(142,13,115,0.12)] text-[color:var(--accent)]"
                    : "text-[color:var(--muted)]"
                }`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <NavLink
          to={`/profile/${user?.id || ""}`}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
              isActive ? "bg-[rgba(142,13,115,0.12)] text-[color:var(--accent)]" : "text-[color:var(--muted)]"
            }`
          }
        >
          <UserCircle2 size={18} />
          <span>Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
