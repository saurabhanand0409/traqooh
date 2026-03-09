import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase());

export default function AdvertiserLogin() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Email is required.");
    if (!pwd.trim()) return setErr("Password is required.");
    try {
      setErr("");
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pwd }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem(
        "tq_user",
        JSON.stringify({ email: data.email, role: data.role?.toLowerCase() || "advertiser", token: data.token, gstId: data.gstRegistrationId })
      );
      navigate("/dashboard");
    } catch (error) {
      setErr(error.message || "Login failed");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute w-[520px] h-[520px] -left-32 -top-20 rounded-full bg-[#0f2a7a] opacity-40 blur-[140px]" />
        <div className="absolute w-[520px] h-[520px] -right-24 top-10 rounded-full bg-[#2b0c8f] opacity-40 blur-[140px]" />
      </div>

      <div className="relative max-w-4xl mx-auto flex justify-center">
        <form
          onSubmit={submit}
          className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-[#14b86e] grid place-items-center shadow-lg shadow-[#14b86e55]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="4" fill="white" />
              </svg>
            </div>
          </div>

          <h1 className="text-center text-3xl font-extrabold mb-2">Advertiser Login</h1>
          <p className="text-center text-white/80 mb-6">Sign in to your advertiser account</p>

          {!!err && (
            <div className="mb-4 rounded-xl bg-red-500/15 border border-red-400/40 px-4 py-2 text-red-100 text-sm">
              {err}
            </div>
          )}

          <label className="block text-sm font-semibold mb-2">Email Address</label>
          <div className="relative mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" />
                <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-2xl bg-white/10 border border-white/20 pl-12 pr-4 py-3 outline-none placeholder-white/70 focus:border-white/40"
            />
          </div>

          <label className="block text-sm font-semibold mb-2">Password</label>
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-2xl bg-white/10 border border-white/20 pl-12 pr-12 py-3 outline-none placeholder-white/70 focus:border-white/40"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10"
              aria-label={show ? "Hide password" : "Show password"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between text-sm mb-6">
            <label className="inline-flex items-center gap-2 select-none">
              <input type="checkbox" className="h-4 w-4 rounded border-white/40 bg-white/10" />
              <span className="text-white/80">Remember me</span>
            </label>
            <a href="#" className="text-white/80 hover:text-white">
              Forgot password?
            </a>
          </div>

          <button className="w-full rounded-2xl bg-[#14b86e] hover:bg-[#11965e] py-3 font-semibold shadow-lg transition">
            Sign In
          </button>

          <div className="text-center mt-8 text-white/85">
            <p className="text-sm">Don&apos;t have an account?</p>
            <Link to="/advertiser/create" className="font-semibold hover:text-white">
              Create Advertiser Account
            </Link>
            <div className="mt-6">
              <Link to="/get-started" className="text-white/80 hover:text-white text-sm">
                ← Choose Different Account Type
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
