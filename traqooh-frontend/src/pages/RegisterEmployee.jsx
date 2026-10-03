import React from "react";
import { useNavigate, Link } from "react-router-dom";

export default function RegisterEmployee() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ background: "var(--bg)" }}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full blur-[140px] opacity-20" style={{ width: 600, height: 600, left: "-15%", top: "-20%", background: "#22C55E" }} />
        <div className="absolute rounded-full blur-[140px] opacity-15" style={{ width: 500, height: 500, right: "-10%", bottom: "-10%", background: "#2563EB" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="re-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#re-grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[440px] mx-4 rounded-2xl p-8" style={{ background: "rgba(13,20,40,.95)", border: "1px solid rgba(255,255,255,.10)", backdropFilter: "blur(20px)", boxShadow: "0 32px 80px rgba(0,0,0,.6)" }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center rounded-2xl font-syne font-black text-white mb-3" style={{ width: 52, height: 52, background: "linear-gradient(135deg,#2563EB,#DC143C)", boxShadow: "0 8px 32px rgba(37,99,235,.4)", fontSize: "1rem" }}>tq</div>
          <div className="text-center leading-none">
            <div className="font-syne font-extrabold text-xl"><span style={{ color: "#2563EB" }}>traq</span><span style={{ color: "#DC143C" }}>OOH</span></div>
            <div className="text-[.5rem] uppercase tracking-widest mt-0.5" style={{ color: "#4B5563" }}>by <span style={{ color: "#2563EB" }}>BRAND</span><span style={{ color: "#DC143C" }}>SCULPT</span></div>
          </div>
        </div>

        {/* Role badge */}
        <div className="flex items-center justify-center rounded-xl py-2.5 mb-6" style={{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)" }}>
          <span style={{ fontSize: ".78rem", fontWeight: 700, color: "#4ADE80" }}>👤 Employee Account</span>
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-2xl flex items-center justify-center" style={{ width: 72, height: 72, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)" }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 48 48" style={{ color: "#22C55E" }}>
              <circle cx="24" cy="16" r="8" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        <h2 className="font-syne font-bold text-white text-center mb-3" style={{ fontSize: "1.15rem" }}>Employee accounts are created by your Admin</h2>

        <p className="text-center mb-6" style={{ color: "var(--gray)", fontSize: ".85rem", lineHeight: 1.7 }}>
          TraqOOH employee accounts are set up by your company's Admin or by BrandSculpt. You cannot self-register as an employee.
        </p>

        {/* Steps */}
        <div className="rounded-xl p-4 mb-6 space-y-4" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
          <p style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray2)", marginBottom: 12 }}>How to get access</p>

          {[
            { num: "01", title: "Contact your Admin", desc: "Ask the Admin of your OOH company to create an employee account for you in TraqOOH." },
            { num: "02", title: "Receive your credentials", desc: "Your Admin will share your login email and password via email or WhatsApp." },
            { num: "03", title: "Sign in", desc: "Use the Employee Login page with your provided credentials." },
          ].map(step => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center rounded-lg font-syne font-bold" style={{ width: 32, height: 32, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.2)", color: "#22C55E", fontSize: ".75rem" }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontSize: ".8rem", fontWeight: 700, color: "#fff", marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: ".75rem", color: "var(--gray)", lineHeight: 1.5 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact admin callout */}
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: "rgba(37,99,235,.08)", border: "1px solid rgba(37,99,235,.2)" }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: "#93C5FD", flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <p style={{ fontSize: ".77rem", color: "#93C5FD", lineHeight: 1.6 }}>
            If your company is not yet on TraqOOH, ask your company owner to{" "}
            <Link to="/register/admin" style={{ color: "#60A5FA", fontWeight: 700, textDecoration: "none" }}>register the company first</Link>.
          </p>
        </div>

        <button
          onClick={() => navigate("/employeelogin")}
          className="w-full py-3 rounded-xl font-bold text-white transition-all"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)", fontSize: ".9rem" }}
        >
          Go to Employee Login →
        </button>

        <p className="text-center mt-5" style={{ fontSize: ".72rem", color: "var(--gray3)" }}>
          <Link to="/register" style={{ color: "var(--gray2)" }}>← Back to account types</Link>
        </p>
      </div>
    </div>
  );
}
