import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import { Link, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import {
  Target, Search, Plus, Calendar, IndianRupee, MapPin, Trash2,
  X, LayoutList, PlusCircle, CheckSquare, Square, Edit2,
  ChevronRight, Image as ImageIcon, Filter, Send, Copy, Check, ExternalLink
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const STATUS_CLS = {
  DRAFT:     "badge-draft",
  PLANNED:   "badge-planned",
  LIVE:      "badge-live",
  COMPLETED: "badge-completed",
  CANCELLED: "bg-red-500/15 text-red-400 border border-red-500/20",
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-widest ${STATUS_CLS[status] || STATUS_CLS.DRAFT}`}>
      {status}
    </span>
  );
}

export default function Campaigns() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit / create modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Detail panel
  const [panel, setPanel] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sites"); // "sites" | "add"

  // Site picker (Add Sites tab)
  const [siteFilters, setSiteFilters] = useState({ state: "", city: "", vendorId: "", siteType: "" });
  const [pickerSites, setPickerSites] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearched, setPickerSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [adding, setAdding] = useState(false);

  // Send-to-advertiser modal
  const [sendModal, setSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState(null); // { accessUrl, expiresAt }
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "", advertiserId: "", internalOwner: "", campaignType: "",
    startDate: "", endDate: "", totalCost: 0, status: "DRAFT", notes: "", billingRemarks: ""
  });

  useEffect(() => {
    apiFetch(`/api/advertisers`).then(r => r.json()).then(setAdvertisers).catch(() => {});
    apiFetch(`/api/vendors`).then(r => r.json()).then(setVendors).catch(() => {});
    fetchList();
  }, []);

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes((user.role || "").toUpperCase());

  const fetchList = async () => {
    setLoading(true);
    const p = new URLSearchParams();
    const advId = params.get("advertiserId");
    if (advId) p.set("advertiserId", advId);
    // Employees only see their own campaigns; admins see all
    if (!isAdmin && user.userId) p.set("userId", user.userId);
    const res = await apiFetch(`/api/campaigns?${p.toString()}`);
    if (res.ok) setList(await res.json());
    setLoading(false);
  };

  const openPanel = async (c) => {
    setPanel(true);
    setDetail(null);
    setDetailLoading(true);
    setActiveTab("sites");
    setPickerSites([]);
    setPickerSearched(false);
    setSelectedIds(new Set());
    setSiteFilters({ state: "", city: "", vendorId: "", siteType: "" });
    const res = await apiFetch(`/api/campaigns/${c.id}`);
    if (res.ok) setDetail(await res.json());
    setDetailLoading(false);
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const res = await apiFetch(`/api/campaigns/${detail.id}`);
    if (res.ok) {
      const updated = await res.json();
      setDetail(updated);
      setList(prev => prev.map(c => c.id === updated.id ? { ...c, siteCount: updated.assignments?.length || 0 } : c));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `/api/campaigns/${editing.id}` : "/api/campaigns";
    const payload = {
      ...form,
      advertiserId: Number(form.advertiserId),
      totalCost: Number(form.totalCost),
      ...(!editing && { createdByUserId: user.userId || null }),
    };
    const res = await apiFetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setShowModal(false);
      setEditing(null);
      fetchList();
      if (panel && detail && editing && editing.id === detail.id) refreshDetail();
    } else {
      const d = await res.json();
      alert(d.detail || "Error");
    }
  };

  const openEdit = (c, e) => {
    if (e) e.stopPropagation();
    setEditing(c);
    setForm({
      name: c.name, advertiserId: String(c.advertiserId), internalOwner: c.internalOwner || "",
      campaignType: c.campaignType || "", startDate: c.startDate || "", endDate: c.endDate || "",
      totalCost: c.totalCost || 0, status: c.status, notes: c.notes || "", billingRemarks: c.billingRemarks || ""
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "", advertiserId: params.get("advertiserId") || "", internalOwner: "", campaignType: "",
      startDate: "", endDate: "", totalCost: 0, status: "DRAFT", notes: "", billingRemarks: ""
    });
    setShowModal(true);
  };

  const handleDelete = async (c, e) => {
    if (e) e.stopPropagation();
    const msg = c.siteCount > 0
      ? `Delete "${c.name}"?\n\nThis campaign has ${c.siteCount} linked site${c.siteCount !== 1 ? "s" : ""}. Those sites will be unlinked and marked as Available again.\n\nThis action cannot be undone.`
      : `Delete "${c.name}"?\n\nThis action cannot be undone.`;
    if (!window.confirm(msg)) return;
    const res = await apiFetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setList(prev => prev.filter(x => x.id !== c.id));
      if (panel && detail && detail.id === c.id) setPanel(false);
    } else {
      const d = await res.json();
      alert(d.detail || "Delete failed");
    }
  };

  const handleRemoveSite = async (assignmentId) => {
    if (!window.confirm("Remove this site from the campaign?")) return;
    const res = await apiFetch(`/api/campaigns/${detail.id}/remove-site/${assignmentId}`, { method: "DELETE" });
    if (res.ok) refreshDetail();
    else alert("Failed to remove site");
  };

  const applyPickerFilters = async () => {
    setPickerLoading(true);
    setPickerSearched(true);
    setSelectedIds(new Set());
    const p = new URLSearchParams();
    if (siteFilters.state) p.set("state", siteFilters.state);
    if (siteFilters.city) p.set("city", siteFilters.city);
    if (siteFilters.vendorId) p.set("vendorId", siteFilters.vendorId);
    if (siteFilters.siteType) p.set("siteType", siteFilters.siteType);
    const res = await apiFetch(`/api/sites?${p.toString()}`);
    if (res.ok) setPickerSites(await res.json());
    setPickerLoading(false);
  };

  const togglePickerSite = (id, isLinked) => {
    if (isLinked) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const linkedIds = new Set((detail?.assignments || []).map(a => a.siteId));
    const unlinked = pickerSites.filter(s => !linkedIds.has(s.id)).map(s => s.id);
    if (selectedIds.size === unlinked.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinked));
    }
  };

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    const res = await apiFetch(`/api/campaigns/${detail.id}/assign-sites-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteIds: Array.from(selectedIds) }),
    });
    if (res.ok) {
      const d = await res.json();
      await refreshDetail();
      setSelectedIds(new Set());
      alert(`${d.added} site${d.added !== 1 ? "s" : ""} added${d.skipped > 0 ? `, ${d.skipped} already linked` : ""}.`);
    } else {
      const d = await res.json();
      alert(d.detail || "Failed to add sites");
    }
    setAdding(false);
  };

  const handleSend = async () => {
    if (!detail) return;
    setSending(true);
    const res = await apiFetch(`/api/advertisers/send-access-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advertiserId: detail.advertiserId, campaignId: detail.id, expiryDays: 30 }),
    });
    if (res.ok) {
      const d = await res.json();
      const FRONTEND = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
      setSentLink({ accessUrl: `${FRONTEND}${d.accessUrl}`, expiresAt: d.expiresAt });
      setSendModal(true);
      await refreshDetail(); // update isSentToAdvertiser badge
    } else {
      const d = await res.json();
      alert(d.detail || "Failed to generate link");
    }
    setSending(false);
  };

  const handleCopyLink = () => {
    if (!sentLink) return;
    navigator.clipboard.writeText(sentLink.accessUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filtered = list.filter(c => {
    const sMatch = !statusFilter || c.status === statusFilter;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.advertiserName || "").toLowerCase().includes(search.toLowerCase());
    return sMatch && searchMatch;
  });

  const linkedSiteIds = new Set((detail?.assignments || []).map(a => a.siteId));
  const unlinkedInPicker = pickerSites.filter(s => !linkedSiteIds.has(s.id));

  return (
    <AppShell user={user}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white">Campaigns</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Create, manage, and track advertising campaigns.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center mb-6">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg w-full"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray2)" }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns or advertisers..."
            className="w-full bg-transparent border-none outline-none text-sm"
            style={{ color: "#fff" }}
          />
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {["", "DRAFT", "PLANNED", "LIVE", "COMPLETED", "CANCELLED"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all"
              style={statusFilter === s
                ? { background: "#2563EB", color: "#fff" }
                : { background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center animate-pulse">
          <Target className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
          <p className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Loading Campaigns...</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              className="glass rounded-2xl p-5 hover:border-white/15 transition-all group flex flex-col justify-between cursor-pointer relative"
              onClick={() => openPanel(c)}
            >
              <button
                onClick={(e) => handleDelete(c, e)}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                style={{ background: "rgba(220,20,60,0.1)", color: "#F87171", border: "1px solid rgba(220,20,60,0.2)" }}
                title="Delete campaign"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-start justify-between mb-2 pr-8">
                  <h3 className="font-syne font-bold text-lg text-white leading-tight">{c.name}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-sm mb-4" style={{ color: "var(--gray)" }}>
                  {c.advertiserName || "Unknown Advertiser"}
                  <span style={{ color: "var(--gray2)" }}> · {c.campaignType || "Standard"}</span>
                </div>
                <div
                  className="flex flex-wrap gap-4 text-xs font-semibold rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", color: "var(--gray)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" style={{ color: "#3B82F6" }} />
                    {c.startDate || "TBD"} → {c.endDate || "TBD"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: "#22C55E" }} />
                    {c.siteCount} Site{c.siteCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5" style={{ color: "var(--gray2)" }}>Booking Value</div>
                  <div className="text-lg font-bold text-white">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => openEdit(c, e)}
                    className="flex items-center gap-1.5 font-semibold text-xs px-3 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100"
                    style={{ color: "var(--gray)", border: "1px solid var(--border)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#3B82F6"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--gray)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <div
                    className="font-semibold text-sm opacity-0 group-hover:opacity-100 transition px-3 py-1.5 rounded-lg flex items-center gap-1"
                    style={{ color: "#3B82F6", background: "rgba(37,99,235,0.12)" }}
                  >
                    View <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              className="col-span-1 lg:col-span-2 py-16 flex flex-col items-center justify-center rounded-2xl text-center"
              style={{ border: "2px dashed var(--border)" }}
            >
              <Target className="w-12 h-12 mb-4" style={{ color: "var(--gray3)" }} />
              <h3 className="text-lg font-bold text-white">No campaigns found</h3>
              <p className="text-sm mt-1 max-w-sm" style={{ color: "var(--gray2)" }}>Create your first campaign to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Campaign Detail Panel */}
      {panel && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-5xl flex flex-col overflow-hidden rounded-2xl"
            style={{ maxHeight: "92vh", background: "#0D1428", border: "1px solid var(--border)" }}
          >
            {detailLoading || !detail ? (
              <div className="flex-1 flex items-center justify-center py-24 animate-pulse">
                <Target className="w-10 h-10 mr-3" style={{ color: "var(--gray3)" }} />
                <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Loading campaign...</span>
              </div>
            ) : (
              <>
                {/* Panel Header */}
                <div
                  className="px-6 py-5 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.3),rgba(220,20,60,0.15))", borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={detail.status} />
                        {detail.campaignType && <span className="text-xs font-semibold" style={{ color: "var(--gray)" }}>{detail.campaignType}</span>}
                        {detail.isSentToAdvertiser && (
                          <span className="flex items-center gap-1 badge-done px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3" /> Sent to Advertiser
                          </span>
                        )}
                      </div>
                      <h2 className="font-syne font-extrabold text-2xl text-white leading-tight truncate">{detail.name}</h2>
                      <p className="text-sm mt-0.5" style={{ color: "var(--gray)" }}>{detail.advertiserName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={handleSend} disabled={sending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60"
                        style={{ background: "rgba(34,197,94,0.15)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.25)" }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sending ? "Sending..." : "Send to Advertiser"}
                      </button>
                      <button
                        onClick={(e) => openEdit(detail, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(detail, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        style={{ background: "rgba(220,20,60,0.12)", color: "#F87171", border: "1px solid rgba(220,20,60,0.2)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <button
                        onClick={() => setPanel(false)}
                        className="p-2 rounded-lg transition"
                        style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    {[
                      { icon: <Calendar className="w-3.5 h-3.5"/>, text: `${detail.startDate || "TBD"} → ${detail.endDate || "TBD"}` },
                      { icon: <MapPin className="w-3.5 h-3.5"/>, text: `${detail.assignments?.length || 0} Sites` },
                      { icon: <IndianRupee className="w-3.5 h-3.5"/>, text: `₹${Number(detail.totalCost || 0).toLocaleString("en-IN")}` },
                    ].map((chip, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>
                        {chip.icon}{chip.text}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-4 pt-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    { id: "sites", label: "Linked Sites", icon: <LayoutList className="w-4 h-4" />, count: detail.assignments?.length },
                    { id: "add", label: "Add Sites", icon: <PlusCircle className="w-4 h-4" /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition"
                      style={activeTab === tab.id
                        ? { borderColor: "#2563EB", color: "#3B82F6" }
                        : { borderColor: "transparent", color: "var(--gray2)" }}
                    >
                      {tab.icon}{tab.label}
                      {tab.count !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={activeTab === tab.id ? { background: "#2563EB", color: "#fff" } : { background: "rgba(255,255,255,0.1)", color: "var(--gray)" }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {activeTab === "sites" && (
                    <div className="p-4 space-y-2">
                      {detail.assignments?.length === 0 && (
                        <div className="py-16 flex flex-col items-center">
                          <MapPin className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
                          <p className="font-semibold text-sm text-white">No sites linked yet.</p>
                          <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Click "Add Sites" to assign sites to this campaign.</p>
                        </div>
                      )}
                      {(detail.assignments || []).map(a => (
                        <LinkedSiteRow key={a.assignmentId} a={a} onRemove={() => handleRemoveSite(a.assignmentId)} />
                      ))}
                    </div>
                  )}

                  {activeTab === "add" && (
                    <div className="flex flex-col h-full">
                      <div className="p-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { key: "state", placeholder: "e.g. Maharashtra", label: "State" },
                            { key: "city", placeholder: "e.g. Mumbai", label: "City" },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>{f.label}</label>
                              <input
                                value={siteFilters[f.key]}
                                onChange={e => setSiteFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="tq-input py-2"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Vendor</label>
                            <select value={siteFilters.vendorId} onChange={e => setSiteFilters(f => ({ ...f, vendorId: e.target.value }))} className="tq-input select py-2">
                              <option value="">All Vendors</option>
                              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Type</label>
                            <select value={siteFilters.siteType} onChange={e => setSiteFilters(f => ({ ...f, siteType: e.target.value }))} className="tq-input select py-2">
                              <option value="">All Types</option>
                              {["Billboard","Hoarding","Unipole","LED","Digital Screen","Gantry","Bus Shelter"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button onClick={applyPickerFilters} disabled={pickerLoading} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60" style={{ background: "#2563EB" }}>
                            <Filter className="w-4 h-4" />{pickerLoading ? "Searching..." : "Apply Filters"}
                          </button>
                          {pickerSearched && <span className="text-sm" style={{ color: "var(--gray2)" }}>{pickerSites.length} sites found</span>}
                          {unlinkedInPicker.length > 0 && (
                            <button onClick={handleSelectAll} className="ml-auto text-xs font-bold transition" style={{ color: "#3B82F6" }}>
                              {selectedIds.size === unlinkedInPicker.length ? "Clear All" : `Select All (${unlinkedInPicker.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20">
                        {!pickerSearched && (
                          <div className="py-16 flex flex-col items-center">
                            <Filter className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
                            <p className="font-semibold text-sm text-white">Set filters and click Apply Filters</p>
                          </div>
                        )}
                        {pickerSites.map(s => {
                          const isLinked = linkedSiteIds.has(s.id);
                          const isSelected = selectedIds.has(s.id);
                          return <PickerSiteRow key={s.id} site={s} isLinked={isLinked} isSelected={isSelected} onToggle={() => togglePickerSite(s.id, isLinked)} />;
                        })}
                      </div>

                      {selectedIds.size > 0 && (
                        <div className="p-4" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                          <button onClick={handleAddSelected} disabled={adding} className="w-full text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                            <Plus className="w-4 h-4" />
                            {adding ? "Adding..." : `Add ${selectedIds.size} Selected Site${selectedIds.size !== 1 ? "s" : ""}`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Send-to-Advertiser Link Modal */}
      {sendModal && sentLink && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl w-full max-w-lg overflow-hidden" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 py-5 flex items-start justify-between" style={{ background: "rgba(34,197,94,0.1)", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="flex items-center gap-2 mb-1"><Send className="w-5 h-5" style={{ color: "#4ADE80" }} /><h3 className="text-lg font-bold text-white">Campaign Link Generated</h3></div>
                <p className="text-sm" style={{ color: "var(--gray)" }}>Share this link with the advertiser to give them access.</p>
              </div>
              <button onClick={() => { setSendModal(false); setSentLink(null); setCopied(false); }} className="p-1.5 rounded-lg transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: "var(--gray2)" }}>Advertiser Access Link</label>
                <div className="px-4 py-3 rounded-xl text-sm font-mono break-all select-all" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "#9CA3AF" }}>
                  {sentLink.accessUrl}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition" style={{ background: copied ? "rgba(34,197,94,0.2)" : "#2563EB", color: copied ? "#4ADE80" : "#fff" }}>
                    {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
                  </button>
                  <a href={sentLink.accessUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>
                    <ExternalLink className="w-4 h-4" /> Preview
                  </a>
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                Link expires on <span className="font-bold">{new Date(sentLink.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>. You can generate a new link anytime.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-xl text-white flex items-center gap-2">
                <Target className="w-5 h-5" style={{ color: "#2563EB" }} /> {editing ? "Edit Campaign" : "New Campaign"}
              </h2>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="p-2 rounded-xl transition text-white" style={{ background: "rgba(255,255,255,0.08)" }}>✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Campaign Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="tq-input" placeholder="e.g. Summer Mega Sale" required />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Advertiser *</label>
                  <select value={form.advertiserId} onChange={e => setForm({ ...form, advertiserId: e.target.value })} className="tq-input" required>
                    <option value="">Select advertiser...</option>
                    {advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="tq-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="tq-input" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Total Cost (₹)</label>
                  <input type="number" value={form.totalCost} onChange={e => setForm({ ...form, totalCost: e.target.value })} className="tq-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="tq-input">
                    {["DRAFT","PLANNED","LIVE","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Campaign Type</label>
                <input value={form.campaignType} onChange={e => setForm({ ...form, campaignType: e.target.value })} className="tq-input" placeholder="e.g. Billboard, Digital, Print" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Internal Owner</label>
                <input value={form.internalOwner} onChange={e => setForm({ ...form, internalOwner: e.target.value })} className="tq-input" placeholder="Team member name" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="tq-input resize-none" rows={3} placeholder="Add any details or instructions..." />
              </div>
            </div>

            <div className="p-5 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>{editing ? "Update Campaign" : "Create Campaign"}</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function LinkedSiteRow({ a, onRemove }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl group transition"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      {a.imageUrl ? (
        <img src={a.imageUrl} alt={a.siteName} className="w-14 h-10 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
      ) : (
        <div className="w-14 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
          <ImageIcon className="w-5 h-5" style={{ color: "var(--gray2)" }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-white truncate">{a.siteName}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>
          {[a.siteState, a.siteCity].filter(Boolean).join(", ")}
          {a.vendorName && <span> · {a.vendorName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {a.siteType && <span className="text-[10px] font-bold px-2 py-0.5 rounded badge-planned">{a.siteType}</span>}
        {a.potentialMonthly > 0 && <span className="text-xs font-bold" style={{ color: "#4ADE80" }}>₹{Number(a.potentialMonthly).toLocaleString("en-IN")}</span>}
        <button onClick={onRemove} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition" style={{ color: "#F87171", background: "rgba(220,20,60,0.1)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PickerSiteRow({ site, isLinked, isSelected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-3 p-3 rounded-xl transition cursor-pointer"
      style={{
        background: isLinked ? "rgba(34,197,94,0.05)" : isSelected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isLinked ? "rgba(34,197,94,0.2)" : isSelected ? "rgba(37,99,235,0.4)" : "var(--border)"}`,
        cursor: isLinked ? "default" : "pointer",
        opacity: isLinked ? 0.7 : 1,
      }}
    >
      <div className="flex-shrink-0">
        {isLinked ? (
          <span className="text-[10px] font-bold px-2 py-1 rounded badge-done">Added</span>
        ) : isSelected ? (
          <CheckSquare className="w-5 h-5" style={{ color: "#3B82F6" }} />
        ) : (
          <Square className="w-5 h-5" style={{ color: "var(--gray2)" }} />
        )}
      </div>
      {site.imageUrl ? (
        <img src={site.imageUrl} alt={site.name} className="w-12 h-9 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
      ) : (
        <div className="w-12 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
          <ImageIcon className="w-4 h-4" style={{ color: "var(--gray2)" }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-white truncate">{site.name}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>
          {[site.state, site.city].filter(Boolean).join(", ")}
          {site.owner?.name && <span> · {site.owner.name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {site.type && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>{site.type}</span>}
        {site.potentialMonthly > 0 && <span className="text-xs font-bold" style={{ color: "#4ADE80" }}>₹{Number(site.potentialMonthly).toLocaleString("en-IN")}</span>}
      </div>
    </div>
  );
}
