import { Compass, Home, PlusSquare, UserCircle2, Film, Search } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { hapticLight } from "../utils/capacitor";
import Avatar from "./Avatar";


const navItems = [
  { to: "/", label: "Orbit", icon: Home },
  { to: "/stalk", label: "Stalk", icon: Search },
  { to: "/drop", label: "Drop", icon: PlusSquare, isCreate: true },
  { to: "/beat", label: "Beats", icon: Film },
];


export default function MobileBottomNav() {
  const { user } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center" style={{ height: "var(--bottomnav-h)" }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => hapticLight()}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-all duration-200 active:scale-90 ${
                  item.isCreate
                    ? ""
                    : isActive
                      ? "text-[color:var(--text-primary)]"
                      : "text-[color:var(--text-muted)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.isCreate ? (
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
                      style={{
                        background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                      }}
                    >
                      <PlusSquare size={20} className="text-white" />
                    </div>
                  ) : (
                    <Icon
                      size={24}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  )}
                  {!item.isCreate && (
                    <span className="text-[10px] font-medium">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Profile tab */}
        <NavLink
          to={`/profile/${user?.id || ""}`}
          onClick={() => hapticLight()}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-all duration-200 active:scale-90 ${
              isActive ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className="rounded-full overflow-hidden transition-all"
                style={{
                  border: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                  width: 28,
                  height: 28,
                }}
              >
                {user?.profile_pic ? (
                  <img
                    src={user.profile_pic}
                    alt={user.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCircle2 size={24} />
                )}
              </div>
              <span className="text-[10px] font-medium">Aura</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
