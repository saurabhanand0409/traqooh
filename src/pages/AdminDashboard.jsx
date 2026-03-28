import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requireAuth, signOut } from "../utils/auth";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-700",
  PLANNED: "bg-blue-100 text-blue-700",
  LIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");

  useEffect(() => { requireAuth(navigate, ["ADMIN"]); }, []);

  const [activeTab, setActiveTab] = useState("overview");

  // Data state
  const [summary, setSummary] = useState({});
  const [mediaUsers, setMediaUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Media user modal state
  const [showMUModal, setShowMUModal] = useState(false);
  const [editMU, setEditMU] = useState(null);
  const [muForm, setMUForm] = useState({ email: "", password: "", displayName: "", vendorId: "", isActive: true });
  const [muErr, setMUErr] = useState("");

  // Vendor modal state
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState({ name: "", contactPerson: "", phone: "", email: "", gstNumber: "", address: "", city: "", state: "", notes: "", status: "ACTIVE" });
  const [vendorErr, setVendorErr] = useState("");

  // Advertiser modal state
  const [showAdvModal, setShowAdvModal] = useState(false);
  const [editAdv, setEditAdv] = useState(null);
  const [advForm, setAdvForm] = useState({ companyName: "", contactPerson: "", email: "", phone: "", billingAddress: "", gstNumber: "", notes: "", status: "ACTIVE" });
  const [advErr, setAdvErr] = useState("");

  // Search/filter state
  const [muSearch, setMUSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [campSearch, setCampSearch] = useState("");
  const [advSearch, setAdvSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, muRes, vendRes, invRes, advRes, campRes] = await Promise.all([
        fetch(`${API}/api/dashboard/summary`),
        fetch(`${API}/api/admin/media-users`),
        fetch(`${API}/api/vendors`),
        fetch(`${API}/api/sites`),
        fetch(`${API}/api/advertisers`),
        fetch(`${API}/api/campaigns`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (muRes.ok) setMediaUsers(await muRes.json());
      if (vendRes.ok) setVendors(await vendRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (advRes.ok) setAdvertisers(await advRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Media User CRUD ----
  const openCreateMU = () => {
    setEditMU(null);
    setMUForm({ email: "", password: "", displayName: "", vendorId: "", isActive: true });
    setMUErr("");
    setShowMUModal(true);
  };

  const openEditMU = (mu) => {
    setEditMU(mu);
    setMUForm({ email: mu.email, password: "", displayName: mu.displayName || "", vendorId: mu.vendorId || "", isActive: mu.isActive });
    setMUErr("");
    setShowMUModal(true);
  };

  const handleSaveMU = async (e) => {
    e.preventDefault();
    setMUErr("");
    const isCreate = !editMU;
    if (isCreate && (!muForm.email || !muForm.password)) return setMUErr("Email and password required.");

    const payload = isCreate
      ? { email: muForm.email, password: muForm.password, displayName: muForm.displayName, vendorId: muForm.vendorId ? Number(muForm.vendorId) : null, isActive: muForm.isActive }
      : { displayName: muForm.displayName, isActive: muForm.isActive, vendorId: muForm.vendorId === "" ? -1 : (muForm.vendorId ? Number(muForm.vendorId) : -1), ...(muForm.password ? { password: muForm.password } : {}) };

    const url = isCreate ? `${API}/api/admin/media-users` : `${API}/api/admin/media-users/${editMU.id}`;
    const res = await fetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setShowMUModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setMUErr(d.detail || "Error saving media user"); }
  };

  const handleDeleteMU = async (id, email) => {
    if (!confirm(`Delete media user "${email}"? This cannot be undone.`)) return;
    await fetch(`${API}/api/admin/media-users/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // ---- Vendor CRUD ----
  const openCreateVendor = () => {
    setEditVendor(null);
    setVendorForm({ name: "", contactPerson: "", phone: "", email: "", gstNumber: "", address: "", city: "", state: "", notes: "", status: "ACTIVE" });
    setVendorErr("");
    setShowVendorModal(true);
  };

  const openEditVendor = (v) => {
    setEditVendor(v);
    setVendorForm({ name: v.name, contactPerson: v.contactPerson || "", phone: v.phone || "", email: v.email || "", gstNumber: v.gstNumber || "", address: v.address || "", city: v.city || "", state: v.state || "", notes: v.notes || "", status: v.status || "ACTIVE" });
    setVendorErr("");
    setShowVendorModal(true);
  };

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    setVendorErr("");
    if (!vendorForm.name) return setVendorErr("Vendor name is required.");
    const isCreate = !editVendor;
    const url = isCreate ? `${API}/api/vendors` : `${API}/api/vendors/${editVendor.id}`;
    const res = await fetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vendorForm) });
    if (res.ok) { setShowVendorModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setVendorErr(d.detail || "Error saving vendor"); }
  };

  const handleDeleteVendor = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    const res = await fetch(`${API}/api/vendors/${v.id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
    else alert("Failed to delete vendor");
  };

  // ---- Advertiser CRUD ----
  const openCreateAdv = () => {
    setEditAdv(null);
    setAdvForm({ companyName: "", contactPerson: "", email: "", phone: "", billingAddress: "", gstNumber: "", notes: "", status: "ACTIVE" });
    setAdvErr("");
    setShowAdvModal(true);
  };

  const openEditAdv = (a) => {
    setEditAdv(a);
    setAdvForm({ companyName: a.companyName || "", contactPerson: a.contactPerson || "", email: a.email || "", phone: a.phone || "", billingAddress: a.billingAddress || "", gstNumber: a.gstNumber || "", notes: a.notes || "", status: a.status || "ACTIVE" });
    setAdvErr("");
    setShowAdvModal(true);
  };

  const handleSaveAdv = async (e) => {
    e.preventDefault();
    setAdvErr("");
    if (!advForm.companyName) return setAdvErr("Company name is required.");
    const isCreate = !editAdv;
    const url = isCreate ? `${API}/api/advertisers` : `${API}/api/advertisers/${editAdv.id}`;
    const res = await fetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(advForm) });
    if (res.ok) { setShowAdvModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setAdvErr(d.detail || "Error saving advertiser"); }
  };

  const handleDeleteAdv = async (a) => {
    if (!confirm(`Delete advertiser "${a.companyName}"? This cannot be undone.`)) return;
    const res = await fetch(`${API}/api/advertisers/${a.id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
    else alert("Failed to delete advertiser");
  };

  // ---- Filtered lists ----
  const filteredMU = mediaUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(muSearch.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(muSearch.toLowerCase()) ||
    (u.vendorName || "").toLowerCase().includes(muSearch.toLowerCase())
  );
  const filteredVendors = vendors.filter(v =>
    (v.name || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.city || "").toLowerCase().includes(vendorSearch.toLowerCase())
  );
  const filteredInv = inventory.filter(s =>
    (s.name || "").toLowerCase().includes(invSearch.toLowerCase()) ||
    (s.city || "").toLowerCase().includes(invSearch.toLowerCase())
  );
  const filteredCamp = campaigns.filter(c =>
    (c.name || "").toLowerCase().includes(campSearch.toLowerCase()) ||
    (c.advertiserName || "").toLowerCase().includes(campSearch.toLowerCase())
  );
  const filteredAdv = advertisers.filter(a =>
    (a.companyName || "").toLowerCase().includes(advSearch.toLowerCase()) ||
    (a.email || "").toLowerCase().includes(advSearch.toLowerCase())
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "media-users", label: "Media Users", icon: "👤" },
    { id: "vendors", label: "Vendors", icon: "🏢" },
    { id: "inventory", label: "Inventory", icon: "📍" },
    { id: "advertisers", label: "Advertisers", icon: "📢" },
    { id: "campaigns", label: "Campaigns", icon: "🎯" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/admin" className="text-xl font-bold text-blue-700">traqOOH</Link>
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden md:block">{user.displayName || user.email}</span>
            <button onClick={() => signOut(navigate)} className="text-xs text-gray-500 hover:text-red-500 border px-3 py-1 rounded-lg">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage media users, vendors, and monitor platform activity</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Media Users", value: summary.totalMediaUsers ?? mediaUsers.length, icon: "👤", color: "bg-blue-50 text-blue-700" },
                { label: "Vendors", value: summary.totalVendors ?? vendors.length, icon: "🏢", color: "bg-indigo-50 text-indigo-700" },
                { label: "Total Inventory", value: summary.totalSites ?? inventory.length, icon: "📍", color: "bg-green-50 text-green-700" },
                { label: "Active Advertisers", value: summary.activeAdvertisers ?? 0, icon: "📢", color: "bg-yellow-50 text-yellow-700" },
                { label: "Running Campaigns", value: summary.liveCampaigns ?? 0, icon: "🎯", color: "bg-purple-50 text-purple-700" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-3">
                  <span className={`h-10 w-10 rounded-xl grid place-items-center text-lg ${s.color}`}>{s.icon}</span>
                  <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-gray-500 leading-tight">{s.label}</div></div>
                </div>
              ))}
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Unassigned Media Users", value: summary.unassignedMediaUsers ?? 0, color: "text-orange-600" },
                { label: "Vendors With No Inventory", value: summary.vendorsWithNoInventory ?? 0, color: "text-gray-500" },
                { label: "Inventory Without Vendor", value: summary.inventoryWithoutVendor ?? 0, color: "text-gray-500" },
                { label: "Added This Month", value: summary.inventoryThisMonth ?? 0, color: "text-blue-600" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent tables */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Recent Media Users</h2>
                  <button onClick={() => setActiveTab("media-users")} className="text-xs text-blue-600 hover:underline">View all →</button>
                </div>
                {mediaUsers.slice(0, 6).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{u.displayName || u.email}</p>
                      <p className="text-xs text-gray-400">{u.vendorName ? `📦 ${u.vendorName}` : "No vendor assigned"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                  </div>
                ))}
                {mediaUsers.length === 0 && <p className="text-gray-400 text-sm">No media users yet</p>}
              </div>

              <div className="bg-white rounded-2xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Recent Campaigns</h2>
                  <button onClick={() => setActiveTab("campaigns")} className="text-xs text-blue-600 hover:underline">View all →</button>
                </div>
                {campaigns.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.advertiserName || "—"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                  </div>
                ))}
                {campaigns.length === 0 && <p className="text-gray-400 text-sm">No campaigns yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MEDIA USERS TAB ==================== */}
        {activeTab === "media-users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Media User Accounts</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage field team members and their vendor assignments</p>
              </div>
              <button onClick={openCreateMU} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shrink-0">
                + Create Media User
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm">
              <span className="text-gray-400">🔍</span>
              <input value={muSearch} onChange={e => setMUSearch(e.target.value)} placeholder="Search by name, email or vendor..." className="flex-1 outline-none text-sm" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Assigned Vendor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMU.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{u.displayName || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.vendorName
                          ? <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{u.vendorName}</span>
                          : <span className="text-gray-400 text-xs">No vendor</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openEditMU(u)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => handleDeleteMU(u.id, u.email)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filteredMU.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">
                      {muSearch ? "No media users match your search." : `No media users yet. Click "+ Create Media User" to add one.`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== VENDORS TAB ==================== */}
        {activeTab === "vendors" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Vendors</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage all vendor companies. Deleting a vendor unlinks its media users and inventory.</p>
              </div>
              <button onClick={openCreateVendor} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shrink-0">
                + Add Vendor
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm">
              <span className="text-gray-400">🔍</span>
              <input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendors..." className="flex-1 outline-none text-sm" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3 text-center">Media Users</th>
                    <th className="px-4 py-3 text-center">Inventory</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredVendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {v.contactPerson || "—"}
                        {v.phone && <div className="text-xs text-gray-400">{v.phone}</div>}
                      </td>
                      <td className="px-4 py-3">{v.city || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{v.mediaUserCount ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">{v.siteCount ?? 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${v.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{v.status}</span>
                      </td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openEditVendor(v)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => handleDeleteVendor(v)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filteredVendors.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">
                      {vendorSearch ? "No vendors match your search." : "No vendors yet."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== INVENTORY TAB ==================== */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Inventory</h2>
              <p className="text-xs text-gray-500 mt-0.5">View and manage all inventory across vendors and media users.</p>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm">
              <span className="text-gray-400">🔍</span>
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search by site name or city..." className="flex-1 outline-none text-sm" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Site Name</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Assigned Vendor</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInv.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.city}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">{s.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.owner?.name
                          ? <span className="text-blue-700 text-xs font-medium">{s.owner.name}</span>
                          : <span className="text-gray-400 text-xs">No vendor</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.availabilityStatus === "AVAILABLE" ? "bg-green-100 text-green-700" : s.availabilityStatus === "BOOKED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {s.availabilityStatus || "AVAILABLE"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => {
                          if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
                          const res = await fetch(`${API}/api/sites/${s.id}`, { method: "DELETE" });
                          if (res.ok) fetchAll();
                        }} className="text-red-500 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filteredInv.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No inventory found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== ADVERTISERS TAB ==================== */}
        {activeTab === "advertisers" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Advertisers</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage all advertiser accounts.</p>
              </div>
              <button onClick={openCreateAdv} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shrink-0">
                + Add Advertiser
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm">
              <span className="text-gray-400">🔍</span>
              <input value={advSearch} onChange={e => setAdvSearch(e.target.value)} placeholder="Search by company or email..." className="flex-1 outline-none text-sm" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAdv.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{a.companyName}</td>
                      <td className="px-4 py-3 text-gray-500">{a.contactPerson || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{a.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{a.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{a.status}</span>
                      </td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openEditAdv(a)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => handleDeleteAdv(a)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdv.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                      {advSearch ? "No advertisers match your search." : "No advertisers yet. Click \"+ Add Advertiser\" to create one."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== CAMPAIGNS TAB (READ-ONLY) ==================== */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Campaigns</h2>
              <p className="text-xs text-gray-500 mt-0.5">Monitoring view only. Campaigns are created and managed by media users.</p>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm">
              <span className="text-gray-400">🔍</span>
              <input value={campSearch} onChange={e => setCampSearch(e.target.value)} placeholder="Search campaigns..." className="flex-1 outline-none text-sm" />
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Advertiser</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCamp.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.advertiserName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.startDate || "—"} → {c.endDate || "—"}</td>
                      <td className="px-4 py-3 font-medium">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/campaigns/${c.id}`} className="text-blue-600 text-xs hover:underline">View →</Link>
                      </td>
                    </tr>
                  ))}
                  {filteredCamp.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                      {campSearch ? "No campaigns match your search." : "No campaigns yet"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MEDIA USER MODAL ==================== */}
      {showMUModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSaveMU} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">{editMU ? "Edit Media User" : "Create Media User"}</h2>
            {editMU && <p className="text-sm text-gray-500">{editMU.email}</p>}
            {muErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{muErr}</div>}

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Full Name</label>
              <input value={muForm.displayName} onChange={e => setMUForm({ ...muForm, displayName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Rahul Sharma" />
            </div>

            {!editMU && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email *</label>
                <input type="email" value={muForm.email} onChange={e => setMUForm({ ...muForm, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
                Password {editMU && <span className="text-gray-400">(leave blank to keep current)</span>}
              </label>
              <input type="password" value={muForm.password} onChange={e => setMUForm({ ...muForm, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={editMU ? "Enter new password..." : ""} required={!editMU} />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Assigned Vendor</label>
              <select value={muForm.vendorId} onChange={e => setMUForm({ ...muForm, vendorId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">No Vendor Assigned</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
              <select value={muForm.isActive} onChange={e => setMUForm({ ...muForm, isActive: e.target.value === "true" })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">
                {editMU ? "Save Changes" : "Create"}
              </button>
              <button type="button" onClick={() => setShowMUModal(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== VENDOR MODAL ==================== */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSaveVendor} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">{editVendor ? "Edit Vendor" : "Add Vendor"}</h2>
            {vendorErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{vendorErr}</div>}

            {[["name","Company Name *"],["contactPerson","Contact Person"],["phone","Phone"],["email","Email"],["gstNumber","GST Number"],["address","Address"],["city","City"],["state","State"]].map(([k, l]) => (
              <div key={k}>
                <label className="text-xs font-medium text-gray-500 block mb-1">{l}</label>
                <input value={vendorForm[k]} onChange={e => setVendorForm({ ...vendorForm, [k]: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required={k === "name"} />
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
              <textarea value={vendorForm.notes} onChange={e => setVendorForm({ ...vendorForm, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
              <select value={vendorForm.status} onChange={e => setVendorForm({ ...vendorForm, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">{editVendor ? "Update" : "Create"}</button>
              <button type="button" onClick={() => setShowVendorModal(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== ADVERTISER MODAL ==================== */}
      {showAdvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSaveAdv} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">{editAdv ? "Edit Advertiser" : "Add Advertiser"}</h2>
            {advErr && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{advErr}</div>}

            {[["companyName","Company Name *"],["contactPerson","Contact Person"],["email","Email"],["phone","Phone"],["billingAddress","Billing Address"],["gstNumber","GST Number"]].map(([k, l]) => (
              <div key={k}>
                <label className="text-xs font-medium text-gray-500 block mb-1">{l}</label>
                <input value={advForm[k]} onChange={e => setAdvForm({ ...advForm, [k]: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required={k === "companyName"} />
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
              <textarea value={advForm.notes} onChange={e => setAdvForm({ ...advForm, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
              <select value={advForm.status} onChange={e => setAdvForm({ ...advForm, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">{editAdv ? "Update" : "Create"}</button>
              <button type="button" onClick={() => setShowAdvModal(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
