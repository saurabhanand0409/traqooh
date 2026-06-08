import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

/**
 * Unified dark-premium login component.
 * Props:
 *   defaultTab   - "employee" | "admin" | "advertiser"  (default: "employee")
 *   allowedRoles - array of role strings to restrict login, e.g. ["EMPLOYEE"]
 *                  empty = accept any role
 */
export default function LoginForm({ defaultTab = "employee", allowedRoles = [] }) {
  const [tab, setTab] = useState(defaultTab === "admin" ? "admin" : "employee");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Email is required.");
    if (!pwd.trim())  return setErr("Password is required.");
    try {
      setErr("");
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Invalid credentials");
      }
      const data = await res.json();
      const role = (data.role || "").toUpperCase();
      let normalizedRole = role;
      if (role === "MEDIA_OWNER" || role === "TEAM_MEMBER") normalizedRole = "EMPLOYEE";

      if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toUpperCase()).includes(normalizedRole)) {
        throw new Error("This login is not for your account type. Please use the correct login.");
      }

      // Additional tab-based check: employee tab shouldn't log in admins & vice versa
      if (tab === "employee" && (normalizedRole === "ADMIN" || role === "SUPER_ADMIN")) {
        throw new Error("Admin accounts must use the Admin tab.");
      }
      if (tab === "admin" && normalizedRole === "EMPLOYEE") {
        throw new Error("Employee accounts must use the Employee tab.");
      }

      localStorage.setItem("tq_user", JSON.stringify({
        userId: data.userId,
        email: data.email,
        role: normalizedRole,
        token: data.token,
        gstId: data.gstRegistrationId,
        companyId: data.companyId,
        advertiserId: data.advertiserId,
        displayName: data.displayName || data.email?.split("@")[0],
      }));

      if (normalizedRole === "ADMIN" || role === "SUPER_ADMIN") navigate("/dashboard/admin");
      else if (normalizedRole === "ADVERTISER") navigate("/dashboard/advertiser");
      else navigate("/dashboard/employee");

    } catch (error) {
      setErr(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden relative"
      style={{ background: "var(--bg)" }}
    >
      {/* Gradient orbs background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full blur-[140px] opacity-30"
          style={{ width: 600, height: 600, left: "-15%", top: "-20%", background: "#2563EB" }}
        />
        <div
          className="absolute rounded-full blur-[140px] opacity-20"
          style={{ width: 500, height: 500, right: "-10%", bottom: "-10%", background: "#DC143C" }}
        />
        {/* Mock dashboard grid lines for depth */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lgrid)" />
        </svg>
      </div>

      {/* Blurred mock-dashboard preview behind the card */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 blur-sm scale-110"
        style={{ filter: "blur(4px) saturate(0.5)" }}
      >
        <div className="flex gap-4 w-full max-w-5xl px-10 pt-10">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-1 h-24 rounded-2xl glass" />
          ))}
        </div>
      </div>

      {/* Card */}
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[420px] mx-4 rounded-2xl p-8"
        style={{
          background: "rgba(13,20,40,0.9)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="flex items-center justify-center rounded-2xl font-syne font-black text-white mb-3"
            style={{
              width: 56, height: 56, fontSize: "1.1rem",
              background: "linear-gradient(135deg,#2563EB,#DC143C)",
              boxShadow: "0 8px 32px rgba(37,99,235,0.4)",
            }}
          >
            tq
          </div>
          <div className="text-center leading-none">
            <div className="font-syne font-extrabold text-xl">
              <span style={{ color: "#2563EB" }}>traq</span><span style={{ color: "#DC143C" }}>OOH</span>
            </div>
            <div className="text-[0.5rem] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#4B5563" }}>
              by <span style={{ color: "#2563EB" }}>BRAND</span><span style={{ color: "#DC143C" }}>SCULPT</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 mb-6 gap-1"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {[{ key: "employee", label: "Employee" }, { key: "admin", label: "Admin" }].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setErr(""); }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
              style={tab === t.key ? {
                background: "linear-gradient(135deg,#2563EB,#1d50c8)",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              } : { color: "#6B7280" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-center text-sm mb-6" style={{ color: "#9CA3AF" }}>
          Sign in to your {tab === "admin" ? "admin" : "employee"} account
        </p>

        {/* Error */}
        {err && (
          <div
            className="mb-4 px-4 py-2.5 rounded-xl text-sm"
            style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}
          >
            {err}
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#6B7280" }}>Email</label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#4B5563" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="tq-input pl-10"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#6B7280" }}>Password</label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#4B5563" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <rect x="5" y="11" width="14" height="8" rx="2" strokeLinecap="round" /><path strokeLinecap="round" d="M8 11V8a4 4 0 118 0v3" />
            </svg>
            <input
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="••••••••"
              className="tq-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg"
              style={{ color: "#6B7280" }}
            >
              {showPwd ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg,#2563EB,#DC143C)",
            boxShadow: loading ? "none" : "0 8px 24px rgba(37,99,235,0.35)",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 12px 32px rgba(37,99,235,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = loading ? "none" : "0 8px 24px rgba(37,99,235,0.35)"; }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Signing in…
            </span>
          ) : "Sign In"}
        </button>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs" style={{ color: "#4B5563" }}>
            Advertiser?{" "}
            <Link to="/login" className="font-semibold transition-colors" style={{ color: "#3B82F6" }}
              onMouseEnter={e => e.currentTarget.style.color = "#93C5FD"}
              onMouseLeave={e => e.currentTarget.style.color = "#3B82F6"}>
              Access your campaign here
            </Link>
          </p>
          <p className="text-xs">
            <Link to="/" className="transition-colors" style={{ color: "#4B5563" }}
              onMouseEnter={e => e.currentTarget.style.color = "#9CA3AF"}
              onMouseLeave={e => e.currentTarget.style.color = "#4B5563"}>
              ← Back to home
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
