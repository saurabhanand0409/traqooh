import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "../components/UserMenu";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("tq_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const displayName = (user.email && user.email.split("@")[0]) || "Demo User";
  const roleLabel =
    user.role === "media-owner"
      ? "Vendor User"
      : user.role === "advertiser"
        ? "Advertiser"
        : "Vendor User";

  const signOut = () => {
    localStorage.removeItem("tq_user");
    navigate("/get-started");
  };

  const [summary, setSummary] = useState({
    totalInventory: 0,
    activeBookings: 0,
    monthlyRevenue: 0,
    averageOccupancy: 0,
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Build summary URL with optional ownerCompanyId for media owners
        let summaryUrl = `${API_BASE}/api/dashboard/summary`;
        if (user.companyId) {
          summaryUrl += `?ownerCompanyId=${user.companyId}`;
        }

        const [summaryRes, activityRes] = await Promise.all([
          fetch(summaryUrl),
          fetch(`${API_BASE}/api/dashboard/recent-activity`),
        ]);
        if (!summaryRes.ok) throw new Error("Failed to load summary");
        if (!activityRes.ok) throw new Error("Failed to load activity");
        const summaryJson = await summaryRes.json();
        const activityJson = await activityRes.json();
        setSummary({
          totalInventory: summaryJson.totalInventory ?? 0,
          activeBookings: summaryJson.activeBookings ?? 0,
          monthlyRevenue: summaryJson.monthlyRevenue ?? 0,
          averageOccupancy: summaryJson.averageOccupancy ?? 0,
          totalSqFt: summaryJson.totalSqFt ?? 0,
        });
        setRecent(
          activityJson.map((a) => ({
            text: a.text,
            time: a.time,
            color: a.text?.toLowerCase().includes("booking")
              ? "bg-green-500"
              : a.text?.toLowerCase().includes("quote")
                ? "bg-blue-500"
                : "bg-orange-500",
          }))
        );
      } catch (err) {
        setError(err.message || "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const quick = [
    { title: "Add New Site", desc: "List new inventory", icon: "📍", color: "text-purple-600" },
    { title: "Update Rates", desc: "Modify pricing", icon: "💲", color: "text-green-600" },
    { title: "Manage Availability", desc: "Update calendar", icon: "📅", color: "text-purple-600" },
    { title: "View Reports", desc: "Check performance", icon: "📈", color: "text-orange-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#0f172a]">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-blue-600 text-white grid place-items-center">
              🏙️
            </div>
            <span className="text-xl font-semibold text-[#0f172a]">OOH Marketplace</span>
          </div>
          <nav className="hidden lg:flex items-center gap-4 text-sm text-[#475569]">
            <Link className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold" to="/dashboard">
              <span role="img" aria-label="home">📊</span> Dashboard
            </Link>
            <Link className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100" to="/inventory">
              <span role="img" aria-label="inventory">🗂️</span> My Inventory
            </Link>
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100" href="#">
              <span role="img" aria-label="campaigns">📝</span> Campaign Requests
            </a>
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100" href="#">
              <span role="img" aria-label="collaborate">🤝</span> Collaborate
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100" title="Notifications">
              🔔
            </button>
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-5 py-10 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Welcome back, {displayName}</h1>
          <p className="text-gray-600 mt-2">Manage your media inventory and track campaign performance</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              label: "Total Inventory",
              value: summary.totalInventory,
              badge: "+2 this month",
              icon: "📍",
              iconBg: "bg-blue-50 text-blue-700",
            },
            {
              label: "Active Bookings",
              value: summary.activeBookings,
              badge: "+3 this week",
              icon: "📅",
              iconBg: "bg-green-50 text-green-700",
            },
            {
              label: "Total Area",
              value: `${(summary.totalSqFt || 0).toLocaleString()} sqft`,
              badge: "Across all sites",
              icon: "📐",
              iconBg: "bg-purple-50 text-purple-700",
            },
            {
              label: "Avg. Occupancy",
              value: `${Math.round(summary.averageOccupancy || 0)}%`,
              badge: "+5% this month",
              icon: "📈",
              iconBg: "bg-orange-50 text-orange-700",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">{s.label}</div>
                <span className={`h-10 w-10 rounded-lg grid place-items-center text-lg ${s.iconBg}`}>{s.icon}</span>
              </div>
              <div className="text-3xl font-semibold mt-3">{s.value}</div>
              <div className="text-xs text-gray-400 mt-2">{s.badge}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            {loading && <div className="text-sm text-gray-500">Loading activity...</div>}
            {!loading && error && <div className="text-sm text-red-600">{error}</div>}
            {!loading && !error && (
              <ul className="space-y-4">
                {recent.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className={`mt-2 h-2.5 w-2.5 rounded-full ${r.color}`}></span>
                    <div>
                      <div className="text-sm">{r.text}</div>
                      <div className="text-xs text-gray-400">{r.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Quick Actions */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {quick.map((q) => (
                <button
                  key={q.title}
                  className="text-left bg-white rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition flex items-start gap-3"
                >
                  <span className={`h-9 w-9 rounded-lg bg-gray-100 grid place-items-center text-lg ${q.color}`}>
                    {q.icon}
                  </span>
                  <span>
                    <div className="text-sm font-semibold">{q.title}</div>
                    <div className="text-xs text-gray-500">{q.desc}</div>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
