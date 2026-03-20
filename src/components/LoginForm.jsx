import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut as authSignOut, dashboardRoute } from "../utils/auth";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

/**
 * Shared login form — used by Employee, Admin, and Advertiser login pages.
 * Props:
 *   title        - heading text
 *   subtitle     - subheading text
 *   accentColor  - tailwind bg class for button & icon, e.g. "bg-[#2f6bff]"
 *   hoverColor   - tailwind hover class, e.g. "hover:bg-[#2759d6]"
 *   shadowColor  - tailwind shadow class, e.g. "shadow-[#2f6bff55]"
 *   iconSvg      - JSX for the icon inside the logo box
 *   allowedRoles - array of role strings that may use this login, e.g. ["EMPLOYEE","ADMIN"]
 *                  empty array = accept any role
 *   bottomLinks  - JSX for bottom links area
 */
export default function LoginForm({ title, subtitle, accentColor, hoverColor, shadowColor, iconSvg, allowedRoles = [], bottomLinks }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Email is required.");
    if (!pwd.trim()) return setErr("Password is required.");
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
      // Normalize role
      let normalizedRole = role;
      if (role === "MEDIA_OWNER" || role === "TEAM_MEMBER") normalizedRole = "EMPLOYEE";

      // Check if this login page accepts this role
      if (allowedRoles.length > 0) {
        const normalized_allowed = allowedRoles.map(r => r.toUpperCase());
        if (!normalized_allowed.includes(normalizedRole)) {
          throw new Error(`This login is not for your account type. Please use the correct login page.`);
        }
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

      // Route based on role
      if (normalizedRole === "ADMIN" || role === "SUPER_ADMIN") navigate("/dashboard/admin");
      else if (normalizedRole === "ADVERTISER") navigate("/dashboard/advertiser");
      else navigate("/dashboard/employee");

    } catch (error) {
      setErr(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const eyeSvg = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute w-[520px] h-[520px] -left-32 -top-20 rounded-full bg-[#0f2a7a] opacity-40 blur-[140px]" />
        <div className="absolute w-[520px] h-[520px] -right-24 top-10 rounded-full bg-[#2b0c8f] opacity-40 blur-[140px]" />
      </div>
      <div className="relative max-w-4xl mx-auto flex justify-center">
        <form onSubmit={submit} className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex justify-center mb-6">
            <div className={`h-16 w-16 rounded-2xl ${accentColor} grid place-items-center shadow-lg ${shadowColor}`}>
              {iconSvg}
            </div>
          </div>
          <h1 className="text-center text-3xl font-extrabold mb-2">{title}</h1>
          <p className="text-center text-white/80 mb-6">{subtitle}</p>

          {!!err && (
            <div className="mb-4 rounded-xl bg-red-500/15 border border-red-400/40 px-4 py-2 text-red-100 text-sm">{err}</div>
          )}

          <label className="block text-sm font-semibold mb-2">Email Address</label>
          <div className="relative mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" />
                <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email"
              className="w-full rounded-2xl bg-white/10 border border-white/20 pl-12 pr-4 py-3 outline-none placeholder-white/70 focus:border-white/40" />
          </div>

          <label className="block text-sm font-semibold mb-2">Password</label>
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <input type={show ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Enter your password"
              className="w-full rounded-2xl bg-white/10 border border-white/20 pl-12 pr-12 py-3 outline-none placeholder-white/70 focus:border-white/40" />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10" aria-label={show ? "Hide password" : "Show password"}>
              {eyeSvg}
            </button>
          </div>

          <button disabled={loading}
            className={`w-full rounded-2xl ${accentColor} ${hoverColor} py-3 font-semibold shadow-lg transition mt-2 disabled:opacity-60`}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-center mt-8 text-white/85">
            {bottomLinks}
          </div>
        </form>
      </div>
    </main>
  );
}
