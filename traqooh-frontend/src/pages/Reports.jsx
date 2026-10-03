import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiFetch } from "../utils/apiFetch";
import { requireAuth } from "../utils/auth";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const DARK_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0D1428", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px" }}>
      {label && <p style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color || "#fff", fontSize: 13, fontWeight: 700 }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const STATUS_COLORS = {
  DRAFT: "#6B7280", PLANNED: "#3B82F6", FINALIZED: "#F59E0B",
  RUNNING: "#22C55E", LIVE: "#22C55E", COMPLETE: "#8B5CF6", COMPLETED: "#8B5CF6", CANCELLED: "#DC143C",
};
const ACTIVITY_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#DC143C", "#F97316", "#14B8A6", "#EC4899"];

function KPI({ label, value, sub, color }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--gray2)" }}>{label}</p>
      <p className="font-syne font-extrabold text-3xl text-white" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-syne font-bold text-base text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);

  const [summary, setSummary] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requireAuth(navigate, ["ADMIN", "EMPLOYEE", "SUPER_ADMIN"])) return;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    // Reports show global numbers for every role so employees can see the full picture
    const [sRes, cRes, aRes] = await Promise.all([
      apiFetch(`/api/dashboard/summary`),
      apiFetch("/api/campaigns"),
      apiFetch("/api/activities"),
    ]);
    if (sRes.ok) setSummary(await sRes.json());
    if (cRes.ok) setCampaigns(await cRes.json());
    if (aRes.ok) setActivities(await aRes.json());
    setLoading(false);
  };

  // Campaign status breakdown
  const statusData = useMemo(() => {
    const counts = {};
    campaigns.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  // Site availability
  const siteAvailData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Vacant", value: summary.availableSites || 0, fill: "#22C55E" },
      { name: "Booked", value: summary.bookedSites || 0, fill: "#DC143C" },
      { name: "Other", value: Math.max(0, (summary.totalSites || 0) - (summary.availableSites || 0) - (summary.bookedSites || 0)), fill: "#6B7280" },
    ].filter(d => d.value > 0);
  }, [summary]);

  // Activities by type
  const activityTypeData = useMemo(() => {
    const counts = {};
    activities.forEach(a => { counts[a.activityType] = (counts[a.activityType] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activities]);

  // Activities by month (last 6 months)
  const activityMonthData = useMemo(() => {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { m: d.toLocaleDateString("en-IN", { month: "short" }), count: 0 };
    }
    activities.forEach(a => {
      const date = a.activityDate || a.createdAt;
      if (!date) return;
      const key = date.slice(0, 7);
      if (months[key]) months[key].count++;
    });
    return Object.values(months);
  }, [activities]);

  // Top campaigns by cost
  const topCampaigns = useMemo(() => (
    [...campaigns].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0)).slice(0, 8)
  ), [campaigns]);

  // Revenue by status
  const revenueByStatus = useMemo(() => {
    const rev = {};
    campaigns.forEach(c => { rev[c.status] = (rev[c.status] || 0) + Number(c.totalCost || 0); });
    return Object.entries(rev).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [campaigns]);

  if (loading) return (
    <AppShell user={user}>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#2563EB", borderTopColor: "transparent" }} />
      </div>
    </AppShell>
  );

  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.totalCost || 0), 0);
  const liveCount = campaigns.filter(c => c.status === "RUNNING" || c.status === "LIVE").length;

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="font-syne font-bold text-xl text-white">Reports & Analytics</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Live data from your campaigns, sites, and field activities</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI label="Total Campaigns" value={campaigns.length} />
        <KPI label="Live Campaigns" value={liveCount} color="#22C55E" sub={`${summary?.upcomingCampaigns || 0} upcoming`} />
        <KPI label="Total Sites" value={summary?.totalSites || 0} color="#60A5FA" sub={`${summary?.availableSites || 0} vacant`} />
        <KPI label="Total Revenue" value={`₹${Math.round(totalRevenue / 1000)}K`} color="#A78BFA" sub={`${summary?.totalAdvertisers || 0} advertisers`} />
      </div>

      {/* Row 1: Campaign status + Site availability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Campaign Status Breakdown">
          {statusData.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--gray2)" }}>No campaign data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DARK_TOOLTIP />} />
                <Legend formatter={(v) => <span style={{ color: "var(--gray)", fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Site Availability">
          {siteAvailData.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--gray2)" }}>No site data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={siteAvailData} barSize={48}>
                <XAxis dataKey="name" tick={{ fill: "var(--gray2)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--gray2)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DARK_TOOLTIP />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {siteAvailData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Row 2: Activity timeline + Activity types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Field Activity (Last 6 Months)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityMonthData} barSize={28}>
              <XAxis dataKey="m" tick={{ fill: "var(--gray2)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--gray2)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DARK_TOOLTIP />} />
              <Bar dataKey="count" name="Activities" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Activity Types">
          {activityTypeData.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--gray2)" }}>No activity data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityTypeData} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fill: "var(--gray2)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "var(--gray)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<DARK_TOOLTIP />} />
                <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                  {activityTypeData.map((_, i) => <Cell key={i} fill={ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Top Campaigns Table */}
      <SectionCard title="Top Campaigns by Value">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Campaign", "Advertiser", "Status", "Sites", "Value"].map(h => (
                  <th key={h} className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td className="py-3 pr-4 font-medium text-white">{c.name}</td>
                  <td className="py-3 pr-4 text-xs" style={{ color: "var(--gray)" }}>{c.advertiserName || "—"}</td>
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${STATUS_COLORS[c.status]}22`, color: STATUS_COLORS[c.status] }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs" style={{ color: "var(--gray)" }}>{c.siteCount || 0}</td>
                  <td className="py-3 font-semibold" style={{ color: "#A78BFA" }}>₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {topCampaigns.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: "var(--gray2)" }}>No campaigns yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
