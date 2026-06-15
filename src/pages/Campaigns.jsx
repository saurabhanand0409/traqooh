import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import { Link, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import {
  Target, Search, Plus, Calendar, IndianRupee, MapPin, Trash2,
  X, LayoutList, PlusCircle, CheckSquare, Square, Edit2,
  ChevronRight, Image as ImageIcon, Filter, Send, Copy, Check, ExternalLink, Share2,
  FileDown, ChevronDown, ChevronUp, Save
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

function parseSqft(sizeStr) {
  if (!sizeStr) return 0;
  const m = sizeStr.match(/^(\d+(?:\.\d+)?)[×x](\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return parseFloat(m[1]) * parseFloat(m[2]);
}

const PRINTING_TYPES = ["Flex", "Vinyl", "Backlit", "Sunboard", "Fabrication", "Fabrication and Flex", "Other"];

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
  const [segment, setSegment] = useState("planned"); // "planned" | "running" | "completed"
  const [search, setSearch] = useState("");

  // Detail panel
  const [panel, setPanel] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [panelCampaign, setPanelCampaign] = useState(null); // raw list item for retry
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

  // Share with employee
  const [employees, setEmployees] = useState([]);
  const [shares, setShares] = useState([]); // current shares for open campaign
  const [shareSearch, setShareSearch] = useState("");
  const [sharing, setSharing] = useState(false);

  // Inline cost table — row selection + bulk apply
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkForm, setBulkForm] = useState({ printingType: "Flex", printingCost: "", mountingCost: "", otherCost: "" });
  const [bulkApplying, setBulkApplying] = useState(false);

  const [form, setForm] = useState({
    name: "", advertiserId: "", internalOwner: "", campaignType: "",
    startDate: "", endDate: "", totalCost: 0, status: "DRAFT", notes: "", billingRemarks: ""
  });

  useEffect(() => {
    apiFetch(`/api/advertisers`).then(r => r.json()).then(setAdvertisers).catch(() => {});
    apiFetch(`/api/vendors`).then(r => r.json()).then(setVendors).catch(() => {});
    const companyId = user.companyId || user.vendorId;
    if (isAdmin && companyId) {
      apiFetch(`/api/vendors/${companyId}/employees`).then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
    }
    fetchList();
  }, []);

  const role = (user.role || "").toUpperCase();
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);

  const fetchList = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      const advId = params.get("advertiserId");
      if (advId) p.set("advertiserId", advId);
      if (role === "EMPLOYEE" && user.userId) {
        p.set("userId", user.userId);
      } else if (role === "ADMIN") {
        const companyId = user.companyId || user.vendorId;
        if (companyId) p.set("vendorId", companyId);
      }
      // SUPER_ADMIN: no filter — sees everything
      const res = await apiFetch(`/api/campaigns?${p.toString()}`);
      if (res.ok) setList(await res.json());
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  const openPanel = async (c) => {
    setPanel(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setPanelCampaign(c);
    setActiveTab("sites");
    setPickerSites([]);
    setPickerSearched(false);
    setSelectedIds(new Set());
    setShareSearch("");
    setSiteFilters({ state: "", city: "", vendorId: "", siteType: "" });
    try {
      const [res, sharesRes] = await Promise.all([
        apiFetch(`/api/campaigns/${c.id}`),
        apiFetch(`/api/campaigns/${c.id}/shares`).catch(() => ({ ok: false })),
      ]);
      if (res.ok) {
        setDetail(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setDetailError(err.detail || `Error ${res.status} loading campaign`);
      }
      if (sharesRes.ok) setShares(await sharesRes.json());
    } catch (err) {
      setDetailError("Network error — the server may be starting up. Please try again in a moment.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleShare = async (emp) => {
    if (sharing) return;
    setSharing(true);
    const res = await apiFetch(`/api/campaigns/${detail.id}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [emp.userId || emp.id], sharedByEmail: user.email }),
    });
    if (res.ok) {
      const sharesRes = await apiFetch(`/api/campaigns/${detail.id}/shares`);
      if (sharesRes.ok) setShares(await sharesRes.json());
    }
    setSharing(false);
  };

  const handleUnshare = async (userId) => {
    await apiFetch(`/api/campaigns/${detail.id}/share/${userId}`, { method: "DELETE" });
    setShares(prev => prev.filter(s => s.userId !== userId));
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

  const handleCostUpdate = async (assignmentId, costs) => {
    await apiFetch(`/api/campaigns/${detail.id}/assignment/${assignmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costs),
    });
    // Update local state only — avoids full refresh and keeps inline inputs stable
    setDetail(prev => ({
      ...prev,
      assignments: prev.assignments.map(a =>
        a.assignmentId === assignmentId ? { ...a, ...costs } : a
      ),
    }));
  };

  const toggleRowSelect = (assignmentId) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId);
      return next;
    });
  };

  const toggleSelectAllRows = () => {
    const allIds = (detail?.assignments || []).map(a => a.assignmentId);
    setSelectedRows(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
  };

  const handleBulkApply = async () => {
    if (selectedRows.size === 0) return;
    setBulkApplying(true);
    for (const aid of selectedRows) {
      const assignment = (detail.assignments || []).find(a => a.assignmentId === aid);
      const sqft = parseSqft(assignment?.siteSize);
      const payload = { printingType: bulkForm.printingType };
      if (bulkForm.printingCost !== "") payload.printingCost = Math.round(Number(bulkForm.printingCost) * (sqft || 1));
      if (bulkForm.mountingCost !== "") payload.mountingCost = Math.round(Number(bulkForm.mountingCost) * (sqft || 1));
      if (bulkForm.otherCost !== "") payload.otherCost = Number(bulkForm.otherCost);
      await apiFetch(`/api/campaigns/${detail.id}/assignment/${aid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    // Refresh to sync all rows
    await refreshDetail();
    setSelectedRows(new Set());
    setBulkApplying(false);
  };

  const downloadCostSheet = () => {
    if (!detail) return;
    const allAssignments = detail.assignments || [];
    if (selectedRows.size === 0) {
      alert("Please select the sites you want to include in the cost sheet by checking their checkboxes.");
      return;
    }
    const assignments = allAssignments.filter(a => selectedRows.has(a.assignmentId));
    // Display Cost = agreedCost if entered, else potentialMonthly as reference rate
    const displayCost = (a) => Number(a.agreedCost || a.potentialMonthly || 0);
    const grandTotal = assignments.reduce((sum, a) => sum + displayCost(a) + (a.printingCost||0) + (a.mountingCost||0) + (a.otherCost||0), 0);
    const totalSpace = assignments.reduce((sum, a) => sum + displayCost(a), 0);
    const totalPrint = assignments.reduce((sum, a) => sum + (a.printingCost||0), 0);
    const totalMount = assignments.reduce((sum, a) => sum + (a.mountingCost||0), 0);
    const totalOther = assignments.reduce((sum, a) => sum + (a.otherCost||0), 0);
    const fmt = n => Number(n||0).toLocaleString("en-IN");
    const rows = assignments.map((a, i) => `
      <tr>
        <td>${i+1}</td>
        <td><strong>${a.siteName||"—"}</strong></td>
        <td>${[a.siteCity, a.siteState].filter(Boolean).join(", ")||"—"}</td>
        <td>${a.siteType||"—"}</td>
        <td>${a.siteSize||"—"}</td>
        <td>${a.lightingType||"—"}</td>
        <td>${a.printingType||"—"}</td>
        <td style="text-align:right">₹${fmt(displayCost(a))}</td>
        <td style="text-align:right">₹${fmt(a.printingCost)}</td>
        <td style="text-align:right">₹${fmt(a.mountingCost)}</td>
        <td style="text-align:right">₹${fmt(a.otherCost)}</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8">₹${fmt(displayCost(a)+(a.printingCost||0)+(a.mountingCost||0)+(a.otherCost||0))}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Cost Sheet – ${detail.name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:28px 32px;color:#111;font-size:12px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
      .brand{font-size:22px;font-weight:900;letter-spacing:-0.5px}
      .brand .b{color:#2563EB}.brand .r{color:#DC143C}
      .brand small{font-size:11px;color:#666;font-weight:400;margin-left:6px}
      .meta{text-align:right;color:#555;font-size:11px;line-height:1.6}
      h1{font-size:17px;font-weight:800;margin:4px 0 2px}
      .chips{display:flex;gap:20px;background:#f0f4ff;border:1px solid #d0d8f0;border-radius:8px;padding:12px 16px;margin-bottom:18px}
      .chip-label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em}
      .chip-val{font-size:14px;font-weight:700;color:#111;margin-top:1px}
      .chip-val.blue{color:#2563EB}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1e293b;color:#fff;padding:7px 9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
      td{padding:6px 9px;border-bottom:1px solid #eee;vertical-align:middle}
      tr:nth-child(even) td{background:#f8f9fc}
      .tot td{background:#1e293b;color:#fff;font-weight:700;font-size:12px}
      .tot .blue{color:#60a5fa}
      .foot{margin-top:20px;text-align:center;font-size:10px;color:#aaa}
      @media print{@page{size:A3 landscape;margin:12mm}button{display:none}}
    </style></head><body>
    <div class="hdr">
      <div>
        <div class="brand"><span class="b">traq</span><span class="r">OOH</span><small>by BrandSculpt</small></div>
        <h1>${detail.name}</h1>
        <div style="color:#555;font-size:11px">${detail.advertiserName||""} &nbsp;·&nbsp; ${detail.campaignType||"OOH Campaign"}</div>
      </div>
      <div class="meta">
        <div style="font-weight:700;font-size:13px">Cost Estimate Sheet</div>
        <div>${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
        ${detail.internalOwner?`<div>Prepared by: ${detail.internalOwner}</div>`:""}
      </div>
    </div>
    <div class="chips">
      <div><div class="chip-label">Advertiser</div><div class="chip-val">${detail.advertiserName||"—"}</div></div>
      <div><div class="chip-label">Duration</div><div class="chip-val">${detail.startDate||"TBD"} → ${detail.endDate||"TBD"}</div></div>
      <div><div class="chip-label">Total Sites</div><div class="chip-val">${assignments.length}</div></div>
      <div><div class="chip-label">Display Cost</div><div class="chip-val">₹${fmt(totalSpace)}</div></div>
      <div><div class="chip-label">Production</div><div class="chip-val">₹${fmt(totalPrint+totalMount+totalOther)}</div></div>
      <div><div class="chip-label">Grand Total</div><div class="chip-val blue">₹${fmt(grandTotal)}</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Site Name</th><th>Location</th><th>Type</th><th>Size</th><th>Lighting</th><th>Print Type</th>
      <th style="text-align:right">Display Cost</th><th style="text-align:right">Printing</th>
      <th style="text-align:right">Mounting</th><th style="text-align:right">Other</th><th style="text-align:right">Total</th>
    </tr></thead><tbody>
      ${rows}
      <tr class="tot">
        <td colspan="7">GRAND TOTAL</td>
        <td style="text-align:right">₹${fmt(totalSpace)}</td>
        <td style="text-align:right">₹${fmt(totalPrint)}</td>
        <td style="text-align:right">₹${fmt(totalMount)}</td>
        <td style="text-align:right">₹${fmt(totalOther)}</td>
        <td style="text-align:right" class="blue">₹${fmt(grandTotal)}</td>
      </tr>
    </tbody></table>
    <div class="foot">Generated by TraqOOH · BrandSculpt Media Solutions · Confidential</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const filtered = list.filter(c => {
    const SEGMENT_STATUSES = {
      planned:   ["DRAFT", "PLANNED"],
      running:   ["LIVE"],
      completed: ["COMPLETED", "CANCELLED"],
    };
    const sMatch = SEGMENT_STATUSES[segment].includes(c.status);
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.advertiserName || "").toLowerCase().includes(search.toLowerCase());
    return sMatch && searchMatch;
  });

  const segmentCounts = {
    planned:   list.filter(c => ["DRAFT","PLANNED"].includes(c.status)).length,
    running:   list.filter(c => c.status === "LIVE").length,
    completed: list.filter(c => ["COMPLETED","CANCELLED"].includes(c.status)).length,
  };

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

      {/* Segment Tabs */}
      <div className="flex gap-2 mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {[
          { key: "planned",   label: "Proposed / Planned", dot: "#3B82F6" },
          { key: "running",   label: "Running",             dot: "#22C55E" },
          { key: "completed", label: "Completed",           dot: "#8B5CF6" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSegment(tab.key)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px"
            style={{
              borderColor: segment === tab.key ? tab.dot : "transparent",
              color: segment === tab.key ? "#fff" : "var(--gray2)",
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tab.dot }} />
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: segment === tab.key ? tab.dot + "33" : "rgba(255,255,255,0.06)",
                color: segment === tab.key ? tab.dot : "var(--gray2)",
              }}>
              {segmentCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-6"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray2)" }} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns or advertisers..."
          className="w-full bg-transparent border-none outline-none text-sm"
          style={{ color: "#fff" }}
        />
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center animate-pulse">
          <Target className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
          <p className="font-semibold text-sm uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Loading Campaigns...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center glass rounded-2xl">
          <Target className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
          <p className="font-semibold text-white">No {segment === "planned" ? "proposed/planned" : segment} campaigns</p>
          <p className="text-sm mt-1" style={{ color: "var(--gray2)" }}>
            {segment === "planned" ? "Create a new campaign to get started." : `No campaigns are currently ${segment}.`}
          </p>
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
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center py-24 animate-pulse">
                <Target className="w-10 h-10 mr-3" style={{ color: "var(--gray3)" }} />
                <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Loading campaign...</span>
              </div>
            ) : detailError ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
                <div className="px-5 py-4 rounded-xl text-sm text-center max-w-sm" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>
                  {detailError}
                </div>
                <button
                  onClick={() => panelCampaign && openPanel(panelCampaign)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}
                >
                  Retry
                </button>
              </div>
            ) : !detail ? (
              <div className="flex-1 flex items-center justify-center py-24">
                <span className="text-sm" style={{ color: "var(--gray2)" }}>No data</span>
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
                    ...(isAdmin ? [{ id: "share", label: "Share", icon: <Share2 className="w-4 h-4" />, count: shares.length || undefined }] : []),
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
                    <div className="flex flex-col h-full">
                      {detail.assignments?.length === 0 ? (
                        <div className="py-16 flex flex-col items-center">
                          <MapPin className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
                          <p className="font-semibold text-sm text-white">No sites linked yet.</p>
                          <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Click "Add Sites" to assign sites to this campaign.</p>
                        </div>
                      ) : (() => {
                        const asgn = detail.assignments || [];
                        const tSpace = asgn.reduce((s, a) => s + (a.agreedCost || a.potentialMonthly || 0), 0);
                        const tPrint = asgn.reduce((s, a) => s + (a.printingCost||0), 0);
                        const tMount = asgn.reduce((s, a) => s + (a.mountingCost||0), 0);
                        const tOther = asgn.reduce((s, a) => s + (a.otherCost||0), 0);
                        const grand = tSpace + tPrint + tMount + tOther;
                        const fmt = n => Number(n||0).toLocaleString("en-IN");
                        const allSelected = selectedRows.size === asgn.length && asgn.length > 0;
                        const someSelected = selectedRows.size > 0 && !allSelected;
                        return (
                          <>
                            {/* Toolbar */}
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                              <span className="text-xs font-semibold" style={{ color: "var(--gray2)" }}>{asgn.length} sites</span>
                              <button onClick={downloadCostSheet} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition" style={{ background: "rgba(37,99,235,0.15)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.3)" }}>
                                <FileDown className="w-3.5 h-3.5" />
                                {selectedRows.size > 0 ? `Download (${selectedRows.size} sites)` : "Download Cost Sheet"}
                              </button>
                            </div>

                            {/* Bulk apply bar — shown when rows are selected */}
                            {selectedRows.size > 0 && (
                              <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 flex-wrap" style={{ background: "rgba(37,99,235,0.1)", borderBottom: "1px solid rgba(37,99,235,0.25)" }}>
                                <span className="text-xs font-bold" style={{ color: "#60A5FA" }}>{selectedRows.size} selected — Apply common rate:</span>
                                <select
                                  value={bulkForm.printingType}
                                  onChange={e => setBulkForm(f => ({ ...f, printingType: e.target.value }))}
                                  className="tq-input py-1 text-xs"
                                  style={{ width: 90 }}
                                >
                                  {PRINTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                {[
                                  { key: "printingCost", label: "Print ₹/sqft" },
                                  { key: "mountingCost", label: "Mount ₹/sqft" },
                                  { key: "otherCost", label: "Other ₹" },
                                ].map(f => (
                                  <input
                                    key={f.key}
                                    type="number"
                                    value={bulkForm[f.key]}
                                    onChange={e => setBulkForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder={f.label}
                                    className="tq-input py-1 text-xs"
                                    style={{ width: 90 }}
                                  />
                                ))}
                                <button
                                  onClick={handleBulkApply}
                                  disabled={bulkApplying}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-60"
                                  style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}
                                >
                                  <Check className="w-3 h-3" />{bulkApplying ? "Applying…" : `Apply to ${selectedRows.size}`}
                                </button>
                                <button onClick={() => setSelectedRows(new Set())} className="text-xs font-bold" style={{ color: "var(--gray2)" }}>Clear</button>
                              </div>
                            )}

                            {/* Table */}
                            <div className="flex-1 overflow-auto">
                              <table className="w-full text-left" style={{ borderCollapse: "collapse", minWidth: 860 }}>
                                <thead>
                                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border)" }}>
                                    <th className="px-3 py-2.5 w-8">
                                      <div
                                        onClick={toggleSelectAllRows}
                                        className="w-4 h-4 rounded flex items-center justify-center border cursor-pointer"
                                        style={{
                                          borderColor: allSelected ? "#3B82F6" : "rgba(255,255,255,0.2)",
                                          background: allSelected ? "#3B82F6" : someSelected ? "rgba(59,130,246,0.3)" : "transparent",
                                        }}
                                      >
                                        {allSelected ? <Check className="w-2.5 h-2.5 text-white" /> : someSelected ? <div className="w-2 h-px bg-blue-400 rounded" /> : null}
                                      </div>
                                    </th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>#</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Site</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Type / Size</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Period</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Display Cost</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Printing</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Mounting</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>Other</th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: "var(--gray2)" }}>Total</th>
                                    <th className="px-2 py-2.5 w-6" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {asgn.map((a, idx) => (
                                    <SiteTableRow
                                      key={a.assignmentId}
                                      a={a}
                                      idx={idx}
                                      isSelected={selectedRows.has(a.assignmentId)}
                                      onToggleSelect={() => toggleRowSelect(a.assignmentId)}
                                      onRemove={() => handleRemoveSite(a.assignmentId)}
                                      onCostUpdate={handleCostUpdate}
                                      campaignStartDate={detail.startDate}
                                      campaignEndDate={detail.endDate}
                                    />
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: "rgba(37,99,235,0.08)", borderTop: "2px solid rgba(37,99,235,0.25)" }}>
                                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#60A5FA" }}>
                                      Grand Total — {asgn.length} sites
                                    </td>
                                    <td className="px-2 py-2.5 text-xs font-bold text-white">₹{fmt(tSpace)}</td>
                                    <td className="px-2 py-2.5 text-xs font-bold text-white">₹{fmt(tPrint)}</td>
                                    <td className="px-2 py-2.5 text-xs font-bold text-white">₹{fmt(tMount)}</td>
                                    <td className="px-2 py-2.5 text-xs font-bold text-white">₹{fmt(tOther)}</td>
                                    <td className="px-2 py-2.5 text-sm font-bold text-right" style={{ color: "#60A5FA" }}>₹{fmt(grand)}</td>
                                    <td />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </>
                        );
                      })()}
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

                      {/* Select All header row */}
                      {pickerSearched && unlinkedInPicker.length > 0 && (
                        <div className="px-4 py-2 flex items-center gap-3 cursor-pointer"
                          style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}
                          onClick={handleSelectAll}>
                          <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition"
                            style={{
                              borderColor: selectedIds.size === unlinkedInPicker.length ? "#3B82F6" : "rgba(255,255,255,0.2)",
                              background: selectedIds.size === unlinkedInPicker.length ? "#3B82F6"
                                : selectedIds.size > 0 ? "rgba(59,130,246,0.3)" : "transparent",
                            }}>
                            {selectedIds.size === unlinkedInPicker.length
                              ? <Check className="w-3 h-3 text-white" />
                              : selectedIds.size > 0
                                ? <div className="w-2 h-0.5 bg-blue-400 rounded" />
                                : null}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: selectedIds.size > 0 ? "#60A5FA" : "#9CA3AF" }}>
                            {selectedIds.size === unlinkedInPicker.length
                              ? `Deselect All (${unlinkedInPicker.length})`
                              : selectedIds.size > 0
                                ? `${selectedIds.size} of ${unlinkedInPicker.length} selected — Select All`
                                : `Select All ${unlinkedInPicker.length} Sites`}
                          </span>
                          {selectedIds.size > 0 && (
                            <button onClick={handleAddSelected} disabled={adding}
                              className="ml-auto flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-60"
                              style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                              <Plus className="w-3.5 h-3.5" />
                              {adding ? "Adding…" : `Add ${selectedIds.size}`}
                            </button>
                          )}
                        </div>
                      )}

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

                  {/* ── Share Tab ── */}
                  {activeTab === "share" && isAdmin && (
                    <div className="p-4 space-y-4">
                      {/* Currently shared with */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gray2)" }}>
                          Shared With ({shares.length})
                        </p>
                        {shares.length === 0 ? (
                          <p className="text-sm py-4 text-center" style={{ color: "var(--gray2)" }}>Not shared with anyone yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {shares.map(s => (
                              <div key={s.userId} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                                <div>
                                  <div className="text-sm font-semibold text-white">{s.displayName || s.email}</div>
                                  <div className="text-xs" style={{ color: "var(--gray2)" }}>{s.email}</div>
                                </div>
                                <button onClick={() => handleUnshare(s.userId)}
                                  className="text-xs font-bold px-2 py-1 rounded-lg transition"
                                  style={{ background: "rgba(220,20,60,0.1)", color: "#F87171", border: "1px solid rgba(220,20,60,0.2)" }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add employees */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gray2)" }}>Add Employee</p>
                        <input
                          value={shareSearch} onChange={e => setShareSearch(e.target.value)}
                          placeholder="Search employees by name or email..."
                          className="tq-input mb-3" />
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {employees
                            .filter(e => !shares.find(s => s.userId === (e.userId || e.id)))
                            .filter(e => !shareSearch || (e.displayName || e.email || "").toLowerCase().includes(shareSearch.toLowerCase()))
                            .map(emp => (
                              <div key={emp.userId || emp.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                                <div>
                                  <div className="text-sm font-semibold text-white">{emp.displayName || emp.email}</div>
                                  <div className="text-xs" style={{ color: "var(--gray2)" }}>{emp.email}</div>
                                </div>
                                <button onClick={() => handleShare(emp)} disabled={sharing}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition disabled:opacity-60"
                                  style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                                  Share
                                </button>
                              </div>
                            ))}
                          {employees.filter(e => !shares.find(s => s.userId === (e.userId || e.id))).length === 0 && (
                            <p className="text-sm text-center py-4" style={{ color: "var(--gray2)" }}>All employees already have access.</p>
                          )}
                        </div>
                      </div>
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

function SiteTableRow({ a, idx, isSelected, onToggleSelect, onRemove, onCostUpdate, campaignStartDate, campaignEndDate }) {
  const sqft = parseSqft(a.siteSize);

  const rateFromCost = (cost) => sqft > 0 ? (Number(cost || 0) / sqft) : Number(cost || 0);

  const [costs, setCosts] = React.useState({
    agreedCost: a.agreedCost || 0,
    printingType: a.printingType || "Flex",
    printingRate: rateFromCost(a.printingCost),
    mountingRate: rateFromCost(a.mountingCost),
    otherCost: a.otherCost || 0,
  });

  // Sync from parent after bulk apply
  React.useEffect(() => {
    const sq = parseSqft(a.siteSize);
    const rate = (cost) => sq > 0 ? (Number(cost || 0) / sq) : Number(cost || 0);
    setCosts({
      agreedCost: a.agreedCost || 0,
      printingType: a.printingType || "Flex",
      printingRate: rate(a.printingCost),
      mountingRate: rate(a.mountingCost),
      otherCost: a.otherCost || 0,
    });
  }, [a.agreedCost, a.printingCost, a.mountingCost, a.otherCost, a.printingType, a.siteSize]);

  const printingTotal = Math.round(Number(costs.printingRate || 0) * (sqft || 1));
  const mountingTotal = Math.round(Number(costs.mountingRate || 0) * (sqft || 1));
  const total = Number(costs.agreedCost||0) + printingTotal + mountingTotal + Number(costs.otherCost||0);
  const fmt = n => Number(n||0).toLocaleString("en-IN");

  const saveOnBlur = () => {
    onCostUpdate(a.assignmentId, {
      agreedCost: Number(costs.agreedCost)||0,
      printingType: costs.printingType,
      printingCost: printingTotal,
      mountingCost: mountingTotal,
      otherCost: Number(costs.otherCost)||0,
    });
  };

  const startDate = a.bookedFrom || campaignStartDate || "—";
  const endDate   = a.bookedTill || campaignEndDate || "—";

  const inputCls = {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
    borderRadius: 8, color: "#fff", padding: "4px 8px", fontSize: 12, outline: "none",
    textAlign: "right",
  };

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--border)",
        background: isSelected ? "rgba(37,99,235,0.07)" : idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(37,99,235,0.07)" : idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent"; }}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5">
        <div
          onClick={onToggleSelect}
          className="w-4 h-4 rounded flex items-center justify-center border cursor-pointer"
          style={{
            borderColor: isSelected ? "#3B82F6" : "rgba(255,255,255,0.2)",
            background: isSelected ? "#3B82F6" : "transparent",
          }}
        >
          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
      </td>

      {/* # */}
      <td className="px-2 py-2.5 text-xs" style={{ color: "var(--gray2)" }}>{idx + 1}</td>

      {/* Site */}
      <td className="px-2 py-2.5" style={{ minWidth: 160 }}>
        <div className="flex items-center gap-2">
          {a.imageUrl ? (
            <img src={a.imageUrl} alt={a.siteName} className="w-8 h-6 rounded object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
          ) : (
            <div className="w-8 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
              <ImageIcon className="w-3 h-3" style={{ color: "var(--gray2)" }} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-xs text-white truncate" style={{ maxWidth: 160 }}>{a.siteName}</div>
            <div className="text-[10px] truncate" style={{ color: "var(--gray2)", maxWidth: 160 }}>
              {[a.siteCity, a.siteState].filter(Boolean).join(", ")}
            </div>
          </div>
        </div>
      </td>

      {/* Type / Size */}
      <td className="px-2 py-2.5">
        {a.siteType && <span className="text-[10px] font-bold px-2 py-0.5 rounded badge-planned block mb-0.5">{a.siteType}</span>}
        {a.siteSize && <span className="text-[10px]" style={{ color: "var(--gray2)" }}>{a.siteSize}</span>}
      </td>

      {/* Period */}
      <td className="px-2 py-2.5 text-[10px]" style={{ color: "var(--gray)", whiteSpace: "nowrap" }}>
        <div>{startDate}</div>
        <div style={{ color: "var(--gray2)" }}>→ {endDate}</div>
      </td>

      {/* Media Cost */}
      <td className="px-2 py-2.5">
        <input
          type="number"
          value={costs.agreedCost}
          onChange={e => setCosts(c => ({ ...c, agreedCost: e.target.value }))}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 90 }}
          placeholder="0"
        />
      </td>

      {/* Printing — type + rate/sqft stacked */}
      <td className="px-2 py-2.5">
        <select
          value={costs.printingType}
          onChange={e => { setCosts(c => ({ ...c, printingType: e.target.value })); }}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 90, marginBottom: 4, textAlign: "left" }}
        >
          {PRINTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="number"
          value={costs.printingRate}
          onChange={e => setCosts(c => ({ ...c, printingRate: e.target.value }))}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 90 }}
          placeholder="₹/sqft"
        />
        {sqft > 0 && costs.printingRate > 0 && (
          <div style={{ fontSize: 9, color: "var(--gray2)", textAlign: "right", marginTop: 2 }}>= ₹{fmt(printingTotal)}</div>
        )}
      </td>

      {/* Mounting */}
      <td className="px-2 py-2.5">
        <input
          type="number"
          value={costs.mountingRate}
          onChange={e => setCosts(c => ({ ...c, mountingRate: e.target.value }))}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 80 }}
          placeholder="₹/sqft"
        />
        {sqft > 0 && costs.mountingRate > 0 && (
          <div style={{ fontSize: 9, color: "var(--gray2)", textAlign: "right", marginTop: 2 }}>= ₹{fmt(mountingTotal)}</div>
        )}
      </td>

      {/* Other */}
      <td className="px-2 py-2.5">
        <input
          type="number"
          value={costs.otherCost}
          onChange={e => setCosts(c => ({ ...c, otherCost: e.target.value }))}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 80 }}
          placeholder="0"
        />
      </td>

      {/* Total */}
      <td className="px-2 py-2.5 text-xs font-bold text-right" style={{ color: "#60A5FA", whiteSpace: "nowrap" }}>
        ₹{fmt(total)}
      </td>

      {/* Remove */}
      <td className="px-2 py-2.5">
        <button
          onClick={onRemove}
          className="p-1 rounded transition"
          style={{ background: "transparent", color: "var(--gray2)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.background = "rgba(220,20,60,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--gray2)"; e.currentTarget.style.background = "transparent"; }}
          title="Remove site"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
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
