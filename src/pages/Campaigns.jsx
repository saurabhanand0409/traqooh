import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmployeeNav from "../components/EmployeeNav";
import UserMenu from "../components/UserMenu";
import {
  Target, Search, Plus, Calendar, IndianRupee, MapPin, Trash2,
  X, LayoutList, PlusCircle, CheckSquare, Square, Edit2,
  ChevronRight, Building2, Image as ImageIcon, Filter, Send, Copy, Check, ExternalLink
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const statusColors = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  LIVE: "bg-green-50 text-green-700 border-green-200",
  COMPLETED: "bg-purple-50 text-purple-700 border-purple-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest border ${statusColors[status] || statusColors.DRAFT}`}>
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
    fetch(`${API}/api/advertisers`).then(r => r.json()).then(setAdvertisers).catch(() => {});
    fetch(`${API}/api/vendors`).then(r => r.json()).then(setVendors).catch(() => {});
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
    const res = await fetch(`${API}/api/campaigns?${p.toString()}`);
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
    const res = await fetch(`${API}/api/campaigns/${c.id}`);
    if (res.ok) setDetail(await res.json());
    setDetailLoading(false);
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const res = await fetch(`${API}/api/campaigns/${detail.id}`);
    if (res.ok) {
      const updated = await res.json();
      setDetail(updated);
      setList(prev => prev.map(c => c.id === updated.id ? { ...c, siteCount: updated.assignments?.length || 0 } : c));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `${API}/api/campaigns/${editing.id}` : `${API}/api/campaigns`;
    const payload = {
      ...form,
      advertiserId: Number(form.advertiserId),
      totalCost: Number(form.totalCost),
      ...(!editing && { createdByUserId: user.userId || null }),
    };
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
    const res = await fetch(`${API}/api/campaigns/${c.id}`, { method: "DELETE" });
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
    const res = await fetch(`${API}/api/campaigns/${detail.id}/remove-site/${assignmentId}`, { method: "DELETE" });
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
    const res = await fetch(`${API}/api/sites?${p.toString()}`);
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
    const res = await fetch(`${API}/api/campaigns/${detail.id}/assign-sites-bulk`, {
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
    const res = await fetch(`${API}/api/advertisers/send-access-link`, {
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
    <div className="min-h-screen bg-[#f3f4f6] text-[#0f172a] font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-16">
        <div className="mx-auto max-w-7xl px-5 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 text-white grid place-items-center">
              <span className="font-bold text-xl leading-none">t</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-900 tracking-tight">traqOOH</span>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <EmployeeNav />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Campaign Requests</h1>
            <p className="text-gray-500 mt-1 font-medium">Create, manage, and track advertising campaigns.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition">
            <Plus className="w-5 h-5" /> New Campaign
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full">
            <Search className="w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns or advertisers..." className="w-full bg-transparent border-none outline-none text-sm font-medium" />
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            {["", "DRAFT", "PLANNED", "LIVE", "COMPLETED", "CANCELLED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase transition ${statusFilter === s ? "bg-blue-600 text-white shadow-md shadow-blue-500/30" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Cards */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500 animate-pulse">
            <Target className="w-10 h-10 mb-3 text-gray-300" />
            <p className="font-semibold text-sm uppercase tracking-wider">Loading Campaigns...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {filtered.map(c => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 hover:shadow-lg hover:border-blue-100 transition-all group flex flex-col justify-between cursor-pointer relative"
                onClick={() => openPanel(c)}
              >
                {/* Hover-reveal delete button */}
                <button
                  onClick={(e) => handleDelete(c, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                  title="Delete campaign"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div>
                  <div className="flex items-start justify-between mb-2 pr-8">
                    <h3 className="font-bold text-xl text-gray-900 leading-tight group-hover:text-blue-700 transition">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-sm font-semibold text-gray-600 mb-4">
                    {c.advertiserName || "Unknown Advertiser"} • <span className="text-gray-400 font-medium">{c.campaignType || "Standard"}</span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500" />{c.startDate || "TBD"} → {c.endDate || "TBD"}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-500" />{c.siteCount} Site{c.siteCount !== 1 ? "s" : ""}</div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Booking Value</div>
                    <div className="text-lg font-bold text-gray-900">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => openEdit(c, e)}
                      className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 font-semibold text-xs border border-gray-200 hover:border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <div className="text-blue-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      View <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-1 lg:col-span-2 py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-white text-center">
                <Target className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">No campaigns found</h3>
                <p className="text-gray-500 mt-1 max-w-sm">You haven't created any campaigns matching this criteria yet.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Campaign Detail Panel */}
      {panel && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
            {detailLoading || !detail ? (
              <div className="flex-1 flex items-center justify-center py-24 text-gray-400 animate-pulse">
                <Target className="w-10 h-10 mr-3 text-gray-300" />
                <span className="text-sm font-semibold uppercase tracking-wider">Loading campaign...</span>
              </div>
            ) : (
              <>
                {/* Panel Header */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-5 text-white flex-shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge status={detail.status} />
                        {detail.campaignType && <span className="text-blue-200 text-xs font-semibold">{detail.campaignType}</span>}
                        {detail.isSentToAdvertiser && (
                          <span className="flex items-center gap-1 bg-green-400/30 text-green-200 border border-green-300/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3" /> Sent to Advertiser
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-extrabold leading-tight truncate">{detail.name}</h2>
                      <p className="text-blue-200 text-sm mt-0.5 font-medium">{detail.advertiserName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={handleSend}
                        disabled={sending}
                        className="flex items-center gap-1.5 bg-green-500/80 hover:bg-green-500 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60"
                        title="Generate a shareable link for the advertiser"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sending ? "Sending..." : "Send to Advertiser"}
                      </button>
                      <button onClick={(e) => openEdit(detail, e)} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={(e) => handleDelete(detail, e)} className="flex items-center gap-1.5 bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <button onClick={() => setPanel(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Info chips */}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-blue-100">
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-3.5 h-3.5" /> {detail.startDate || "TBD"} → {detail.endDate || "TBD"}
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                      <MapPin className="w-3.5 h-3.5" /> {detail.assignments?.length || 0} Sites
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                      <IndianRupee className="w-3.5 h-3.5" /> ₹{Number(detail.totalCost || 0).toLocaleString("en-IN")}
                    </span>
                    {detail.internalOwner && (
                      <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                        Owner: {detail.internalOwner}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 flex-shrink-0">
                  <div className="flex gap-1 px-4 pt-2">
                    {[
                      { id: "sites", label: "Linked Sites", icon: <LayoutList className="w-4 h-4" />, count: detail.assignments?.length },
                      { id: "add", label: "Add Sites", icon: <PlusCircle className="w-4 h-4" /> },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition ${activeTab === tab.id ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.count !== undefined && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Linked Sites Tab */}
                  {activeTab === "sites" && (
                    <div className="p-4 space-y-2">
                      {detail.assignments?.length === 0 && (
                        <div className="py-16 flex flex-col items-center text-gray-400">
                          <MapPin className="w-10 h-10 mb-3 text-gray-300" />
                          <p className="font-semibold text-sm">No sites linked yet.</p>
                          <p className="text-xs mt-1 text-gray-400">Click "Add Sites" to assign sites to this campaign.</p>
                        </div>
                      )}
                      {(detail.assignments || []).map(a => (
                        <LinkedSiteRow key={a.assignmentId} a={a} onRemove={() => handleRemoveSite(a.assignmentId)} />
                      ))}
                    </div>
                  )}

                  {/* Add Sites Tab */}
                  {activeTab === "add" && (
                    <div className="flex flex-col h-full">
                      {/* Filter bar */}
                      <div className="p-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">State</label>
                            <input
                              value={siteFilters.state}
                              onChange={e => setSiteFilters(f => ({ ...f, state: e.target.value }))}
                              placeholder="e.g. Maharashtra"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">City</label>
                            <input
                              value={siteFilters.city}
                              onChange={e => setSiteFilters(f => ({ ...f, city: e.target.value }))}
                              placeholder="e.g. Mumbai"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Vendor</label>
                            <select
                              value={siteFilters.vendorId}
                              onChange={e => setSiteFilters(f => ({ ...f, vendorId: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                              <option value="">All Vendors</option>
                              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Type</label>
                            <select
                              value={siteFilters.siteType}
                              onChange={e => setSiteFilters(f => ({ ...f, siteType: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                              <option value="">All Types</option>
                              {["Billboard", "Hoarding", "Unipole", "LED", "Digital Screen", "Gantry", "Bus Shelter"].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            onClick={applyPickerFilters}
                            disabled={pickerLoading}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60"
                          >
                            <Filter className="w-4 h-4" />
                            {pickerLoading ? "Searching..." : "Apply Filters"}
                          </button>
                          {pickerSearched && (
                            <span className="text-sm text-gray-500 font-medium">
                              {pickerSites.length} site{pickerSites.length !== 1 ? "s" : ""} found
                              {unlinkedInPicker.length !== pickerSites.length && ` (${linkedSiteIds.size} already linked)`}
                            </span>
                          )}
                          {unlinkedInPicker.length > 0 && (
                            <button
                              onClick={handleSelectAll}
                              className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                            >
                              {selectedIds.size === unlinkedInPicker.length ? "Clear All" : `Select All (${unlinkedInPicker.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Site list */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20">
                        {!pickerSearched && (
                          <div className="py-16 flex flex-col items-center text-gray-400">
                            <Filter className="w-10 h-10 mb-3 text-gray-300" />
                            <p className="font-semibold text-sm">Set filters and click Apply Filters</p>
                            <p className="text-xs mt-1">Leave all fields empty to see all available sites.</p>
                          </div>
                        )}
                        {pickerSearched && pickerSites.length === 0 && !pickerLoading && (
                          <div className="py-16 flex flex-col items-center text-gray-400">
                            <MapPin className="w-10 h-10 mb-3 text-gray-300" />
                            <p className="font-semibold text-sm">No sites match these filters.</p>
                          </div>
                        )}
                        {pickerSites.map(s => {
                          const isLinked = linkedSiteIds.has(s.id);
                          const isSelected = selectedIds.has(s.id);
                          return (
                            <PickerSiteRow
                              key={s.id}
                              site={s}
                              isLinked={isLinked}
                              isSelected={isSelected}
                              onToggle={() => togglePickerSite(s.id, isLinked)}
                            />
                          );
                        })}
                      </div>

                      {/* Sticky add button */}
                      {selectedIds.size > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
                          <button
                            onClick={handleAddSelected}
                            disabled={adding}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                          >
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-white flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Send className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Campaign Link Generated</h3>
                </div>
                <p className="text-green-100 text-sm">Share this link with the advertiser to give them access.</p>
              </div>
              <button onClick={() => { setSendModal(false); setSentLink(null); setCopied(false); }} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Advertiser Access Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-700 break-all select-all">
                    {sentLink.accessUrl}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${copied ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                  >
                    {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
                  </button>
                  <a
                    href={sentLink.accessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                  >
                    <ExternalLink className="w-4 h-4" /> Preview
                  </a>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium">
                ⏳ This link expires on <span className="font-bold">{new Date(sentLink.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>. You can generate a new link anytime.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" /> {editing ? "Edit Campaign" : "New Campaign"}
              </h2>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm border border-gray-200 transition text-gray-500">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="e.g. Summer Mega Sale" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Advertiser *</label>
                  <select value={form.advertiserId} onChange={e => setForm({ ...form, advertiserId: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer" required>
                    <option value="">Select advertiser...</option>
                    {advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Total Cost (₹)</label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" value={form.totalCost} onChange={e => setForm({ ...form, totalCost: e.target.value })} className="w-full border-gray-300 rounded-xl pl-10 pr-4 py-3 bg-gray-50 focus:bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                    {["DRAFT", "PLANNED", "LIVE", "COMPLETED", "CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Type</label>
                <input value={form.campaignType} onChange={e => setForm({ ...form, campaignType: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="e.g. Billboard, Digital, Print" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Internal Owner</label>
                <input value={form.internalOwner} onChange={e => setForm({ ...form, internalOwner: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Team member name" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notes & Remarks</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" rows={3} placeholder="Add any details or instructions here..." />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="flex-1 px-5 py-3 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition shadow-sm">Cancel</button>
              <button type="submit" className="flex-1 px-5 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transition shadow-blue-600/30">{editing ? "Update Campaign" : "Create Campaign"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function LinkedSiteRow({ a, onRemove }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {a.imageUrl ? (
        <img src={a.imageUrl} alt={a.siteName} className="w-14 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
      ) : (
        <div className="w-14 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 truncate">{a.siteName}</div>
        <div className="text-xs text-gray-500 font-medium">
          {[a.siteState, a.siteCity].filter(Boolean).join(", ")}
          {a.vendorName && <span className="text-gray-400"> · {a.vendorName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {a.siteType && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
            {a.siteType}{a.lightingType ? ` (${a.lightingType})` : ""}
          </span>
        )}
        {a.siteSize && (
          <span className="text-[10px] font-semibold text-gray-500">{a.siteSize}</span>
        )}
        {a.potentialMonthly > 0 && (
          <span className="text-xs font-bold text-green-700">₹{Number(a.potentialMonthly).toLocaleString("en-IN")}</span>
        )}
        <button
          onClick={onRemove}
          className={`p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition ${hovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          title="Remove site"
        >
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
      className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
        isLinked
          ? "border-green-200 bg-green-50 opacity-70 cursor-default"
          : isSelected
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
      }`}
    >
      <div className="flex-shrink-0">
        {isLinked ? (
          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-green-100 text-green-700 border border-green-200">Added</span>
        ) : isSelected ? (
          <CheckSquare className="w-5 h-5 text-blue-600" />
        ) : (
          <Square className="w-5 h-5 text-gray-400" />
        )}
      </div>
      {site.imageUrl ? (
        <img src={site.imageUrl} alt={site.name} className="w-12 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
      ) : (
        <div className="w-12 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="w-4 h-4 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 truncate">{site.name}</div>
        <div className="text-xs text-gray-500">
          {[site.state, site.city].filter(Boolean).join(", ")}
          {site.owner?.name && <span className="text-gray-400"> · {site.owner.name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-right">
        {site.type && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
            {site.type}{site.lightingType ? ` (${site.lightingType})` : ""}
          </span>
        )}
        {site.potentialMonthly > 0 && (
          <span className="text-xs font-bold text-green-700 min-w-[60px]">₹{Number(site.potentialMonthly).toLocaleString("en-IN")}</span>
        )}
      </div>
    </div>
  );
}
