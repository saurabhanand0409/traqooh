import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requireAuth, signOut } from "../utils/auth";
import AdminNav from "../components/AdminNav";
import UserMenu from "../components/UserMenu";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");

  useEffect(() => {
    requireAuth(navigate, ["ADMIN"]);
  }, []);

  const [employees, setEmployees] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [formErr, setFormErr] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // overview | employees | campaigns

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, campRes, summRes] = await Promise.all([
        fetch(`${API}/api/admin/employees`),
        fetch(`${API}/api/campaigns`),
        fetch(`${API}/api/dashboard/summary`),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
      if (summRes.ok) setSummary(await summRes.json());
    } catch {}
    setLoading(false);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setFormErr("");
    if (!form.email || !form.password) return setFormErr("Email and password are required.");
    const res = await fetch(`${API}/api/admin/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password, displayName: form.displayName }),
    });
    if (res.ok) {
      setShowCreateModal(false);
      setForm({ email: "", password: "", displayName: "" });
      fetchAll();
    } else {
      const d = await res.json().catch(() => ({}));
      setFormErr(d.detail || "Error creating employee");
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    setFormErr("");
    const payload = { displayName: form.displayName };
    if (form.password) payload.password = form.password;
    const res = await fetch(`${API}/api/admin/employees/${editEmployee.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowEditModal(false);
      setEditEmployee(null);
      fetchAll();
    } else {
      const d = await res.json().catch(() => ({}));
      setFormErr(d.detail || "Error updating employee");
    }
  };

  const handleDeleteEmployee = async (id, email) => {
    if (!confirm(`Delete employee ${email}? This cannot be undone.`)) return;
    await fetch(`${API}/api/admin/employees/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const openEdit = (emp) => {
    setEditEmployee(emp);
    setForm({ email: emp.email, password: "", displayName: emp.displayName || "" });
    setFormErr("");
    setShowEditModal(true);
  };

  const statusColors = { DRAFT: "bg-gray-200 text-gray-700", PLANNED: "bg-blue-100 text-blue-700", LIVE: "bg-green-100 text-green-700", COMPLETED: "bg-purple-100 text-purple-700", CANCELLED: "bg-red-100 text-red-700" };

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "employees", label: "Employees", icon: "👤" },
    { id: "campaigns", label: "Campaigns", icon: "🎯" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/admin" className="text-xl font-bold text-blue-700">traqOOH</Link>
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <AdminNav user={user} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.displayName || user.email}</span>
            <button onClick={() => signOut(navigate)} className="text-xs text-gray-500 hover:text-red-500 border px-3 py-1 rounded-lg">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage employees, monitor campaigns, and control access</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Employees", value: employees.length, icon: "👤", color: "bg-blue-50 text-blue-700" },
                { label: "Total Sites", value: summary.totalSites || 0, icon: "📍", color: "bg-green-50 text-green-700" },
                { label: "Live Campaigns", value: summary.liveCampaigns || 0, icon: "🎯", color: "bg-purple-50 text-purple-700" },
                { label: "Pending Audits", value: summary.pendingAudits || 0, icon: "📋", color: "bg-orange-50 text-orange-700" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border p-5 shadow-sm flex items-center gap-4">
                  <span className={`h-12 w-12 rounded-xl grid place-items-center text-xl ${s.color}`}>{s.icon}</span>
                  <div><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent employees */}
              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <h2 className="font-semibold mb-3">Recent Employees</h2>
                {employees.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div><p className="text-sm font-medium">{e.displayName || e.email}</p><p className="text-xs text-gray-400">{e.email}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${e.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{e.isActive ? "Active" : "Inactive"}</span>
                  </div>
                ))}
                {employees.length === 0 && <p className="text-gray-400 text-sm">No employees yet</p>}
              </div>
              {/* Recent campaigns */}
              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <h2 className="font-semibold mb-3">Recent Campaigns</h2>
                {campaigns.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-gray-400">{c.advertiserName}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[c.status] || "bg-gray-200 text-gray-600"}`}>{c.status}</span>
                  </div>
                ))}
                {campaigns.length === 0 && <p className="text-gray-400 text-sm">No campaigns yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* EMPLOYEES TAB */}
        {activeTab === "employees" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Employee Accounts</h2>
              <button onClick={() => { setForm({ email: "", password: "", displayName: "" }); setFormErr(""); setShowCreateModal(true); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
                + Create Employee
              </button>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{emp.displayName || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openEdit(emp)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => handleDeleteEmployee(emp.id, emp.email)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">No employees found. Click "Create Employee" to add one.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CAMPAIGNS TAB */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">All Campaigns</h2>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Advertiser</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.advertiserName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.startDate || "—"} → {c.endDate || "—"}</td>
                      <td className="px-4 py-3 font-medium">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[c.status] || ""}`}>{c.status}</span></td>
                      <td className="px-4 py-3"><Link to={`/campaigns/${c.id}`} className="text-blue-600 text-xs hover:underline">View →</Link></td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No campaigns yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreateEmployee} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Create Employee Account</h2>
            {formErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formErr}</div>}
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Full Name</label><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Rahul Sharma" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Password *</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleUpdateEmployee} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Edit Employee</h2>
            <p className="text-sm text-gray-500">{editEmployee.email}</p>
            {formErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formErr}</div>}
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Full Name</label><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">New Password <span className="text-gray-400">(leave blank to keep current)</span></label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter new password..." /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">Save</button>
              <button type="button" onClick={() => { setShowEditModal(false); setEditEmployee(null); }} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
