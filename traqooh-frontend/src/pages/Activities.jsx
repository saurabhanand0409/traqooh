import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiFetch } from "../utils/apiFetch";
import { compressImage } from "../utils/imageCompress";
import { requireAuth } from "../utils/auth";

const TYPE_META = {
  PRINT:       { label: "Print",       color: "#3B82F6", badge: "badge-planned" },
  REPRINT:     { label: "Reprint",     color: "#8B5CF6", badge: "badge-sent" },
  MOUNTING:    { label: "Mounting",    color: "#22C55E", badge: "badge-live" },
  AUDIT:       { label: "Audit",       color: "#F59E0B", badge: "badge-confirmed" },
  MAINTENANCE: { label: "Maintenance", color: "#F97316", badge: "badge-confirmed" },
  TAKEDOWN:    { label: "Takedown",    color: "#DC143C", badge: "badge-booked" },
  START:       { label: "Start",       color: "#22C55E", badge: "badge-live" },
  END:         { label: "End",         color: "#6B7280", badge: "badge-draft" },
};

const STATUS_BADGE = { PENDING: "badge-pending", DONE: "badge-done", VERIFIED: "badge-verified" };

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
    {children}
  </th>
);
const trHover = {
  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
  onMouseLeave: e => e.currentTarget.style.background = "transparent",
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Activities() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const [activities, setActivities] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Log Activity modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ campaignId: "", siteId: "", activityType: "MOUNTING", status: "DONE", performedBy: "", activityDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Lightbox
  const [lightbox, setLightbox] = useState(null);

  // Campaign sites (for modal site dropdown)
  const [campaignSites, setCampaignSites] = useState([]);

  useEffect(() => {
    if (!requireAuth(navigate, ["ADMIN", "EMPLOYEE", "SUPER_ADMIN"])) return;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [aRes, cRes] = await Promise.all([
      apiFetch("/api/activities"),
      apiFetch("/api/campaigns"),
    ]);
    if (aRes.ok) setActivities(await aRes.json());
    if (cRes.ok) setCampaigns(await cRes.json());
    setLoading(false);
  };

  // Load sites for selected campaign in modal
  useEffect(() => {
    if (!form.campaignId) { setCampaignSites([]); return; }
    apiFetch(`/api/campaigns/${form.campaignId}`)
      .then(r => r.ok && r.json())
      .then(d => d && setCampaignSites(d.assignments || []))
      .catch(() => {});
  }, [form.campaignId]);

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (filterCampaign && String(a.campaignId) !== filterCampaign) return false;
      if (filterType && a.activityType !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });
  }, [activities, filterCampaign, filterType, filterStatus]);

  const handleLogActivity = async (e) => {
    e.preventDefault();
    setModalError("");
    if (!form.campaignId || !form.siteId) { setModalError("Campaign and site are required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, campaignId: Number(form.campaignId), siteId: Number(form.siteId), createdByUserId: user.userId || null }),
      });
      if (!res.ok) { const d = await res.json(); setModalError(d.detail || "Error saving"); return; }
      const created = await res.json();
      if (file) {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("file", compressed);
        await apiFetch(`/api/activities/${created.id}/upload-image`, { method: "POST", body: fd });
      }
      setShowModal(false);
      setFile(null);
      setForm({ campaignId: "", siteId: "", activityType: "MOUNTING", status: "DONE", performedBy: "", activityDate: new Date().toISOString().slice(0, 10), notes: "" });
      fetchAll();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this activity?")) return;
    await apiFetch(`/api/activities/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const FL = ({ children }) => (
    <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--gray2)" }}>{children}</label>
  );

  return (
    <AppShell user={user}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-syne font-bold text-xl text-white">Execution Activities</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Field activity log — print, mount, audit, takedown</p>
        </div>
        <button
          onClick={() => { setForm({ campaignId: "", siteId: "", activityType: "MOUNTING", status: "DONE", performedBy: user.displayName || "", activityDate: new Date().toISOString().slice(0, 10), notes: "" }); setModalError(""); setFile(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
          Log Activity
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="tq-input select text-sm py-2 px-3 rounded-xl" style={{ minWidth: 160 }}>
          <option value="">All Campaigns</option>
          {campaigns.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="tq-input select text-sm py-2 px-3 rounded-xl">
          <option value="">All Types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="tq-input select text-sm py-2 px-3 rounded-xl">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DONE">Done</option>
          <option value="VERIFIED">Verified</option>
        </select>
        {(filterCampaign || filterType || filterStatus) && (
          <button onClick={() => { setFilterCampaign(""); setFilterType(""); setFilterStatus(""); }} className="text-xs px-3 py-2 rounded-xl" style={{ color: "var(--gray)", border: "1px solid var(--border)" }}>
            Clear
          </button>
        )}
        <span className="ml-auto text-xs self-center" style={{ color: "var(--gray2)" }}>{filtered.length} activities</span>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--gray2)" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-white">No activities found</p>
            <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Log your first field activity using the button above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <TH>Type</TH>
                <TH>Campaign</TH>
                <TH>Site</TH>
                <TH>Date</TH>
                <TH>By</TH>
                <TH>Status</TH>
                <TH>Photos</TH>
                {isAdmin && <TH>Actions</TH>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const tm = TYPE_META[a.activityType] || { label: a.activityType, badge: "badge-draft" };
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tm.badge}`}>{tm.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white truncate max-w-[160px]">{a.campaignName || `#${a.campaignId}`}</td>
                    <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{a.siteName || `#${a.siteId}`}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{fmtDate(a.activityDate || a.createdAt)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--gray)" }}>{a.performedBy || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[a.status] || "badge-draft"}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {a.imageUrls?.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {a.imageUrls.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80" onClick={() => setLightbox(url)} />
                          ))}
                          {a.imageUrls.length > 3 && <span className="text-xs" style={{ color: "var(--gray2)" }}>+{a.imageUrls.length - 3}</span>}
                        </div>
                      ) : <span className="text-xs" style={{ color: "var(--gray2)" }}>—</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(a.id)} className="text-xs font-medium" style={{ color: "#F87171" }}>Delete</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Activity Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleLogActivity} className="rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Log Execution Activity</h2>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
              {modalError && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{modalError}</div>}

              <div>
                <FL>Campaign *</FL>
                <select value={form.campaignId} onChange={e => setForm(f => ({ ...f, campaignId: e.target.value, siteId: "" }))} className="tq-input select w-full" required>
                  <option value="">Select campaign...</option>
                  {campaigns.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <FL>Site *</FL>
                <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))} className="tq-input select w-full" required>
                  <option value="">Select site...</option>
                  {campaignSites.map(s => <option key={s.siteId} value={String(s.siteId)}>{s.siteName} — {s.siteCity}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FL>Activity Type</FL>
                  <select value={form.activityType} onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))} className="tq-input select w-full">
                    {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <FL>Status</FL>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="tq-input select w-full">
                    <option value="PENDING">Pending</option>
                    <option value="DONE">Done</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FL>Activity Date</FL>
                  <input type="date" value={form.activityDate} onChange={e => setForm(f => ({ ...f, activityDate: e.target.value }))} className="tq-input w-full" />
                </div>
                <div>
                  <FL>Performed By</FL>
                  <input value={form.performedBy} onChange={e => setForm(f => ({ ...f, performedBy: e.target.value }))} className="tq-input w-full" placeholder="Name" />
                </div>
              </div>

              <div>
                <FL>Notes</FL>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="tq-input w-full" rows={2} style={{ resize: "none" }} />
              </div>

              <div>
                <FL>Proof Photo (optional)</FL>
                <input
                  type="file" accept="image/*"
                  onChange={e => setFile(e.target.files[0] || null)}
                  className="text-xs w-full"
                  style={{ color: "var(--gray)" }}
                />
                {file && <p className="text-xs mt-1" style={{ color: "#34D399" }}>Will compress before upload</p>}
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
                {saving ? "Saving..." : "Log Activity"}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
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
