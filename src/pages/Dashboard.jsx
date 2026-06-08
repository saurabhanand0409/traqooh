import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { requireAuth } from "../utils/auth";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const mockBarData = [
  { m: "Jan", v: 4 }, { m: "Feb", v: 7 }, { m: "Mar", v: 5 },
  { m: "Apr", v: 9 }, { m: "May", v: 12 }, { m: "Jun", v: 8 },
  { m: "Jul", v: 15 }, { m: "Aug", v: 11 },
];

const BAR_GRADIENT = "barGrad";
const DONUT_COLORS = ["#22C55E", "#2563EB"];

function KpiCard({ label, value, sub, icon, accent }) {
  return (
    <div
      className="glass rounded-2xl p-5 flex flex-col gap-3 hover:border-white/15 transition-all"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{label}</p>
          <p className="font-syne font-extrabold text-3xl mt-1 text-white">{value}</p>
        </div>
        <div
          className="flex items-center justify-center rounded-xl w-10 h-10 flex-shrink-0"
          style={{ background: `${accent}22` }}
        >
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      {sub && <p className="text-xs" style={{ color: "var(--gray2)" }}>{sub}</p>}
    </div>
  );
}

// Custom tooltip for charts
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0D1428", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 14px" }}>
      <p style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{p.value} {p.name}</p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => { requireAuth(navigate, ["EMPLOYEE", "ADMIN"]); }, []);

  const [summary, setSummary] = useState({
    totalSites: 0, availableSites: 0, bookedSites: 0,
    liveCampaigns: 0, upcomingCampaigns: 0, totalBookedValue: 0,
    pendingAudits: 0, totalVendors: 0, totalAdvertisers: 0
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let url = `${API_BASE}/api/dashboard/summary`;
        if (user.companyId) url += `?ownerCompanyId=${user.companyId}`;
        const [sRes, aRes] = await Promise.all([fetch(url), fetch(`${API_BASE}/api/dashboard/recent-activity`)]);
        if (sRes.ok) setSummary(await sRes.json());
        if (aRes.ok) setRecent(await aRes.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const util = summary.totalSites ? Math.round((summary.bookedSites / summary.totalSites) * 100) : 0;
  const donutData = [
    { name: "Available", value: summary.availableSites || 0 },
    { name: "Booked", value: summary.bookedSites || 0 },
  ];

  const displayName = user.displayName || user.email?.split("@")[0] || "there";

  return (
    <AppShell user={user}>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white">
            Welcome back, <span className="brand-gradient-text">{displayName}</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Here's what's happening with your inventory today.</p>
        </div>
        <Link
          to="/campaigns"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
          New Campaign
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Sites"
          value={loading ? "—" : summary.totalSites}
          sub={`${summary.availableSites} available`}
          accent="#2563EB"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
        <KpiCard
          label="Live Campaigns"
          value={loading ? "—" : summary.liveCampaigns}
          sub={`${summary.upcomingCampaigns} upcoming`}
          accent="#22C55E"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>}
        />
        <KpiCard
          label="Booked Value"
          value={loading ? "—" : `₹${Number(summary.totalBookedValue || 0).toLocaleString("en-IN")}`}
          sub="Total confirmed revenue"
          accent="#F59E0B"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard
          label="Pending Audits"
          value={loading ? "—" : summary.pendingAudits}
          sub="Sites needing audit"
          accent="#DC143C"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Bar chart — monthly campaigns */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-syne font-bold text-white">Campaign Activity</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Active campaigns per month</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={BAR_GRADIENT} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#1d50c8" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="v" name="campaigns" fill={`url(#${BAR_GRADIENT})`} radius={[6, 6, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — site utilization */}
        <div className="glass rounded-2xl p-5 flex flex-col">
          <p className="font-syne font-bold text-white mb-0.5">Site Utilization</p>
          <p className="text-xs mb-4" style={{ color: "var(--gray2)" }}>Booked vs Available</p>
          <div className="flex-1 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutData} cx="50%" cy="50%"
                  innerRadius={54} outerRadius={76}
                  paddingAngle={4} dataKey="value" stroke="none"
                >
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-syne font-extrabold text-2xl text-white">{util}%</span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--gray2)" }}>booked</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gray)" }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Quick actions + Activity feed */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quick actions */}
        <div className="glass rounded-2xl p-5">
          <p className="font-syne font-bold text-white mb-4">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Add Site",        desc: "Register new inventory", to: "/inventory", color: "#2563EB" },
              { label: "New Campaign",    desc: "Start a booking",        to: "/campaigns",  color: "#22C55E" },
              { label: "Log Activity",    desc: "Record field work",      to: "/activities", color: "#F59E0B" },
              { label: "View Reports",    desc: "Check analytics",        to: "/reports",    color: "#DC143C" },
            ].map(a => (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col gap-1.5 p-3.5 rounded-xl transition-all"
                style={{ background: `${a.color}11`, border: `1px solid ${a.color}22` }}
                onMouseEnter={e => { e.currentTarget.style.background = `${a.color}22`; e.currentTarget.style.borderColor = `${a.color}44`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${a.color}11`; e.currentTarget.style.borderColor = `${a.color}22`; }}
              >
                <p className="text-sm font-bold text-white">{a.label}</p>
                <p className="text-xs" style={{ color: "var(--gray2)" }}>{a.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="glass rounded-2xl p-5 flex flex-col">
          <p className="font-syne font-bold text-white mb-4">Recent Activity</p>
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading && (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
            )}
            {!loading && recent.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "var(--gray2)" }}>No recent activity.</p>
            )}
            {!loading && recent.slice(0, 8).map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: r.text?.toLowerCase().includes("campaign") ? "#22C55E" : "#2563EB" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-snug truncate">{r.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{r.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
