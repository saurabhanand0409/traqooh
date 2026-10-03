import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/apiFetch";
import { Link, useNavigate } from "react-router-dom";
import { requireAuth } from "../utils/auth";
import AppShell from "../components/AppShell";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const STATUS_COLORS = {
  DRAFT:     "badge-draft",
  PLANNED:   "badge-planned",
  LIVE:      "badge-live",
  COMPLETED: "badge-completed",
  CANCELLED: "bg-red-500/15 text-red-400 border border-red-500/20",
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

  // Field pins state
  const [fieldPins, setFieldPins] = useState([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinForm, setPinForm] = useState({ workerName: "", vendorId: "" });
  const [pinErr, setPinErr] = useState("");
  const [newPinResult, setNewPinResult] = useState(null);

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
      const [sumRes, muRes, vendRes, invRes, advRes, campRes, pinsRes] = await Promise.all([
        apiFetch(`/api/dashboard/summary`),
        apiFetch(`/api/admin/media-users`),
        apiFetch(`/api/vendors`),
        apiFetch(`/api/sites`),
        apiFetch(`/api/advertisers`),
        apiFetch(`/api/campaigns`),
        apiFetch(`/api/admin/field-pins${user.email ? `?admin_email=${encodeURIComponent(user.email)}` : ""}`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (muRes.ok) setMediaUsers(await muRes.json());
      if (vendRes.ok) setVendors(await vendRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (advRes.ok) setAdvertisers(await advRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
      if (pinsRes.ok) setFieldPins(await pinsRes.json());
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

    const url = isCreate ? "/api/admin/media-users" : `/api/admin/media-users/${editMU.id}`;
    const res = await apiFetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setShowMUModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setMUErr(d.detail || "Error saving media user"); }
  };

  const handleDeleteMU = async (id, email) => {
    if (!confirm(`Delete media user "${email}"? This cannot be undone.`)) return;
    await apiFetch(`/api/admin/media-users/${id}`, { method: "DELETE" });
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
    const url = isCreate ? "/api/vendors" : `/api/vendors/${editVendor.id}`;
    const res = await apiFetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vendorForm) });
    if (res.ok) { setShowVendorModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setVendorErr(d.detail || "Error saving vendor"); }
  };

  const handleDeleteVendor = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/vendors/${v.id}`, { method: "DELETE" });
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
    const url = isCreate ? "/api/advertisers" : `/api/advertisers/${editAdv.id}`;
    const res = await apiFetch(url, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(advForm) });
    if (res.ok) { setShowAdvModal(false); fetchAll(); }
    else { const d = await res.json().catch(() => ({})); setAdvErr(d.detail || "Error saving advertiser"); }
  };

  const handleDeleteAdv = async (a) => {
    if (!confirm(`Delete advertiser "${a.companyName}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/advertisers/${a.id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
    else alert("Failed to delete advertiser");
  };

  // ---- Field PIN handlers ----
  const openCreatePin = () => {
    setPinForm({ workerName: "", vendorId: "" });
    setPinErr("");
    setNewPinResult(null);
    setShowPinModal(true);
  };

  const handleCreatePin = async (e) => {
    e.preventDefault();
    setPinErr("");
    if (!pinForm.workerName.trim()) return setPinErr("Worker name is required.");
    const res = await apiFetch(`/api/admin/field-pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: pinForm.workerName.trim(),
        vendorId: pinForm.vendorId ? Number(pinForm.vendorId) : null,
        adminEmail: user.email || "",
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setNewPinResult(created);
      fetchAll();
    } else {
      const d = await res.json().catch(() => ({}));
      setPinErr(d.detail || "Failed to create PIN");
    }
  };

  const handleRevokePin = async (id, workerName) => {
    if (!confirm(`Revoke PIN for "${workerName}"? They will be logged out immediately.`)) return;
    await apiFetch(`/api/admin/field-pins/${id}`, { method: "DELETE" });
    fetchAll();
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
    { id: "overview",     label: "Overview",     icon: "📊" },
    { id: "media-users",  label: "Media Users",  icon: "👤" },
    { id: "vendors",      label: "Vendors",       icon: "🏢" },
    { id: "inventory",    label: "Inventory",     icon: "📍" },
    { id: "advertisers",  label: "Advertisers",   icon: "📢" },
    { id: "campaigns",    label: "Campaigns",     icon: "🎯" },
    { id: "field-access", label: "Field Access",  icon: "🔑" },
  ];

  // Reusable dark table header
  const TH = ({ children }) => (
    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{children}</th>
  );

  // Reusable dark table row hover
  const trHover = {
    onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent",
  };

  // Reusable action button styles
  const editBtn = (onClick) => (
    <button onClick={onClick} className="text-xs font-semibold transition" style={{ color: "#3B82F6" }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>Edit</button>
  );
  const delBtn = (onClick) => (
    <button onClick={onClick} className="text-xs font-semibold transition" style={{ color: "#F87171" }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>Delete</button>
  );

  // Search bar
  const SearchBar = ({ value, onChange, placeholder }) => (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--gray2)" }}>🔍</span>
      <input value={value} onChange={onChange} placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#fff" }} />
    </div>
  );

  // Modal error box
  const ErrBox = ({ msg }) => msg ? (
    <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{msg}</div>
  ) : null;

  // Modal field label
  const FL = ({ children }) => (
    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>{children}</label>
  );

  // Modal submit / cancel footer
  const ModalFooter = ({ onCancel, submitLabel = "Save" }) => (
    <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
      <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>{submitLabel}</button>
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
    </div>
  );

  // Dark modal wrapper
  const ModalWrap = ({ onClose, title, children, maxW = "max-w-md", isForm = true, onSubmit }) => {
    const Tag = isForm ? "form" : "div";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <Tag {...(isForm && onSubmit ? { onSubmit } : {})}
          className={`rounded-2xl w-full ${maxW} overflow-hidden flex flex-col`}
          style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-syne font-bold text-xl text-white">{title}</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>✕</button>
          </div>
          {children}
        </Tag>
      </div>
    );
  };

  return (
    <AppShell user={user}>
      <div>
        <h1 className="font-syne font-extrabold text-2xl text-white mb-0.5">Admin Dashboard</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gray2)" }}>Manage media users, vendors, and monitor platform activity</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition"
            style={activeTab === t.id
              ? { borderColor: "#2563EB", color: "#3B82F6" }
              : { borderColor: "transparent", color: "var(--gray2)" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Media Users",       value: summary.totalMediaUsers    ?? mediaUsers.length,  icon: "👤", accent: "#2563EB" },
              { label: "Vendors",           value: summary.totalVendors       ?? vendors.length,     icon: "🏢", accent: "#6366F1" },
              { label: "Total Inventory",   value: summary.totalSites         ?? inventory.length,   icon: "📍", accent: "#22C55E" },
              { label: "Active Advertisers",value: summary.activeAdvertisers  ?? 0,                  icon: "📢", accent: "#F59E0B" },
              { label: "Running Campaigns", value: summary.liveCampaigns      ?? 0,                  icon: "🎯", accent: "#8B5CF6" },
            ].map(s => (
              <div key={s.label} className="glass rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: `${s.accent}22`, color: s.accent }}>{s.icon}</div>
                <div>
                  <div className="font-syne font-extrabold text-xl text-white">{loading ? "—" : s.value}</div>
                  <div className="text-xs leading-tight" style={{ color: "var(--gray2)" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Unassigned Media Users",    value: summary.unassignedMediaUsers    ?? 0, accent: "#F59E0B" },
              { label: "Vendors With No Inventory", value: summary.vendorsWithNoInventory  ?? 0, accent: "#6B7280" },
              { label: "Inventory Without Vendor",  value: summary.inventoryWithoutVendor  ?? 0, accent: "#6B7280" },
              { label: "Added This Month",          value: summary.inventoryThisMonth      ?? 0, accent: "#2563EB" },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl p-4">
                <div className="font-syne font-extrabold text-2xl mb-0.5" style={{ color: s.accent }}>{loading ? "—" : s.value}</div>
                <div className="text-xs" style={{ color: "var(--gray2)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent lists */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-syne font-bold text-white">Recent Media Users</p>
                <button onClick={() => setActiveTab("media-users")} className="text-xs hover:underline transition" style={{ color: "#3B82F6" }}>View all →</button>
              </div>
              {mediaUsers.slice(0, 6).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-medium text-white">{u.displayName || u.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{u.vendorName ? `📦 ${u.vendorName}` : "No vendor assigned"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isActive ? "badge-live" : "badge-draft"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                </div>
              ))}
              {mediaUsers.length === 0 && <p className="text-sm" style={{ color: "var(--gray2)" }}>No media users yet</p>}
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-syne font-bold text-white">Recent Campaigns</p>
                <button onClick={() => setActiveTab("campaigns")} className="text-xs hover:underline transition" style={{ color: "#3B82F6" }}>View all →</button>
              </div>
              {campaigns.slice(0, 6).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{c.advertiserName || "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] || "badge-draft"}`}>{c.status}</span>
                </div>
              ))}
              {campaigns.length === 0 && <p className="text-sm" style={{ color: "var(--gray2)" }}>No campaigns yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MEDIA USERS ==================== */}
      {activeTab === "media-users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne font-bold text-xl text-white">Media User Accounts</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Manage field team members and their vendor assignments</p>
            </div>
            <button onClick={openCreateMU} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:brightness-110 shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
              + Create Media User
            </button>
          </div>
          <SearchBar value={muSearch} onChange={e => setMUSearch(e.target.value)} placeholder="Search by name, email or vendor..." />
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Name</TH><TH>Email</TH><TH>Assigned Vendor</TH><TH>Status</TH><TH>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filteredMU.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3 font-medium text-white">{u.displayName || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{u.email}</td>
                    <td className="px-4 py-3">
                      {u.vendorName
                        ? <span className="badge-planned text-xs px-2 py-0.5 rounded-full font-medium">{u.vendorName}</span>
                        : <span className="text-xs" style={{ color: "var(--gray2)" }}>No vendor</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isActive ? "badge-live" : "badge-draft"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">{editBtn(() => openEditMU(u))}{delBtn(() => handleDeleteMU(u.id, u.email))}</div>
                    </td>
                  </tr>
                ))}
                {filteredMU.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>
                    {muSearch ? "No media users match your search." : "No media users yet."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== VENDORS ==================== */}
      {activeTab === "vendors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne font-bold text-xl text-white">Vendors</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Manage all vendor companies. Deleting a vendor unlinks its media users and inventory.</p>
            </div>
            <button onClick={openCreateVendor} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:brightness-110 shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
              + Add Vendor
            </button>
          </div>
          <SearchBar value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendors..." />
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Vendor</TH><TH>Contact</TH><TH>City</TH><TH>Media Users</TH><TH>Inventory</TH><TH>Status</TH><TH>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map(v => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3 font-medium text-white">{v.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>
                      {v.contactPerson || "—"}
                      {v.phone && <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{v.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-white">{v.city || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge-planned text-xs px-2 py-0.5 rounded-full font-semibold">{v.mediaUserCount ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge-live text-xs px-2 py-0.5 rounded-full font-semibold">{v.siteCount ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${v.status === "ACTIVE" ? "badge-live" : "badge-draft"}`}>{v.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">{editBtn(() => openEditVendor(v))}{delBtn(() => handleDeleteVendor(v))}</div>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>
                    {vendorSearch ? "No vendors match your search." : "No vendors yet."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== INVENTORY ==================== */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-syne font-bold text-xl text-white">Inventory</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>View and manage all inventory across vendors and media users.</p>
          </div>
          <SearchBar value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search by site name or city..." />
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Site Name</TH><TH>City</TH><TH>Type</TH><TH>Assigned Vendor</TH><TH>Availability</TH><TH>Status</TH><TH>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filteredInv.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{s.city}</td>
                    <td className="px-4 py-3">
                      <span className="badge-draft text-xs px-2 py-0.5 rounded">{s.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.owner?.name
                        ? <span className="badge-planned text-xs font-medium px-2 py-0.5 rounded-full">{s.owner.name}</span>
                        : <span className="text-xs" style={{ color: "var(--gray2)" }}>No vendor</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        s.availabilityStatus === "AVAILABLE" ? "badge-live" :
                        s.availabilityStatus === "BOOKED"    ? "badge-booked" : "badge-pending"
                      }`}>{s.availabilityStatus || "AVAILABLE"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "Active" ? "badge-live" : "badge-draft"}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {delBtn(async () => {
                        if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
                        const res = await apiFetch(`/api/sites/${s.id}`, { method: "DELETE" });
                        if (res.ok) fetchAll();
                      })}
                    </td>
                  </tr>
                ))}
                {filteredInv.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>No inventory found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== ADVERTISERS ==================== */}
      {activeTab === "advertisers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne font-bold text-xl text-white">Advertisers</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Manage all advertiser accounts.</p>
            </div>
            <button onClick={openCreateAdv} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:brightness-110 shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
              + Add Advertiser
            </button>
          </div>
          <SearchBar value={advSearch} onChange={e => setAdvSearch(e.target.value)} placeholder="Search by company or email..." />
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Company</TH><TH>Contact Person</TH><TH>Email</TH><TH>Phone</TH><TH>Status</TH><TH>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filteredAdv.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3 font-medium text-white">{a.companyName}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{a.contactPerson || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{a.email || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{a.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.status === "ACTIVE" ? "badge-live" : "badge-draft"}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">{editBtn(() => openEditAdv(a))}{delBtn(() => handleDeleteAdv(a))}</div>
                    </td>
                  </tr>
                ))}
                {filteredAdv.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>
                    {advSearch ? "No advertisers match your search." : "No advertisers yet."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FIELD ACCESS ==================== */}
      {activeTab === "field-access" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-syne font-bold text-xl text-white">Field Access</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>
                Generate 4-digit PINs for field workers to log into the mobile app. PINs expire automatically in 72 hours.
              </p>
            </div>
            <button onClick={openCreatePin} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:brightness-110 shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
              + Generate PIN
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Worker Name</TH><TH>PIN</TH><TH>Vendor</TH><TH>Created</TH><TH>Expires In</TH><TH>Status</TH><TH>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {fieldPins.map(p => {
                  const expired = p.hoursLeft === 0;
                  const statusLabel = !p.isActive ? "Revoked" : expired ? "Expired" : "Active";
                  const statusCls   = !p.isActive ? "badge-booked" : expired ? "badge-draft" : "badge-live";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", opacity: (!p.isActive || expired) ? 0.55 : 1 }} {...trHover}>
                      <td className="px-4 py-3 font-medium text-white">{p.workerName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-lg font-bold tracking-widest" style={{ color: "#60A5FA" }}>{p.pin}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{p.vendorName || "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--gray2)" }}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-white">{(!p.isActive || expired) ? "—" : `${p.hoursLeft}h`}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p.isActive && !expired && delBtn(() => handleRevokePin(p.id, p.workerName))}
                      </td>
                    </tr>
                  );
                })}
                {fieldPins.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>
                    No PINs generated yet. Click "+ Generate PIN" to create one for a field worker.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== CAMPAIGNS (read-only) ==================== */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-syne font-bold text-xl text-white">Campaigns</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Monitoring view only. Campaigns are created and managed by media users.</p>
          </div>
          <SearchBar value={campSearch} onChange={e => setCampSearch(e.target.value)} placeholder="Search campaigns..." />
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <TH>Campaign</TH><TH>Advertiser</TH><TH>Dates</TH><TH>Cost</TH><TH>Status</TH><TH></TH>
                </tr>
              </thead>
              <tbody>
                {filteredCamp.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{c.advertiserName || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--gray2)" }}>{c.startDate || "—"} → {c.endDate || "—"}</td>
                    <td className="px-4 py-3 font-medium text-white">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] || "badge-draft"}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/campaigns/${c.id}`} className="text-xs font-semibold hover:underline transition" style={{ color: "#3B82F6" }}>View →</Link>
                    </td>
                  </tr>
                ))}
                {filteredCamp.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>
                    {campSearch ? "No campaigns match your search." : "No campaigns yet"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MEDIA USER MODAL ==================== */}
      {showMUModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveMU} className="rounded-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-xl text-white">{editMU ? "Edit Media User" : "Create Media User"}</h2>
              <button type="button" onClick={() => setShowMUModal(false)} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editMU && <p className="text-sm" style={{ color: "var(--gray2)" }}>{editMU.email}</p>}
              <ErrBox msg={muErr} />
              <div><FL>Full Name</FL><input value={muForm.displayName} onChange={e => setMUForm({ ...muForm, displayName: e.target.value })} className="tq-input" placeholder="e.g. Rahul Sharma" /></div>
              {!editMU && <div><FL>Email *</FL><input type="email" value={muForm.email} onChange={e => setMUForm({ ...muForm, email: e.target.value })} className="tq-input" required /></div>}
              <div>
                <FL>Password {editMU && <span style={{ fontWeight: 400, color: "var(--gray2)" }}>(leave blank to keep current)</span>}</FL>
                <input type="password" value={muForm.password} onChange={e => setMUForm({ ...muForm, password: e.target.value })} className="tq-input" placeholder={editMU ? "Enter new password..." : ""} required={!editMU} />
              </div>
              <div><FL>Assigned Vendor</FL>
                <select value={muForm.vendorId} onChange={e => setMUForm({ ...muForm, vendorId: e.target.value })} className="tq-input">
                  <option value="">No Vendor Assigned</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
                </select>
              </div>
              <div><FL>Status</FL>
                <select value={muForm.isActive} onChange={e => setMUForm({ ...muForm, isActive: e.target.value === "true" })} className="tq-input">
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <ModalFooter onCancel={() => setShowMUModal(false)} submitLabel={editMU ? "Save Changes" : "Create"} />
          </form>
        </div>
      )}

      {/* ==================== VENDOR MODAL ==================== */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveVendor} className="rounded-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-xl text-white">{editVendor ? "Edit Vendor" : "Add Vendor"}</h2>
              <button type="button" onClick={() => setShowVendorModal(false)} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <ErrBox msg={vendorErr} />
              {[["name","Company Name *"],["contactPerson","Contact Person"],["phone","Phone"],["email","Email"],["gstNumber","GST Number"],["address","Address"],["city","City"],["state","State"]].map(([k, l]) => (
                <div key={k}><FL>{l}</FL><input value={vendorForm[k]} onChange={e => setVendorForm({ ...vendorForm, [k]: e.target.value })} className="tq-input" required={k === "name"} /></div>
              ))}
              <div><FL>Notes</FL><textarea value={vendorForm.notes} onChange={e => setVendorForm({ ...vendorForm, notes: e.target.value })} className="tq-input resize-none" rows={2} /></div>
              <div><FL>Status</FL>
                <select value={vendorForm.status} onChange={e => setVendorForm({ ...vendorForm, status: e.target.value })} className="tq-input">
                  <option>ACTIVE</option><option>INACTIVE</option>
                </select>
              </div>
            </div>
            <ModalFooter onCancel={() => setShowVendorModal(false)} submitLabel={editVendor ? "Update" : "Create"} />
          </form>
        </div>
      )}

      {/* ==================== ADVERTISER MODAL ==================== */}
      {showAdvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveAdv} className="rounded-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-xl text-white">{editAdv ? "Edit Advertiser" : "Add Advertiser"}</h2>
              <button type="button" onClick={() => setShowAdvModal(false)} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <ErrBox msg={advErr} />
              {[["companyName","Company Name *"],["contactPerson","Contact Person"],["email","Email"],["phone","Phone"],["billingAddress","Billing Address"],["gstNumber","GST Number"]].map(([k, l]) => (
                <div key={k}><FL>{l}</FL><input value={advForm[k]} onChange={e => setAdvForm({ ...advForm, [k]: e.target.value })} className="tq-input" required={k === "companyName"} /></div>
              ))}
              <div><FL>Notes</FL><textarea value={advForm.notes} onChange={e => setAdvForm({ ...advForm, notes: e.target.value })} className="tq-input resize-none" rows={2} /></div>
              <div><FL>Status</FL>
                <select value={advForm.status} onChange={e => setAdvForm({ ...advForm, status: e.target.value })} className="tq-input">
                  <option>ACTIVE</option><option>INACTIVE</option>
                </select>
              </div>
            </div>
            <ModalFooter onCancel={() => setShowAdvModal(false)} submitLabel={editAdv ? "Update" : "Create"} />
          </form>
        </div>
      )}

      {/* ==================== FIELD PIN MODAL ==================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          {newPinResult ? (
            <div className="rounded-2xl w-full max-w-sm text-center p-8" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
              <div className="text-4xl mb-3">🔑</div>
              <h2 className="font-syne font-bold text-xl text-white mb-1">PIN Generated!</h2>
              <p className="text-sm mb-6" style={{ color: "var(--gray2)" }}>Share this PIN with <strong className="text-white">{newPinResult.workerName}</strong></p>
              <div className="rounded-2xl py-8 mb-4" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)" }}>
                <div className="text-5xl font-black tracking-[0.3em] font-mono" style={{ color: "#60A5FA" }}>{newPinResult.pin}</div>
                <div className="text-xs mt-2" style={{ color: "var(--gray2)" }}>Valid for 72 hours</div>
              </div>
              <p className="text-xs mb-5" style={{ color: "var(--gray2)" }}>This PIN will not be shown again. Note it down before closing.</p>
              <button onClick={() => { setShowPinModal(false); setNewPinResult(null); }}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition hover:brightness-110"
                style={{ background: "#2563EB" }}>Done</button>
            </div>
          ) : (
            <form onSubmit={handleCreatePin} className="rounded-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="font-syne font-bold text-xl text-white">Generate Field PIN</h2>
                <button type="button" onClick={() => setShowPinModal(false)} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>✕</button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm" style={{ color: "var(--gray2)" }}>A random 4-digit PIN will be generated for this worker. Expires in 72 hours.</p>
                <ErrBox msg={pinErr} />
                <div><FL>Worker Name *</FL>
                  <input value={pinForm.workerName} onChange={e => setPinForm({ ...pinForm, workerName: e.target.value })} className="tq-input" placeholder="e.g. Ramesh Kumar" required autoFocus />
                </div>
                <div><FL>Assign to Vendor (optional)</FL>
                  <select value={pinForm.vendorId} onChange={e => setPinForm({ ...pinForm, vendorId: e.target.value })} className="tq-input">
                    <option value="">No Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
                  </select>
                </div>
              </div>
              <ModalFooter onCancel={() => setShowPinModal(false)} submitLabel="Generate" />
            </form>
          )}
        </div>
      )}

    </AppShell>
  );
}
