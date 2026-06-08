import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";


const NAV = [
  { label: "Dashboard",   path: "/dashboard",   icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", section: "Main" },
  { label: "Inventory",   path: "/inventory",   icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", section: "Main" },
  { label: "Campaigns",   path: "/campaigns",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", section: "Main" },
  { label: "Advertisers", path: "/advertisers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", section: "Clients" },
  { label: "Vendors",     path: "/vendors",     icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", section: "Clients" },
  { label: "Activities",  path: "/activities",  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", section: "Execution" },
  { label: "Reports",     path: "/reports",     icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", section: "Execution" },
];

const SECTIONS = ["Main", "Clients", "Execution"];

function NavIcon({ d }) {
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {d.split(" M").map((segment, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? segment : "M" + segment} />
      ))}
    </svg>
  );
}

export default function AppShell({ children, user = {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const initials = (user.displayName || user.email || "?")
    .split(/[\s@]/).filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join("");

  const handleSignOut = () => {
    localStorage.removeItem("tq_user");
    navigate("/employeelogin");
  };

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname.startsWith("/dashboard");
    return location.pathname.startsWith(path);
  };

  const dashPath = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
    ? "/dashboard/admin" : "/dashboard/employee";

  const resolvedPath = (path) => path === "/dashboard" ? dashPath : path;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out"
        style={{
          width: collapsed ? 64 : 220,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b" style={{ borderColor: "var(--border)", minHeight: 64 }}>
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl font-syne font-black text-white text-xs"
            style={{ width: 36, height: 36, background: "linear-gradient(135deg,#2563EB,#DC143C)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}
          >
            tq
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none gap-0.5 overflow-hidden">
              <span className="font-syne font-extrabold text-[0.95rem] whitespace-nowrap">
                <span style={{ color: "#2563EB" }}>traq</span><span style={{ color: "#DC143C" }}>OOH</span>
              </span>
              <span className="text-[0.42rem] font-bold uppercase tracking-widest" style={{ color: "var(--gray2)" }}>
                by <span style={{ color: "#2563EB" }}>BRAND</span><span style={{ color: "#DC143C" }}>SCULPT</span>
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
          {SECTIONS.map(section => (
            <React.Fragment key={section}>
              {!collapsed && (
                <p className="text-[0.58rem] font-bold uppercase tracking-widest px-2 pt-3 pb-1" style={{ color: "var(--gray3)" }}>
                  {section}
                </p>
              )}
              {NAV.filter(n => n.section === section).map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={resolvedPath(item.path)}
                    title={collapsed ? item.label : ""}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 group"
                    style={{
                      color: active ? "#fff" : "var(--gray)",
                      background: active ? "rgba(37,99,235,0.15)" : "transparent",
                      border: active ? "1px solid rgba(37,99,235,0.2)" : "1px solid transparent",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ color: active ? "#2563EB" : "inherit" }}>
                      <NavIcon d={item.icon} />
                    </span>
                    {!collapsed && (
                      <span className="text-[0.8rem] font-medium whitespace-nowrap">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="border-t p-2 flex flex-col gap-1" style={{ borderColor: "var(--border)" }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center w-full py-1.5 rounded-lg transition-all"
            style={{ color: "var(--gray2)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>

          {/* User button */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(u => !u)}
              className="flex items-center gap-2 w-full p-2 rounded-xl transition-all"
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
                style={{ width: 30, height: 30, background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
              >
                {initials}
              </div>
              {!collapsed && (
                <div className="text-left overflow-hidden">
                  <div className="text-[0.76rem] font-semibold truncate text-white">{user.displayName || user.email?.split("@")[0]}</div>
                  <div className="text-[0.6rem] uppercase tracking-wider" style={{ color: "#3B82F6" }}>{user.role || "Employee"}</div>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div
                className="absolute bottom-full left-0 mb-1 w-44 rounded-xl p-1 z-50"
                style={{ background: "#0D1428", border: "1px solid var(--border)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
              >
                <Link to="/account" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/5 text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  My Account
                </Link>
                <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-all hover:bg-red-500/10 text-red-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-6"
          style={{ height: 64, background: "var(--nav)", borderBottom: "1px solid var(--border)" }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 max-w-xs px-3 py-2 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gray2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="bg-transparent outline-none text-sm flex-1 min-w-0"
              style={{ color: "#fff" }}
              placeholder="Search campaigns, sites..."
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* New campaign */}
            <Link
              to="/campaigns"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110"
              style={{ background: "var(--blue)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
              New Campaign
            </Link>

            {/* Notifications */}
            <button
              className="relative flex items-center justify-center rounded-xl transition-all"
              style={{ width: 36, height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--gray)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--red)", border: "1.5px solid var(--nav)" }}
              />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "var(--bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
