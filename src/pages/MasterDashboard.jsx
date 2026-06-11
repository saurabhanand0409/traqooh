import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/apiFetch";
import { useNavigate } from "react-router-dom";
import { requireAuth, signOut } from "../utils/auth";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Chandigarh","Puducherry",
];

export default function MasterDashboard() {
  const navigate = useNavigate();
  useEffect(() => { requireAuth(navigate, ["SUPER_ADMIN"]); }, []);

  const [activeTab, setActiveTab] = useState("companies");
  const [companies, setCompanies] = useState([]);
  const [sites, setSites] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Company modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [compForm, setCompForm] = useState({ name:"", contactPerson:"", phone:"", email:"", city:"", state:"", notes:"" });
  const [compErr, setCompErr] = useState("");
  const [compSaving, setCompSaving] = useState(false);

  // Admin modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTarget, setAdminTarget] = useState(null); // company
  const [adminForm, setAdminForm] = useState({ email:"", password:"", displayName:"" });
  const [adminErr, setAdminErr] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  // Employee modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [empTarget, setEmpTarget] = useState(null);
  const [empForm, setEmpForm] = useState({ email:"", password:"", displayName:"" });
  const [empErr, setEmpErr] = useState("");
  const [empSaving, setEmpSaving] = useState(false);
  const [showEmpPwd, setShowEmpPwd] = useState(false);

  // Expanded employees
  const [expandedId, setExpandedId] = useState(null);
  const [employees, setEmployees] = useState({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [compRes, siteRes, campRes] = await Promise.all([
      apiFetch(`/api/vendors`),
      apiFetch(`/api/sites`),
      apiFetch(`/api/campaigns`),
    ]);
    if (compRes.ok) setCompanies(await compRes.json());
    if (siteRes.ok) setSites(await siteRes.json());
    if (campRes.ok) setCampaigns(await campRes.json());
    setLoading(false);
  }, []);

  const fetchCompanies = fetchAll; // alias for existing callers

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchEmployees = async (companyId) => {
    const res = await apiFetch(`/api/vendors/${companyId}/employees`);
    if (res.ok) {
      const data = await res.json();
      setEmployees(prev => ({ ...prev, [companyId]: data }));
    }
  };

  const toggleExpand = (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!employees[id]) fetchEmployees(id);
  };

  // ── Company CRUD ──
  const openCreateCompany = () => {
    setEditCompany(null);
    setCompForm({ name:"", contactPerson:"", phone:"", email:"", city:"", state:"", notes:"" });
    setCompErr("");
    setShowCompanyModal(true);
  };

  const openEditCompany = (c) => {
    setEditCompany(c);
    setCompForm({ name:c.name||"", contactPerson:c.contactPerson||"", phone:c.phone||"", email:c.email||"", city:c.city||"", state:c.state||"", notes:c.notes||"" });
    setCompErr("");
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!compForm.name.trim()) return setCompErr("Company name is required.");
    setCompSaving(true); setCompErr("");
    const url = editCompany ? `/api/vendors/${editCompany.id}` : "/api/vendors";
    const method = editCompany ? "PUT" : "POST";
    const res = await apiFetch(url, { method, headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...compForm, status:"ACTIVE" }) });
    setCompSaving(false);
    if (res.ok) { setShowCompanyModal(false); fetchCompanies(); }
    else { const d = await res.json().catch(()=>{}); setCompErr(d?.detail || "Failed to save company"); }
  };

  const handleDeleteCompany = async (c) => {
    if (!confirm(`Delete "${c.name}"? All linked users will be unlinked.`)) return;
    await apiFetch(`/api/vendors/${c.id}`, { method:"DELETE" });
    fetchCompanies();
  };

  // ── Admin Login ──
  const openSetAdmin = (company) => {
    setAdminTarget(company);
    setAdminForm({
      email: company.adminUser?.email || "",
      password: "",
      displayName: company.adminUser?.displayName || "",
    });
    setAdminErr(""); setShowAdminPwd(false);
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.email || !adminForm.password) return setAdminErr("Email and password are required.");
    setAdminSaving(true); setAdminErr("");
    const res = await apiFetch(`/api/vendors/${adminTarget.id}/set-admin`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(adminForm),
    });
    setAdminSaving(false);
    if (res.ok) { setShowAdminModal(false); fetchCompanies(); }
    else { const d = await res.json().catch(()=>{}); setAdminErr(d?.detail || "Failed to set admin"); }
  };

  // ── Employee ──
  const openAddEmployee = (company) => {
    setEmpTarget(company);
    setEmpForm({ email:"", password:"", displayName:"" });
    setEmpErr(""); setShowEmpPwd(false);
    setShowEmpModal(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.email || !empForm.password) return setEmpErr("Email and password are required.");
    setEmpSaving(true); setEmpErr("");
    const res = await apiFetch(`/api/vendors/${empTarget.id}/employees`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(empForm),
    });
    setEmpSaving(false);
    if (res.ok) {
      setShowEmpModal(false);
      fetchCompanies();
      setEmployees(prev => ({ ...prev, [empTarget.id]: undefined }));
      if (expandedId === empTarget.id) fetchEmployees(empTarget.id);
    } else { const d = await res.json().catch(()=>{}); setEmpErr(d?.detail || "Failed to add employee"); }
  };

  const filtered = companies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");

  return (
    <div className="min-h-screen" style={{ background:"#070C1A" }}>
      {/* Top nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b"
        style={{ background:"#0B1120", borderColor:"rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl font-black text-white text-sm"
            style={{ width:36, height:36, background:"linear-gradient(135deg,#2563EB,#DC143C)" }}>
            tq
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color:"#fff" }}>
              <span style={{ color:"#2563EB" }}>traq</span><span style={{ color:"#DC143C" }}>OOH</span>
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                style={{ background:"rgba(37,99,235,0.15)", color:"#3B82F6" }}>
                Master
              </span>
            </div>
            <div className="text-xs" style={{ color:"#4B5563" }}>{user.email}</div>
          </div>
        </div>
        <button onClick={() => signOut(navigate)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color:"#6B7280", border:"1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => e.currentTarget.style.color="#DC143C"}
          onMouseLeave={e => e.currentTarget.style.color="#6B7280"}>
          Sign out
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-8 p-1 rounded-xl w-fit"
          style={{ background:"rgba(255,255,255,0.05)" }}>
          {[
            { key:"companies", label:"Companies", count: companies.length },
            { key:"inventory", label:"Inventory", count: sites.length },
            { key:"campaigns", label:"Campaigns", count: campaigns.length },
          ].map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={activeTab === t.key
                ? { background:"linear-gradient(135deg,#2563EB,#1d50c8)", color:"#fff", boxShadow:"0 4px 12px rgba(37,99,235,0.3)" }
                : { color:"#6B7280" }}>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: activeTab === t.key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", color: activeTab === t.key ? "#fff" : "#4B5563" }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── COMPANIES TAB ── */}
        {activeTab === "companies" && (<>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Companies</h1>
            <p className="text-sm mt-1" style={{ color:"#6B7280" }}>
              {companies.length} {companies.length === 1 ? "company" : "companies"} on platform
            </p>
          </div>
          <button onClick={openCreateCompany}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background:"linear-gradient(135deg,#2563EB,#1d50c8)", boxShadow:"0 4px 16px rgba(37,99,235,0.35)" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow="0 6px 20px rgba(37,99,235,0.5)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow="0 4px 16px rgba(37,99,235,0.35)"}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Company
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color:"#4B5563" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff" }}/>
        </div>

        {/* Company list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin" style={{ color:"#2563EB" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color:"#4B5563" }}>
            {search ? "No companies match your search." : "No companies yet. Click \"New Company\" to add one."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="rounded-2xl overflow-hidden"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                {/* Company row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.2),rgba(220,20,60,0.2))", color:"#3B82F6" }}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{c.name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.city && <span className="text-xs" style={{ color:"#6B7280" }}>{c.city}{c.state ? `, ${c.state}` : ""}</span>}
                      {c.phone && <span className="text-xs" style={{ color:"#6B7280" }}>{c.phone}</span>}
                    </div>
                  </div>

                  {/* Admin badge */}
                  <div className="flex-shrink-0 text-center">
                    {c.adminUser ? (
                      <div>
                        <div className="text-xs font-medium" style={{ color:"#22C55E" }}>✓ Admin set</div>
                        <div className="text-xs mt-0.5 truncate max-w-[140px]" style={{ color:"#4B5563" }}>{c.adminUser.email}</div>
                      </div>
                    ) : (
                      <div className="text-xs font-medium" style={{ color:"#F59E0B" }}>No admin yet</div>
                    )}
                  </div>

                  {/* Employee count */}
                  <div className="flex-shrink-0 text-center w-16">
                    <div className="text-lg font-bold text-white">{c.employeeCount ?? 0}</div>
                    <div className="text-xs" style={{ color:"#4B5563" }}>employees</div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button onClick={() => openSetAdmin(c)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background: c.adminUser ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)", color: c.adminUser ? "#22C55E" : "#F59E0B", border: `1px solid ${c.adminUser ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}` }}>
                      {c.adminUser ? "Change Admin" : "Set Admin"}
                    </button>
                    <button onClick={() => openAddEmployee(c)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background:"rgba(37,99,235,0.1)", color:"#3B82F6", border:"1px solid rgba(37,99,235,0.2)" }}>
                      + Employee
                    </button>
                    <button onClick={() => toggleExpand(c.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background:"rgba(255,255,255,0.05)", color:"#9CA3AF", border:"1px solid rgba(255,255,255,0.08)" }}>
                      {expandedId === c.id ? "▲ Hide" : "▼ People"}
                    </button>
                    <button onClick={() => openEditCompany(c)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color:"#6B7280" }}
                      onMouseEnter={e => e.currentTarget.style.color="#9CA3AF"}
                      onMouseLeave={e => e.currentTarget.style.color="#6B7280"}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteCompany(c)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color:"#6B7280" }}
                      onMouseEnter={e => e.currentTarget.style.color="#DC143C"}
                      onMouseLeave={e => e.currentTarget.style.color="#6B7280"}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded employees */}
                {expandedId === c.id && (
                  <div className="px-5 pb-4 border-t" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                    <div className="pt-3">
                      {/* Admin row */}
                      {c.adminUser && (
                        <div className="flex items-center gap-3 py-2 px-3 rounded-lg mb-1"
                          style={{ background:"rgba(34,197,94,0.05)" }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:"#22C55E" }}/>
                          <span className="text-sm text-white">{c.adminUser.displayName || c.adminUser.email}</span>
                          <span className="text-xs" style={{ color:"#4B5563" }}>{c.adminUser.email}</span>
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background:"rgba(34,197,94,0.1)", color:"#22C55E" }}>Admin</span>
                        </div>
                      )}
                      {/* Employee rows */}
                      {employees[c.id] === undefined ? (
                        <div className="text-xs py-2 pl-3" style={{ color:"#4B5563" }}>Loading…</div>
                      ) : employees[c.id]?.length === 0 ? (
                        <div className="text-xs py-2 pl-3" style={{ color:"#4B5563" }}>No employees yet. Click "+ Employee" to add one.</div>
                      ) : employees[c.id]?.map(emp => (
                        <div key={emp.id} className="flex items-center gap-3 py-2 px-3 rounded-lg mb-1"
                          style={{ background:"rgba(255,255,255,0.03)" }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: emp.isActive ? "#3B82F6" : "#4B5563" }}/>
                          <span className="text-sm text-white">{emp.displayName || emp.email}</span>
                          <span className="text-xs" style={{ color:"#4B5563" }}>{emp.email}</span>
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background:"rgba(37,99,235,0.1)", color:"#3B82F6" }}>Employee</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </>)}

        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (<>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Inventory</h1>
              <p className="text-sm mt-1" style={{ color:"#6B7280" }}>{sites.length} sites across all companies</p>
            </div>
          </div>
          <div className="relative mb-6">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color:"#4B5563" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search sites by name, city…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff" }}/>
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <svg className="w-6 h-6 animate-spin" style={{ color:"#2563EB" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                    {["Site Name","City / State","Type","Size","Availability","Rate / Month","Company"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color:"#4B5563" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sites.filter(s =>
                    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.city?.toLowerCase().includes(search.toLowerCase())
                  ).map((s, i) => {
                    const avail = s.availabilityStatus || "AVAILABLE";
                    const availColor = avail === "AVAILABLE" ? "#22C55E" : avail === "OCCUPIED" ? "#DC143C" : "#F59E0B";
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{s.name}</div>
                          {s.address && <div className="text-xs mt-0.5" style={{ color:"#4B5563" }}>{s.address}</div>}
                        </td>
                        <td className="px-4 py-3" style={{ color:"#9CA3AF" }}>{s.city}{s.state ? `, ${s.state}` : ""}</td>
                        <td className="px-4 py-3" style={{ color:"#9CA3AF" }}>{s.type || "—"}</td>
                        <td className="px-4 py-3" style={{ color:"#9CA3AF" }}>
                          {s.width && s.length ? `${s.width}×${s.length} ft` : s.size || "—"}
                          {s.total_area ? <span className="block text-xs" style={{ color:"#4B5563" }}>{s.total_area} sq ft</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background:`${availColor}18`, color: availColor }}>
                            {avail}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color:"#fff" }}>
                          {s.potentialMonthly ? `₹${Number(s.potentialMonthly).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color:"#6B7280" }}>{s.owner?.name || "—"}</td>
                      </tr>
                    );
                  })}
                  {sites.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color:"#4B5563" }}>No inventory added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>)}

        {/* ── CAMPAIGNS TAB ── */}
        {activeTab === "campaigns" && (<>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Campaigns</h1>
              <p className="text-sm mt-1" style={{ color:"#6B7280" }}>{campaigns.length} campaigns across all companies</p>
            </div>
          </div>
          <div className="relative mb-6">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color:"#4B5563" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff" }}/>
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <svg className="w-6 h-6 animate-spin" style={{ color:"#2563EB" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl"
              style={{ border:"1px dashed rgba(255,255,255,0.08)" }}>
              <svg className="w-10 h-10 mb-4" style={{ color:"#374151" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <p className="text-sm font-medium" style={{ color:"#4B5563" }}>No campaigns yet</p>
              <p className="text-xs mt-1" style={{ color:"#374151" }}>Campaigns created by admins will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.filter(c =>
                !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.advertiserName?.toLowerCase().includes(search.toLowerCase())
              ).map(c => {
                const STATUS_COLOR = { DRAFT:"#6B7280", PLANNED:"#3B82F6", LIVE:"#22C55E", COMPLETED:"#8B5CF6", CANCELLED:"#DC143C" };
                const color = STATUS_COLOR[c.status] || "#6B7280";
                return (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-white truncate">{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color:"#6B7280" }}>
                        {c.advertiserName || "No advertiser"} · {c.startDate ? new Date(c.startDate).toLocaleDateString("en-IN") : "—"} → {c.endDate ? new Date(c.endDate).toLocaleDateString("en-IN") : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background:`${color}18`, color }}>
                        {c.status}
                      </span>
                      {c.totalBudget && <div className="text-xs mt-1 font-medium" style={{ color:"#9CA3AF" }}>₹{Number(c.totalBudget).toLocaleString("en-IN")}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>)}

      </main>

      {/* ── New/Edit Company Modal ── */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}>
          <form onSubmit={handleSaveCompany}
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background:"#0D1428", border:"1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-lg font-bold text-white mb-5">
              {editCompany ? "Edit Company" : "New Company"}
            </h2>
            {compErr && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm"
              style={{ background:"rgba(220,20,60,0.12)", border:"1px solid rgba(220,20,60,0.3)", color:"#F87171" }}>{compErr}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Company Name *</label>
                <input value={compForm.name} onChange={e => setCompForm(f=>({...f, name:e.target.value}))}
                  placeholder="e.g. XYZ Outdoor Pvt Ltd" className="tq-input"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Contact Person</label>
                  <input value={compForm.contactPerson} onChange={e => setCompForm(f=>({...f, contactPerson:e.target.value}))}
                    placeholder="Full name" className="tq-input"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Phone</label>
                  <input value={compForm.phone} onChange={e => setCompForm(f=>({...f, phone:e.target.value}))}
                    placeholder="+91 98765 43210" className="tq-input"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Email</label>
                <input type="email" value={compForm.email} onChange={e => setCompForm(f=>({...f, email:e.target.value}))}
                  placeholder="company@email.com" className="tq-input"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>City</label>
                  <input value={compForm.city} onChange={e => setCompForm(f=>({...f, city:e.target.value}))}
                    placeholder="Mumbai" className="tq-input"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>State</label>
                  <select value={compForm.state} onChange={e => setCompForm(f=>({...f, state:e.target.value}))}
                    className="tq-input">
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Notes</label>
                <textarea value={compForm.notes} onChange={e => setCompForm(f=>({...f, notes:e.target.value}))}
                  rows={2} placeholder="Optional notes…"
                  className="tq-input resize-none"/>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowCompanyModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background:"rgba(255,255,255,0.05)", color:"#9CA3AF" }}>
                Cancel
              </button>
              <button type="submit" disabled={compSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background:"linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                {compSaving ? "Saving…" : editCompany ? "Save Changes" : "Create Company"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Set Admin Modal ── */}
      {showAdminModal && adminTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}>
          <form onSubmit={handleSaveAdmin}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background:"#0D1428", border:"1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-lg font-bold text-white mb-1">
              {adminTarget.adminUser ? "Change Admin Login" : "Set Admin Login"}
            </h2>
            <p className="text-sm mb-5" style={{ color:"#6B7280" }}>{adminTarget.name}</p>

            {adminErr && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm"
              style={{ background:"rgba(220,20,60,0.12)", border:"1px solid rgba(220,20,60,0.3)", color:"#F87171" }}>{adminErr}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Display Name</label>
                <input value={adminForm.displayName} onChange={e => setAdminForm(f=>({...f, displayName:e.target.value}))}
                  placeholder="e.g. Rahul Sharma" className="tq-input"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Email *</label>
                <input type="email" value={adminForm.email} onChange={e => setAdminForm(f=>({...f, email:e.target.value}))}
                  placeholder="admin@company.com" className="tq-input"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>
                  Password * {adminTarget.adminUser && <span className="normal-case font-normal" style={{ color:"#4B5563" }}>(sets new password)</span>}
                </label>
                <div className="relative">
                  <input type={showAdminPwd ? "text" : "password"} value={adminForm.password}
                    onChange={e => setAdminForm(f=>({...f, password:e.target.value}))}
                    placeholder="••••••••" className="tq-input pr-10"/>
                  <button type="button" onClick={() => setShowAdminPwd(s=>!s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color:"#6B7280" }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      {showAdminPwd
                        ? <path strokeLinecap="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        : <><path strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowAdminModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", color:"#9CA3AF" }}>
                Cancel
              </button>
              <button type="submit" disabled={adminSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background:"linear-gradient(135deg,#22C55E,#16a34a)" }}>
                {adminSaving ? "Saving…" : adminTarget.adminUser ? "Update Admin" : "Create Admin Login"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add Employee Modal ── */}
      {showEmpModal && empTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}>
          <form onSubmit={handleSaveEmployee}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background:"#0D1428", border:"1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-lg font-bold text-white mb-1">Add Employee</h2>
            <p className="text-sm mb-5" style={{ color:"#6B7280" }}>{empTarget.name}</p>

            {empErr && <div className="mb-4 px-4 py-2.5 rounded-xl text-sm"
              style={{ background:"rgba(220,20,60,0.12)", border:"1px solid rgba(220,20,60,0.3)", color:"#F87171" }}>{empErr}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Display Name</label>
                <input value={empForm.displayName} onChange={e => setEmpForm(f=>({...f, displayName:e.target.value}))}
                  placeholder="e.g. Priya Singh" className="tq-input"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Email *</label>
                <input type="email" value={empForm.email} onChange={e => setEmpForm(f=>({...f, email:e.target.value}))}
                  placeholder="employee@company.com" className="tq-input"/>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:"#6B7280" }}>Password *</label>
                <div className="relative">
                  <input type={showEmpPwd ? "text" : "password"} value={empForm.password}
                    onChange={e => setEmpForm(f=>({...f, password:e.target.value}))}
                    placeholder="••••••••" className="tq-input pr-10"/>
                  <button type="button" onClick={() => setShowEmpPwd(s=>!s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color:"#6B7280" }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      {showEmpPwd
                        ? <path strokeLinecap="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        : <><path strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowEmpModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", color:"#9CA3AF" }}>
                Cancel
              </button>
              <button type="submit" disabled={empSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background:"linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                {empSaving ? "Adding…" : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
