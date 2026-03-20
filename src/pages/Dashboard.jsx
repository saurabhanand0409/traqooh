import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "../components/UserMenu";
import { requireAuth, signOut as authSignOut } from "../utils/auth";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, MapPin, Target, IndianRupee, ClipboardList,
  Calendar, CheckCircle, Zap, Building2, CalendarDays, Filter, Download, Bell, PlusCircle
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

// --- Mock Data for Analytics ---
const mockPerformanceData = [
  { name: "Jan", impressions: 4000, bookings: 24, revenue: 240000 },
  { name: "Feb", impressions: 3000, bookings: 13, revenue: 130000 },
  { name: "Mar", impressions: 2000, bookings: 18, revenue: 180000 },
  { name: "Apr", impressions: 2780, bookings: 39, revenue: 390000 },
  { name: "May", impressions: 1890, bookings: 48, revenue: 480000 },
  { name: "Jun", impressions: 2390, bookings: 38, revenue: 380000 },
  { name: "Jul", impressions: 3490, bookings: 43, revenue: 430000 },
];

const mockRevenueData = [
  { name: "Week 1", current: 120000, prev: 90000 },
  { name: "Week 2", current: 150000, prev: 110000 },
  { name: "Week 3", current: 180000, prev: 130000 },
  { name: "Week 4", current: 210000, prev: 160000 },
];

const mockCityData = [
  { name: "Mumbai", value: 350000 },
  { name: "Delhi", value: 280000 },
  { name: "Bengaluru", value: 210000 },
  { name: "Pune", value: 150000 },
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); } 
    catch { return {}; }
  }, []);

  const displayName = user.displayName || (user.email && user.email.split("@")[0]) || "Employee";

  useEffect(() => {
    requireAuth(navigate, ["EMPLOYEE", "ADMIN"]);
  }, []);

  const [summary, setSummary] = useState({
    totalSites: 0, availableSites: 0, bookedSites: 0,
    liveCampaigns: 0, upcomingCampaigns: 0,
    totalBookedValue: 0, pendingAudits: 0, totalVendors: 0, totalAdvertisers: 0
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [metricFilter, setMetricFilter] = useState("bookings"); // impressions, bookings, revenue

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let summaryUrl = `${API_BASE}/api/dashboard/summary`;
        if (user.companyId) summaryUrl += `?ownerCompanyId=${user.companyId}`;

        const [summaryRes, activityRes] = await Promise.all([
          fetch(summaryUrl),
          fetch(`${API_BASE}/api/dashboard/recent-activity`),
        ]);
        
        if (summaryRes.ok) setSummary(await summaryRes.json());
        if (activityRes.ok) {
          const actJson = await activityRes.json();
          setRecent(actJson.map(a => ({
            ...a,
            // Extract a realistic icon based on text
            icon: a.text?.toLowerCase().includes("site") ? <MapPin className="text-blue-500 w-5 h-5"/> :
                  a.text?.toLowerCase().includes("campaign") ? <Target className="text-purple-500 w-5 h-5"/> :
                  a.text?.toLowerCase().includes("audit") ? <ClipboardList className="text-orange-500 w-5 h-5"/> :
                  <Zap className="text-green-500 w-5 h-5"/>
          })));
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Compute calculated values
  const utilizationRate = summary.totalSites ? Math.round((summary.bookedSites / summary.totalSites) * 100) : 0;
  const inventoryData = [
    { name: "Available", value: summary.availableSites || 0 },
    { name: "Booked", value: summary.bookedSites || 0 },
  ];

  // Dynamic Insights
  const insights = [
    utilizationRate < 40 ? "Your inventory utilization is low. Consider running promotions in top cities." : "Inventory utilization is healthy and growing.",
    summary.liveCampaigns === 0 ? "No active campaigns currently. Focus on outreach to pending advertisers." : `${summary.liveCampaigns} active campaigns driving revenue.`,
    summary.pendingAudits > 0 ? `${summary.pendingAudits} site audits are pending. Please complete them soon.` : "All audits are up to date.",
    "Peak campaign activity observed during early week days."
  ];

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#0f172a] font-sans selection:bg-blue-100">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 text-white grid place-items-center">
              <span className="font-bold text-xl leading-none">t</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-900 tracking-tight">traqOOH</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600 transition">
              <Bell className="w-5 h-5" />
            </button>
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Welcome & Filters Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Dashboard Insights</h1>
            <p className="text-gray-500 mt-1 font-medium">Welcome back, {displayName} • Track real-time performance and analytics.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-600 shadow-sm cursor-pointer hover:bg-gray-50 transition">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              <span>Last 30 Days</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-600 shadow-sm cursor-pointer hover:bg-gray-50 transition">
              <Filter className="w-4 h-4 text-purple-500" />
              <span>All Cities</span>
            </div>
            <button className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition">
              <Download className="w-4 h-4 text-green-500" />
              Export
            </button>
          </div>
        </div>

        {/* --- KPI CARDS --- */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: "Total Sites", value: summary.totalSites || 0, trend: "+12%", up: true, icon: <MapPin className="w-6 h-6 text-blue-600"/>, bg: "bg-blue-50" },
            { label: "Live Campaigns", value: summary.liveCampaigns || 0, trend: "+3%", up: true, icon: <Target className="w-6 h-6 text-purple-600"/>, bg: "bg-purple-50" },
            { label: "Booked Value", value: `₹${Number(summary.totalBookedValue||0).toLocaleString("en-IN")}`, trend: "-5%", up: false, icon: <IndianRupee className="w-6 h-6 text-green-600"/>, bg: "bg-green-50" },
            { label: "Pending Audits", value: summary.pendingAudits || 0, trend: "+1", up: false, icon: <ClipboardList className="w-6 h-6 text-orange-600"/>, bg: "bg-orange-50" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 hover:shadow-lg transition-shadow duration-300 group">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-500">{s.label}</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{s.value}</div>
                </div>
                <div className={`p-3 rounded-xl ${s.bg} bg-opacity-80 group-hover:scale-110 transition-transform duration-300`}>{s.icon}</div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium">
                {s.up ? <TrendingUp className="w-4 h-4 text-green-500"/> : <TrendingDown className="w-4 h-4 text-red-500"/>}
                <span className={s.up ? "text-green-600" : "text-red-600"}>{s.trend}</span>
                <span className="text-gray-400">vs last month</span>
              </div>
            </div>
          ))}
        </div>

        {/* --- PERFORMANCE CHARTS ROW --- */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Performance Over Time</h2>
                <p className="text-xs text-gray-500">Track key metrics monthly</p>
              </div>
              <select 
                value={metricFilter} 
                onChange={e=>setMetricFilter(e.target.value)}
                className="bg-gray-50 border-gray-200 text-sm rounded-lg text-gray-600 font-medium py-1.5 focus:ring-blue-500"
              >
                <option value="bookings">Bookings</option>
                <option value="impressions">Impressions</option>
                <option value="revenue">Revenue</option>
              </select>
            </div>
            <div className="flex-1 w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockPerformanceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={metricFilter} 
                    stroke={metricFilter === "revenue" ? "#10b981" : "#3b82f6"} 
                    strokeWidth={3} 
                    dot={{r: 4, strokeWidth: 2}} 
                    activeDot={{r: 6, strokeWidth: 0}}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 flex flex-col">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Revenue Analytics</h2>
              <p className="text-xs text-gray-500">Current vs Previous Month Comparison</p>
            </div>
            <div className="flex-1 w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockRevenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="prev" name="Previous Month" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="current" name="Current Month" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* --- INSIGHTS & DISTRIBUTION ROW --- */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Smart Insights Panel */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6 opacity-90">
                <div className="bg-white/20 p-2 rounded-lg"><Zap className="w-5 h-5 text-yellow-300" /></div>
                <h2 className="text-lg font-bold tracking-wide uppercase text-blue-100">Smart Insights</h2>
              </div>
              <ul className="space-y-4">
                {insights.map((ins, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                    <CheckCircle className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium leading-relaxed drop-shadow-sm">{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Donut Chart - Utilization */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 flex flex-col items-center relative">
            <div className="w-full mb-2">
              <h2 className="text-lg font-bold text-gray-900">Inventory Utilization</h2>
              <p className="text-xs text-gray-500">Booked vs Available Sites</p>
            </div>
            <div className="w-full h-[220px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inventoryData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#10b981" /> {/* Available */}
                    <Cell fill="#f59e0b" /> {/* Booked */}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
                <span className="text-3xl font-extrabold text-gray-800">{utilizationRate}%</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Booked</span>
              </div>
            </div>
          </div>

          {/* Horizontal Bar - Top Cities */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Top Performing Cities</h2>
              <p className="text-xs text-gray-500">By booked revenue (₹)</p>
            </div>
            <div className="flex-1 w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockCityData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 13, fontWeight: 500}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    formatter={(val) => `₹${val.toLocaleString()}`}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24}>
                    {mockCityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* --- ACTIONS & ACTIVITY ROW --- */}
        <div className="grid lg:grid-cols-2 gap-6 pb-12">
          
          {/* Quick Action Cards */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-20 -mt-20"></div>
            <h2 className="text-lg font-bold text-gray-900 mb-6 relative">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 gap-4 relative">
              {[
                { title: "Add New Site", desc: "List new inventory", icon: <PlusCircle/>, color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-600 hover:text-white", link: "/inventory" },
                { title: "Create Campaign", desc: "Start a new booking", icon: <Target/>, color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-600 hover:text-white", link: "/campaigns" },
                { title: "Update Rates", desc: "Modify pricing", icon: <IndianRupee/>, color: "text-green-600", bg: "bg-green-50 hover:bg-green-600 hover:text-white", link: "/inventory" },
                { title: "View Reports", desc: "Check performance", icon: <TrendingUp/>, color: "text-orange-600", bg: "bg-orange-50 hover:bg-orange-600 hover:text-white", link: "#" },
              ].map((q) => (
                <Link
                  key={q.title}
                  to={q.link}
                  className={`border border-gray-100 rounded-xl p-4 transition-all duration-300 group ${q.bg}`}
                >
                  <div className={`mb-3 ${q.color} group-hover:text-white transition-colors`}>{q.icon}</div>
                  <div className="font-bold text-gray-900 group-hover:text-white transition-colors">{q.title}</div>
                  <div className="text-xs text-gray-500 group-hover:text-white/80 transition-colors mt-0.5">{q.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Enhanced Recent Activity */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-6 flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Activity Feed</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {loading && <div className="text-sm text-gray-500 animate-pulse">Fetching latest activities...</div>}
              {!loading && recent.length === 0 && <div className="text-sm text-gray-400 py-4">No recent activity detected.</div>}
              {!loading && recent.length > 0 && (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-100 before:to-transparent">
                  {recent.slice(0, 6).map((r, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group pr-4 md:pr-0">
                      {/* Icon */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-gray-50 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110">
                        {r.icon}
                      </div>
                      {/* Card */}
                      <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Log</span>
                          <span className="text-xs font-semibold text-gray-400">{r.time}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-700 leading-snug">{r.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
