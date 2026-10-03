import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiFetch } from "../utils/apiFetch";
import { compressImage } from "../utils/imageCompress";

const STATUS_COLORS = {
  DRAFT: "#6B7280", PLANNED: "#3B82F6", LIVE: "#22C55E",
  COMPLETED: "#8B5CF6", CANCELLED: "#DC143C",
  PENDING: "#F59E0B", DONE: "#22C55E", VERIFIED: "#3B82F6", MISSED: "#DC143C",
};
const STATUS_BADGE = {
  DRAFT: "badge-draft", PLANNED: "badge-planned", LIVE: "badge-live",
  COMPLETED: "badge-completed", CANCELLED: "badge-booked",
  PENDING: "badge-pending", DONE: "badge-done", VERIFIED: "badge-verified",
};
const TYPE_META = {
  PRINT: "badge-planned", REPRINT: "badge-sent", MOUNTING: "badge-live",
  AUDIT: "badge-confirmed", MAINTENANCE: "badge-confirmed",
  TAKEDOWN: "badge-booked", START: "badge-live", END: "badge-draft",
};

const FL = ({ children }) => (
  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--gray2)" }}>{children}</label>
);
const trHover = {
  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
  onMouseLeave: e => e.currentTarget.style.background = "transparent",
};
const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{children}</th>
);

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const [campaign, setCampaign] = useState(null);
  const [availableSites, setAvailableSites] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview"); // overview | sites | activities

  // Single-assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ siteId: "", bookedFrom: "", bookedTill: "", agreedCost: 0 });
  const [assignError, setAssignError] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk-assign modal
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkDates, setBulkDates] = useState({ bookedFrom: "", bookedTill: "", agreedCost: 0 });
  const [bulkError, setBulkError] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Activity modal
  const [showActivity, setShowActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ siteId: "", activityType: "MOUNTING", status: "DONE", performedBy: "", activityDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [activityFile, setActivityFile] = useState(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityError, setActivityError] = useState("");

  // Lightbox
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, sRes, aRes] = await Promise.all([
      apiFetch(`/api/campaigns/${id}`),
      apiFetch(`/api/sites?availabilityStatus=AVAILABLE`),
      apiFetch(`/api/activities?campaignId=${id}`),
    ]);
    if (cRes.ok) setCampaign(await cRes.json());
    if (sRes.ok) setAvailableSites(await sRes.json());
    if (aRes.ok) setActivities(await aRes.json());
    setLoading(false);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignError("");
    if (!assignForm.siteId) { setAssignError("Select a site."); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/campaigns/${id}/assign-site`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...assignForm, siteId: Number(assignForm.siteId), agreedCost: Number(assignForm.agreedCost) }),
      });
      if (!res.ok) { const d = await res.json(); setAssignError(d.detail || "Error assigning site"); return; }
      setShowAssign(false);
      setAssignForm({ siteId: "", bookedFrom: "", bookedTill: "", agreedCost: 0 });
      fetchAll();
    } finally { setSaving(false); }
  };

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    setBulkError("");
    if (!bulkSelected.length) { setBulkError("Select at least one site."); return; }
    if (!bulkDates.bookedFrom || !bulkDates.bookedTill) { setBulkError("Date range required."); return; }
    setSavingBulk(true);
    try {
      const res = await apiFetch(`/api/campaigns/${id}/assign-sites-bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: bulkSelected, bookedFrom: bulkDates.bookedFrom, bookedTill: bulkDates.bookedTill, agreedCost: Number(bulkDates.agreedCost) || 0 }),
      });
      if (!res.ok) { const d = await res.json(); setBulkError(d.detail || "Error assigning sites"); return; }
      setShowBulk(false);
      setBulkSelected([]);
      setBulkDates({ bookedFrom: "", bookedTill: "", agreedCost: 0 });
      fetchAll();
    } finally { setSavingBulk(false); }
  };

  const handleRemoveSite = async (assignmentId) => {
    if (!confirm("Remove this site from the campaign?")) return;
    await apiFetch(`/api/campaigns/${id}/remove-site/${assignmentId}`, { method: "DELETE" });
    fetchAll();
  };

  const handleLogActivity = async (e) => {
    e.preventDefault();
    setActivityError("");
    if (!activityForm.siteId) { setActivityError("Select a site."); return; }
    setSavingActivity(true);
    try {
      const res = await apiFetch(`/api/activities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activityForm, campaignId: Number(id), siteId: Number(activityForm.siteId), createdByUserId: user.userId || null }),
      });
      if (!res.ok) { const d = await res.json(); setActivityError(d.detail || "Error"); return; }
      const created = await res.json();
      if (activityFile) {
        const compressed = await compressImage(activityFile);
        const fd = new FormData();
        fd.append("file", compressed);
        await apiFetch(`/api/activities/${created.id}/upload-image`, { method: "POST", body: fd });
      }
      setShowActivity(false);
      setActivityFile(null);
      setActivityForm({ siteId: "", activityType: "MOUNTING", status: "DONE", performedBy: "", activityDate: new Date().toISOString().slice(0, 10), notes: "" });
      fetchAll();
    } finally { setSavingActivity(false); }
  };

  const handleDeleteActivity = async (actId) => {
    if (!confirm("Delete this activity?")) return;
    await apiFetch(`/api/activities/${actId}`, { method: "DELETE" });
    fetchAll();
  };

  const toggleBulkSite = (siteId) => {
    setBulkSelected(prev => prev.includes(siteId) ? prev.filter(x => x !== siteId) : [...prev, siteId]);
  };

  if (loading) return (
    <AppShell user={user}>
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#2563EB", borderTopColor: "transparent" }} />
      </div>
    </AppShell>
  );

  if (!campaign) return (
    <AppShell user={user}>
      <div className="text-center py-20 text-white">Campaign not found. <Link to="/campaigns" className="underline" style={{ color: "#60A5FA" }}>Back to campaigns</Link></div>
    </AppShell>
  );

  const assignments = campaign.assignments || [];
  const progressDays = (() => {
    if (!campaign.startDate || !campaign.endDate) return 0;
    const start = new Date(campaign.startDate), end = new Date(campaign.endDate), today = new Date();
    const total = (end - start) / 86400000 || 1;
    return Math.min(100, Math.max(0, Math.round(((today - start) / 86400000) / total * 100)));
  })();

  return (
    <AppShell user={user}>
      {/* Back + Header */}
      <div className="mb-2">
        <Link to="/campaigns" className="text-xs font-medium flex items-center gap-1 w-fit mb-3" style={{ color: "var(--gray)" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M15 19l-7-7 7-7" /></svg>
          Campaigns
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-syne font-bold text-xl text-white">{campaign.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>
              {campaign.advertiserName || "No advertiser"} · {campaign.campaignType || "General"}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${STATUS_BADGE[campaign.status] || "badge-draft"}`}>
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Progress bar (if dates set) */}
      {campaign.startDate && campaign.endDate && (
        <div className="mb-5">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--gray2)" }}>
            <span>{fmt(campaign.startDate)}</span>
            <span>{progressDays}% elapsed</span>
            <span>{fmt(campaign.endDate)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressDays}%`, background: "linear-gradient(90deg,#2563EB,#22C55E)" }} />
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Cost", value: `₹${Number(campaign.totalCost || 0).toLocaleString("en-IN")}` },
          { label: "Sites", value: assignments.length },
          { label: "Activities", value: activities.length },
          { label: "Owner", value: campaign.internalOwner || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--gray2)" }}>{label}</p>
            <p className="font-syne font-bold text-lg text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
        {[["overview", "Overview"], ["sites", `Sites (${assignments.length})`], ["activities", `Activities (${activities.length})`]].map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={tab === key ? { background: "rgba(37,99,235,0.2)", color: "#60A5FA" } : { color: "var(--gray2)" }}
          >{label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="glass rounded-2xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["Start Date", fmt(campaign.startDate)],
            ["End Date", fmt(campaign.endDate)],
            ["Campaign Type", campaign.campaignType || "General"],
            ["Advertiser", campaign.advertiserName || "—"],
            ["Internal Owner", campaign.internalOwner || "—"],
            ["Notes", campaign.notes || "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--gray2)" }}>{label}</p>
              <p className="text-sm text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sites Tab */}
      {tab === "sites" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm" style={{ color: "var(--gray2)" }}>{assignments.length} site{assignments.length !== 1 ? "s" : ""} assigned</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setBulkSelected([]); setBulkDates({ bookedFrom: campaign.startDate || "", bookedTill: campaign.endDate || "", agreedCost: 0 }); setBulkError(""); setShowBulk(true); }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", color: "#60A5FA" }}
              >
                Bulk Assign
              </button>
              <button
                onClick={() => { setAssignForm({ siteId: "", bookedFrom: campaign.startDate || "", bookedTill: campaign.endDate || "", agreedCost: 0 }); setAssignError(""); setShowAssign(true); }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
              >
                + Assign Site
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {assignments.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-white">No sites assigned yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Use Bulk Assign to add multiple sites at once.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <TH>Site</TH><TH>Dates</TH><TH>Cost</TH><TH>Status</TH><TH></TH>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.assignmentId} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{a.siteName}</p>
                        <p className="text-xs" style={{ color: "var(--gray2)" }}>{a.siteCity}{a.siteState ? `, ${a.siteState}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{fmt(a.bookedFrom)} → {fmt(a.bookedTill)}</td>
                      <td className="px-4 py-3 font-semibold text-white">₹{Number(a.agreedCost || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[a.status] || "badge-draft"}`}>{a.status || "BOOKED"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && <button onClick={() => handleRemoveSite(a.assignmentId)} className="text-xs" style={{ color: "#F87171" }}>Remove</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {tab === "activities" && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={() => { setActivityForm({ siteId: assignments[0]?.siteId?.toString() || "", activityType: "MOUNTING", status: "DONE", performedBy: user.displayName || "", activityDate: new Date().toISOString().slice(0, 10), notes: "" }); setActivityFile(null); setActivityError(""); setShowActivity(true); }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
            >
              + Log Activity
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            {activities.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-white">No activities yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Field teams can also log from the mobile app.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <TH>Type</TH><TH>Site</TH><TH>Date</TH><TH>By</TH><TH>Status</TH><TH>Photos</TH>
                    {isAdmin && <TH></TH>}
                  </tr>
                </thead>
                <tbody>
                  {activities.map(a => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_META[a.activityType] || "badge-draft"}`}>{a.activityType}</span></td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{a.siteName || `#${a.siteId}`}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{fmt(a.activityDate || a.createdAt)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{a.performedBy || "—"}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[a.status] || "badge-draft"}`}>{a.status}</span></td>
                      <td className="px-4 py-3">
                        {a.imageUrls?.length > 0 ? (
                          <div className="flex gap-1">
                            {a.imageUrls.slice(0, 3).map((url, i) => (
                              <img key={i} src={url} alt="" className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80" onClick={() => setLightbox(url)} />
                            ))}
                          </div>
                        ) : <span className="text-xs" style={{ color: "var(--gray2)" }}>—</span>}
                      </td>
                      {isAdmin && <td className="px-4 py-3"><button onClick={() => handleDeleteActivity(a.id)} className="text-xs" style={{ color: "#F87171" }}>Delete</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Single Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleAssign} className="rounded-2xl w-full max-w-sm" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Assign Site</h2>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              {assignError && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{assignError}</div>}
              <div>
                <FL>Site *</FL>
                <select value={assignForm.siteId} onChange={e => setAssignForm(f => ({ ...f, siteId: e.target.value }))} className="tq-input select w-full" required>
                  <option value="">Select available site...</option>
                  {availableSites.map(s => <option key={s.id} value={String(s.id)}>{s.name} — {s.city}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FL>From</FL><input type="date" value={assignForm.bookedFrom} onChange={e => setAssignForm(f => ({ ...f, bookedFrom: e.target.value }))} className="tq-input w-full" /></div>
                <div><FL>Till</FL><input type="date" value={assignForm.bookedTill} onChange={e => setAssignForm(f => ({ ...f, bookedTill: e.target.value }))} className="tq-input w-full" /></div>
              </div>
              <div><FL>Agreed Cost (₹)</FL><input type="number" value={assignForm.agreedCost} onChange={e => setAssignForm(f => ({ ...f, agreedCost: e.target.value }))} className="tq-input w-full" /></div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>{saving ? "Saving..." : "Assign"}</button>
              <button type="button" onClick={() => setShowAssign(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleBulkAssign} className="rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Bulk Assign Sites</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Select multiple sites to assign with the same dates &amp; cost.</p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto flex-1">
              {bulkError && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{bulkError}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div><FL>From</FL><input type="date" value={bulkDates.bookedFrom} onChange={e => setBulkDates(d => ({ ...d, bookedFrom: e.target.value }))} className="tq-input w-full" /></div>
                <div><FL>Till</FL><input type="date" value={bulkDates.bookedTill} onChange={e => setBulkDates(d => ({ ...d, bookedTill: e.target.value }))} className="tq-input w-full" /></div>
                <div><FL>Cost / site (₹)</FL><input type="number" value={bulkDates.agreedCost} onChange={e => setBulkDates(d => ({ ...d, agreedCost: e.target.value }))} className="tq-input w-full" placeholder="0" /></div>
              </div>
              <div>
                <FL>Select Sites ({bulkSelected.length} selected)</FL>
                <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                  {availableSites.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--gray2)" }}>No available sites.</p>
                  ) : availableSites.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm" style={{ border: "1px solid var(--border)", background: bulkSelected.includes(s.id) ? "rgba(37,99,235,0.12)" : "transparent" }}>
                      <input type="checkbox" checked={bulkSelected.includes(s.id)} onChange={() => toggleBulkSite(s.id)} className="accent-blue-500" />
                      <span className="text-white">{s.name}</span>
                      <span className="text-xs ml-auto" style={{ color: "var(--gray2)" }}>{s.city}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" disabled={savingBulk} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
                {savingBulk ? "Assigning..." : `Assign ${bulkSelected.length || ""} Sites`}
              </button>
              <button type="button" onClick={() => setShowBulk(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Log Activity Modal */}
      {showActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleLogActivity} className="rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Log Activity</h2>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
              {activityError && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{activityError}</div>}
              <div>
                <FL>Site *</FL>
                <select value={activityForm.siteId} onChange={e => setActivityForm(f => ({ ...f, siteId: e.target.value }))} className="tq-input select w-full" required>
                  <option value="">Select site...</option>
                  {assignments.map(a => <option key={a.siteId} value={String(a.siteId)}>{a.siteName} — {a.siteCity}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FL>Activity Type</FL>
                  <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value }))} className="tq-input select w-full">
                    {["PRINT","REPRINT","MOUNTING","AUDIT","MAINTENANCE","TAKEDOWN","START","END"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FL>Status</FL>
                  <select value={activityForm.status} onChange={e => setActivityForm(f => ({ ...f, status: e.target.value }))} className="tq-input select w-full">
                    <option value="PENDING">Pending</option>
                    <option value="DONE">Done</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FL>Date</FL><input type="date" value={activityForm.activityDate} onChange={e => setActivityForm(f => ({ ...f, activityDate: e.target.value }))} className="tq-input w-full" /></div>
                <div><FL>Performed By</FL><input value={activityForm.performedBy} onChange={e => setActivityForm(f => ({ ...f, performedBy: e.target.value }))} className="tq-input w-full" placeholder="Staff name" /></div>
              </div>
              <div><FL>Notes</FL><textarea value={activityForm.notes} onChange={e => setActivityForm(f => ({ ...f, notes: e.target.value }))} className="tq-input w-full" rows={2} style={{ resize: "none" }} /></div>
              <div>
                <FL>Proof Photo</FL>
                <input type="file" accept="image/*" onChange={e => setActivityFile(e.target.files?.[0] || null)} className="text-xs w-full" style={{ color: "var(--gray)" }} />
                {activityFile && <p className="text-xs mt-1" style={{ color: "#34D399" }}>Will compress before upload</p>}
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" disabled={savingActivity} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
                {savingActivity ? "Saving..." : "Log Activity"}
              </button>
              <button type="button" onClick={() => setShowActivity(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="proof" className="max-w-3xl max-h-[85vh] rounded-2xl object-contain" />
        </div>
      )}
    </AppShell>
  );
}
