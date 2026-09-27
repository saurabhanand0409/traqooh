import React from "react";
import { useNavigate } from "react-router-dom";

const roles = [
  {
    key: "advertiser",
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 48 48">
        <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M16 24h16M16 32h10M16 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    iconColor: "#DC143C",
    iconBg: "rgba(220,20,60,.12)",
    title: "Advertiser",
    subtitle: "I want to run OOH campaigns",
    desc: "Register as a brand or advertiser. Review site proposals, shortlist locations, set campaign dates and track your outdoor advertising across India.",
    bullets: ["View proposed campaign sites", "Shortlist & approve locations", "Track spend and execution", "Access proof-of-display photos"],
    path: "/register/advertiser",
    gradient: "linear-gradient(135deg,#DC143C,#9B1B1B)",
    badge: "Most Common",
  },
  {
    key: "admin",
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 48 48">
        <rect x="6" y="8" width="36" height="22" rx="2" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M16 30v10M32 30v10M12 40h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    iconColor: "#2563EB",
    iconBg: "rgba(37,99,235,.12)",
    title: "OOH Company / Admin",
    subtitle: "I own or manage OOH inventory",
    desc: "Register your media company. Add billboard inventory, manage campaigns, create client proposals and run your entire OOH business from one dashboard.",
    bullets: ["Manage billboard inventory", "Create & send campaign proposals", "Add employees to your team", "Full analytics & reports"],
    path: "/register/admin",
    gradient: "linear-gradient(135deg,#2563EB,#1E40AF)",
    badge: null,
  },
  {
    key: "employee",
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 48 48">
        <circle cx="24" cy="16" r="8" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    iconColor: "#22C55E",
    iconBg: "rgba(34,197,94,.12)",
    title: "Employee",
    subtitle: "I work at an OOH media company",
    desc: "Your admin creates your account. Ask your company's TraqOOH administrator to set up your employee login. Already have credentials? Sign in directly.",
    bullets: ["Account created by your admin", "Access company inventory", "Log campaign activities", "View assigned campaigns"],
    path: "/register/employee",
    gradient: "linear-gradient(135deg,#22C55E,#166534)",
    badge: "By Invite",
  },
];

export default function Register() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ background: "var(--bg)" }}>
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full blur-[180px] opacity-20" style={{ width: 700, height: 700, left: "-20%", top: "-20%", background: "#2563EB" }} />
        <div className="absolute rounded-full blur-[180px] opacity-15" style={{ width: 600, height: 600, right: "-15%", bottom: "-10%", background: "#DC143C" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="reg-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#reg-grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <button onClick={() => window.location.href = "https://traqooh.brandsculpt.com"} className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: ".8rem", fontWeight: 600 }}>Back to TraqOOH</span>
          </button>

          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center justify-center rounded-2xl font-syne font-black text-white" style={{ width: 52, height: 52, background: "linear-gradient(135deg,#2563EB,#DC143C)", boxShadow: "0 8px 32px rgba(37,99,235,0.4)", fontSize: "1rem" }}>tq</div>
          </div>

          <h1 className="font-syne font-extrabold text-white mb-3" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", letterSpacing: "-.03em" }}>
            Create Your <span style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TraqOOH Account</span>
          </h1>
          <p style={{ color: "var(--gray)", fontSize: ".95rem", maxWidth: 480, margin: "0 auto" }}>
            Choose your account type to get started. Different roles have different access levels.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => navigate(role.path)}
              className="text-left rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 group"
              style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                backdropFilter: "blur(12px)",
                cursor: "pointer",
                boxShadow: "0 4px 24px rgba(0,0,0,.3)",
              }}
              onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,.16)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,.08)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,.3)"; }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="rounded-xl flex items-center justify-center" style={{ width: 52, height: 52, background: role.iconBg, color: role.iconColor }}>
                  {role.icon}
                </div>
                {role.badge && (
                  <span className="text-[.6rem] font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: role.iconBg, color: role.iconColor }}>
                    {role.badge}
                  </span>
                )}
              </div>

              <h3 className="font-syne font-bold text-white mb-1" style={{ fontSize: "1.05rem" }}>{role.title}</h3>
              <p style={{ color: "var(--gray)", fontSize: ".75rem", marginBottom: 16, fontWeight: 600 }}>{role.subtitle}</p>
              <p style={{ color: "var(--gray2)", fontSize: ".8rem", lineHeight: 1.6, marginBottom: 16 }}>{role.desc}</p>

              <ul className="space-y-2 mb-5">
                {role.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2" style={{ fontSize: ".76rem", color: "var(--gray)" }}>
                    <span style={{ color: role.iconColor, fontSize: ".6rem" }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <span style={{ fontSize: ".78rem", fontWeight: 700, color: role.iconColor }}>
                  {role.key === "employee" ? "Learn More →" : "Register Now →"}
                </span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ color: role.iconColor, opacity: 0.7 }}>
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Already have an account */}
        <p className="text-center mt-10" style={{ fontSize: ".8rem", color: "var(--gray2)" }}>
          Already have an account?{" "}
          <button onClick={() => navigate("/employeelogin")} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB", fontWeight: 700 }}>
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
