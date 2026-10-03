import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function RegisterAdmin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: "",
    directorName: "",
    directorPhone: "",
    primaryEmail: "",
    primaryPhone: "",
    gstNumber: "",
    gstAddress: "",
    accountPassword: "",
    confirmPassword: "",
    city: "",
    state: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => { fetch(`${API_BASE}/health`).catch(() => {}); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.companyName.trim()) return setErr("Company name is required.");
    if (!form.directorName.trim()) return setErr("Director / Owner name is required.");
    if (!form.primaryEmail.trim()) return setErr("Email is required.");
    if (!/\S+@\S+\.\S+/.test(form.primaryEmail)) return setErr("Enter a valid email address.");
    if (!form.primaryPhone.trim()) return setErr("Phone number is required.");
    if (!form.gstNumber.trim()) return setErr("GST number is required.");
    if (form.accountPassword.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.accountPassword !== form.confirmPassword) return setErr("Passwords do not match.");

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          directorName: form.directorName.trim(),
          directorPhone: form.directorPhone.trim(),
          primaryEmail: form.primaryEmail.trim().toLowerCase(),
          primaryPhone: form.primaryPhone.trim(),
          gstNumber: form.gstNumber.trim().toUpperCase(),
          gstAddress: form.gstAddress.trim() || form.city.trim() || "India",
          gstCertificateUrl: "",
          rocAttachmentUrl: "",
          contacts: [],
          accountPassword: form.accountPassword,
          role: "ADMIN",
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Registration failed. Please try again.");
      }

      setSuccess(true);
    } catch (error) {
      setErr(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative" style={{ background: "var(--bg)" }}>
        <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 text-center" style={{ background: "rgba(13,20,40,.95)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(20px)" }}>
          <div className="rounded-full flex items-center justify-center mx-auto mb-5" style={{ width: 64, height: 64, background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.3)" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 className="font-syne font-extrabold text-white text-2xl mb-3">Company Registered!</h2>
          <p style={{ color: "var(--gray)", fontSize: ".9rem", lineHeight: 1.6, marginBottom: 28 }}>
            <strong style={{ color: "#fff" }}>{form.companyName}</strong> is now on TraqOOH.<br/>
            Sign in with your admin credentials to start adding inventory and campaigns.
          </p>
          <button
            onClick={() => navigate("/adminlogin")}
            className="w-full py-3 rounded-xl font-bold text-white transition-all mb-3"
            style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)", fontSize: ".9rem" }}
          >
            Go to Admin Login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative py-10" style={{ background: "var(--bg)" }}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full blur-[140px] opacity-25" style={{ width: 600, height: 600, left: "-15%", top: "-20%", background: "#2563EB" }} />
        <div className="absolute rounded-full blur-[140px] opacity-15" style={{ width: 500, height: 500, right: "-10%", bottom: "-10%", background: "#DC143C" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="ra-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#ra-grid)" />
        </svg>
      </div>

      <form onSubmit={submit} className="relative z-10 w-full max-w-[480px] mx-4 rounded-2xl p-8" style={{ background: "rgba(13,20,40,.95)", border: "1px solid rgba(255,255,255,.10)", backdropFilter: "blur(20px)", boxShadow: "0 32px 80px rgba(0,0,0,.6)" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center rounded-2xl font-syne font-black text-white mb-3" style={{ width: 52, height: 52, background: "linear-gradient(135deg,#2563EB,#DC143C)", boxShadow: "0 8px 32px rgba(37,99,235,.4)", fontSize: "1rem" }}>tq</div>
          <div className="text-center leading-none">
            <div className="font-syne font-extrabold text-xl"><span style={{ color: "#2563EB" }}>traq</span><span style={{ color: "#DC143C" }}>OOH</span></div>
            <div className="text-[.5rem] uppercase tracking-widest mt-0.5" style={{ color: "#4B5563" }}>by <span style={{ color: "#2563EB" }}>BRAND</span><span style={{ color: "#DC143C" }}>SCULPT</span></div>
          </div>
        </div>

        {/* Role badge */}
        <div className="flex items-center justify-center rounded-xl py-2.5 mb-5" style={{ background: "rgba(37,99,235,.1)", border: "1px solid rgba(37,99,235,.2)" }}>
          <span style={{ fontSize: ".78rem", fontWeight: 700, color: "#93C5FD" }}>🏢 OOH Company Registration</span>
        </div>

        <h2 className="font-syne font-bold text-white text-center mb-1" style={{ fontSize: "1.1rem" }}>Register your OOH company</h2>
        <p className="text-center mb-6" style={{ color: "var(--gray)", fontSize: ".78rem" }}>Add your company to start managing inventory and campaigns</p>

        {err && (
          <div className="rounded-xl px-4 py-3 mb-5 text-sm" style={{ background: "rgba(220,20,60,.12)", border: "1px solid rgba(220,20,60,.3)", color: "#F87171" }}>{err}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Company Name</label>
            <input className="tq-input w-full" placeholder="e.g. Patna Outdoor Media Pvt. Ltd." value={form.companyName} onChange={set("companyName")} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Director / Owner Name</label>
              <input className="tq-input w-full" placeholder="Full name" value={form.directorName} onChange={set("directorName")} required />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Director Phone</label>
              <input className="tq-input w-full" placeholder="+91 XXXXX XXXXX" value={form.directorPhone} onChange={set("directorPhone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Work Email</label>
              <input className="tq-input w-full" type="email" placeholder="admin@company.com" value={form.primaryEmail} onChange={set("primaryEmail")} required />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Office Phone</label>
              <input className="tq-input w-full" placeholder="Phone number" value={form.primaryPhone} onChange={set("primaryPhone")} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>GST Number</label>
              <input className="tq-input w-full" placeholder="29AABCU9603R1ZX" value={form.gstNumber} onChange={set("gstNumber")} required style={{ textTransform: "uppercase" }} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>City, State</label>
              <input className="tq-input w-full" placeholder="e.g. Patna, Bihar" value={form.city} onChange={set("city")} />
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Registered GST Address</label>
            <input className="tq-input w-full" placeholder="Full address as per GST certificate (optional)" value={form.gstAddress} onChange={set("gstAddress")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Password</label>
              <div className="relative">
                <input className="tq-input w-full pr-10" type={showPwd ? "text" : "password"} placeholder="Min 8 characters" value={form.accountPassword} onChange={set("accountPassword")} required />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray)", padding: 0 }}>
                  {showPwd ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>}
                </button>
              </div>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)" }}>Confirm Password</label>
              <input className="tq-input w-full" type={showPwd ? "text" : "password"} placeholder="Re-enter" value={form.confirmPassword} onChange={set("confirmPassword")} required />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white mt-6 transition-all" style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)", fontSize: ".9rem", opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Registering Company…" : "Register Company →"}
        </button>

        <p className="text-center mt-5" style={{ fontSize: ".75rem", color: "var(--gray2)" }}>
          Already registered?{" "}
          <Link to="/adminlogin" style={{ color: "#2563EB", fontWeight: 700 }}>Admin Login</Link>
        </p>

        <p className="text-center mt-3" style={{ fontSize: ".72rem", color: "var(--gray3)" }}>
          <Link to="/register" style={{ color: "var(--gray2)" }}>← Back to account types</Link>
        </p>
      </form>
    </div>
  );
}
