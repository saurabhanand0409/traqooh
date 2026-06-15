import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  MapPin, Calendar, IndianRupee, ZoomIn, X, Heart, CheckCircle,
  LayoutGrid, Calculator, Send, Image as ImageIcon, ChevronRight,
  Eye, FileText, Printer, Wrench, Check, Copy, ExternalLink
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "";
const PRINTING_TYPES = ["Flex", "Vinyl", "Backlit", "Frontlit", "Star Flex", "Digital Print", "Other"];

const STATUS_COLORS = {
  DRAFT: { bg: "rgba(107,114,128,0.15)", color: "#9CA3AF", border: "rgba(107,114,128,0.3)" },
  PLANNED: { bg: "rgba(37,99,235,0.15)", color: "#60A5FA", border: "rgba(37,99,235,0.3)" },
  LIVE: { bg: "rgba(34,197,94,0.15)", color: "#4ADE80", border: "rgba(34,197,94,0.3)" },
  COMPLETED: { bg: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "rgba(139,92,246,0.3)" },
  CANCELLED: { bg: "rgba(220,20,60,0.15)", color: "#F87171", border: "rgba(220,20,60,0.3)" },
};

function monthsBetween(d1, d2) {
  if (!d1 || !d2) return 1;
  try {
    const a = new Date(d1), b = new Date(d2);
    return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  } catch { return 1; }
}

function fmt(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 };
const darkCard = { background: "#0D1428", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 };
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none",
};

// ── Site Detail Modal ─────────────────────────────────────────────────────────
function SiteDetailModal({ site, campaign, onClose, onLightbox, isShortlisted, onToggleShortlist }) {
  if (!site) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" style={darkCard} onClick={e => e.stopPropagation()}>
        <div className="relative">
          {site.imageUrl ? (
            <img src={site.imageUrl} alt={site.siteName} className="w-full h-56 object-cover rounded-t-2xl" />
          ) : (
            <div className="w-full h-56 rounded-t-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <ImageIcon className="w-12 h-12" style={{ color: "#374151" }} />
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
            <X className="w-4 h-4" />
          </button>
          {site.imageUrl && (
            <button onClick={() => onLightbox(site.imageUrl)} className="absolute top-3 right-12 p-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
              <ZoomIn className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">{site.siteName || "—"}</h2>
              <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>
                {[site.state, site.city].filter(Boolean).join(", ")}
                {site.location ? ` · ${site.location}` : ""}
              </p>
            </div>
            <button onClick={() => onToggleShortlist(site.assignmentId)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition"
              style={isShortlisted
                ? { background: "rgba(244,63,94,0.15)", color: "#FB7185", border: "1px solid rgba(244,63,94,0.3)" }
                : { background: "rgba(255,255,255,0.06)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Heart className={`w-4 h-4 ${isShortlisted ? "fill-current" : ""}`} />
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Site ID", `#${site.siteId}`], ["Type", site.type], ["Lighting", site.lightingType],
              ["Size", site.size], ["Vendor", site.vendorName],
              ["Base Rate", fmtINR(site.baseRate) + " / month"],
              ["Booked From", fmt(site.bookedFrom)], ["Booked Till", fmt(site.bookedTill)],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#6B7280" }}>{label}</div>
                <div className="font-semibold text-white truncate">{val}</div>
              </div>
            ))}
          </div>

          {site.remarks && (
            <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#F59E0B" }}>Remarks</div>
              <div className="text-sm" style={{ color: "#FCD34D" }}>{site.remarks}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.95)" }} onClick={onClose}>
      <img src={url} alt="Site" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ── Finalize Modal ────────────────────────────────────────────────────────────
function FinalizeModal({ campaign, shortlistedSites, grandTotal, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={darkCard}>
        <div className="px-6 py-5" style={{ background: "rgba(34,197,94,0.1)", borderBottom: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6" style={{ color: "#4ADE80" }} />
            <h2 className="text-xl font-bold text-white">Finalize Campaign</h2>
          </div>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Review your selection before confirming.</p>
        </div>
        <div className="p-6 space-y-4">
          {[
            ["Campaign", campaign?.name],
            ["Shortlisted Sites", shortlistedSites.length],
            ["Campaign Period", `${fmt(campaign?.startDate)} — ${fmt(campaign?.endDate)}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-sm" style={{ color: "#9CA3AF" }}>{label}</span>
              <span className="text-sm font-bold text-white">{val}</span>
            </div>
          ))}
          <div className="flex justify-between py-2">
            <span className="text-sm font-bold text-white">Grand Total</span>
            <span className="text-base font-extrabold" style={{ color: "#4ADE80" }}>{fmtINR(grandTotal)}</span>
          </div>
          <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
            By confirming, you approve this campaign proposal. The team will proceed with execution.
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}>Go Back</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)" }}>
              {loading ? "Confirming…" : <><CheckCircle className="w-4 h-4" />Confirm & Finalize</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Site Card ─────────────────────────────────────────────────────────────────
function SiteCard({ site, isShortlisted, onToggleShortlist, onViewDetail, onLightbox }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="rounded-2xl overflow-hidden transition-all"
      style={{ ...card, boxShadow: hover ? "0 0 0 1px rgba(37,99,235,0.3)" : "none" }}>
      <div className="relative">
        {site.imageUrl ? (
          <img src={site.imageUrl} alt={site.siteName} className="w-full h-44 object-cover cursor-zoom-in"
            onClick={() => onLightbox(site.imageUrl)} />
        ) : (
          <div className="w-full h-44 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <ImageIcon className="w-10 h-10" style={{ color: "#374151" }} />
          </div>
        )}
        <button onClick={() => onToggleShortlist(site.assignmentId)}
          className="absolute top-2.5 right-2.5 p-2 rounded-full shadow-lg transition"
          style={isShortlisted
            ? { background: "#DC143C", color: "#fff" }
            : { background: "rgba(7,12,26,0.7)", color: "#6B7280" }}>
          <Heart className={`w-4 h-4 ${isShortlisted ? "fill-white" : ""}`} />
        </button>
        {site.type && (
          <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(7,12,26,0.75)", color: "#D1D5DB" }}>
            {site.type}{site.lightingType ? ` · ${site.lightingType}` : ""}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-white text-base leading-tight cursor-pointer hover:text-blue-400 transition"
          onClick={() => onViewDetail(site)}>
          {site.siteName || "Unnamed Site"}
        </h3>
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#6B7280" }}>
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[site.state, site.city, site.location].filter(Boolean).join(", ") || "—"}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {site.size && (
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#6B7280" }}>Size</div>
              <div className="font-bold text-white">{site.size}</div>
            </div>
          )}
          {site.vendorName && (
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#6B7280" }}>Vendor</div>
              <div className="font-bold text-white truncate">{site.vendorName}</div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Base Rate / Month</div>
            <div className="text-base font-extrabold text-white">{fmtINR(site.baseRate)}</div>
          </div>
          <button onClick={() => onViewDetail(site)}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
            style={{ color: "#60A5FA", background: "rgba(37,99,235,0.1)" }}>
            <Eye className="w-3.5 h-3.5" /> Details
          </button>
        </div>
      </div>

      {isShortlisted && (
        <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-bold"
          style={{ background: "rgba(220,20,60,0.1)", borderTop: "1px solid rgba(220,20,60,0.2)", color: "#FB7185" }}>
          <Heart className="w-3.5 h-3.5 fill-current" /> Shortlisted
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AccessView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sites");
  const [selectedSite, setSelectedSite] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [shortlisted, setShortlisted] = useState(new Set());
  const [useCustomDates, setUseCustomDates] = useState({});
  const [siteDates, setSiteDates] = useState({});
  const [siteCharges, setSiteCharges] = useState({});
  const [selectedShortlisted, setSelectedShortlisted] = useState(new Set());
  const [bulkChargeForm, setBulkChargeForm] = useState({ printingType: "Flex", printingCost: "", mountingCost: "", otherCost: "" });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/access/${token}`);
        if (!res.ok) { const d = await res.json(); setError(d.detail || "Invalid or expired link"); return; }
        const d = await res.json();
        setData(d);
        const campaign = d.campaigns?.[0];
        if (campaign) {
          const sSet = new Set();
          const custom = {}, dates = {}, charges = {};
          for (const s of (campaign.sites || [])) {
            if (s.isShortlisted) sSet.add(s.assignmentId);
            if (s.finalStartDate || s.finalEndDate) {
              custom[s.assignmentId] = true;
              dates[s.assignmentId] = { start: s.finalStartDate || "", end: s.finalEndDate || "" };
            }
            charges[s.assignmentId] = {
              printingType: s.printingType || "Flex",
              printingCost: s.printingCost || 0,
              mountingCost: s.mountingCost || 0,
              otherCost: s.otherCost || 0,
            };
          }
          setShortlisted(sSet); setUseCustomDates(custom); setSiteDates(dates); setSiteCharges(charges);
        }
      } catch { setError("Failed to load. The link may be expired."); }
      finally { setLoading(false); }
    };
    load();
  }, [token]);

  const campaign = data?.campaigns?.[0];
  const allSites = campaign?.sites || [];
  const shortlistedSites = allSites.filter(s => shortlisted.has(s.assignmentId));

  const getEffectiveDates = (id) => {
    if (useCustomDates[id] && siteDates[id]) return { start: siteDates[id].start, end: siteDates[id].end };
    return { start: campaign?.startDate || "", end: campaign?.endDate || "" };
  };
  const getCharges = (id) => siteCharges[id] || { printingType: "Flex", printingCost: 0, mountingCost: 0, otherCost: 0 };
  const computeSiteBase = (site, id) => (site.baseRate || 0) * monthsBetween(...Object.values(getEffectiveDates(id)));
  const computeSiteTotal = (site, id) => {
    const ch = getCharges(id);
    return computeSiteBase(site, id) + Number(ch.printingCost || 0) + Number(ch.mountingCost || 0) + Number(ch.otherCost || 0);
  };
  const grandTotal = shortlistedSites.reduce((a, s) => a + computeSiteTotal(s, s.assignmentId), 0);
  const totalMedia = shortlistedSites.reduce((a, s) => a + computeSiteBase(s, s.assignmentId), 0);
  const totalPrinting = shortlistedSites.reduce((a, s) => a + Number(getCharges(s.assignmentId).printingCost || 0), 0);
  const totalMounting = shortlistedSites.reduce((a, s) => a + Number(getCharges(s.assignmentId).mountingCost || 0), 0);
  const totalOther = shortlistedSites.reduce((a, s) => a + Number(getCharges(s.assignmentId).otherCost || 0), 0);

  const toggleShortlist = (id) => setShortlisted(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const updateCharge = (id, field, value) => setSiteCharges(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));

  const toggleRowSel = (id) => setSelectedShortlisted(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAllShortlisted = () => {
    setSelectedShortlisted(prev =>
      prev.size === shortlistedSites.length && shortlistedSites.length > 0
        ? new Set()
        : new Set(shortlistedSites.map(s => s.assignmentId))
    );
  };
  const applyBulkCharges = () => {
    const patch = { printingType: bulkChargeForm.printingType };
    if (bulkChargeForm.printingCost !== "") patch.printingCost = Number(bulkChargeForm.printingCost);
    if (bulkChargeForm.mountingCost !== "") patch.mountingCost = Number(bulkChargeForm.mountingCost);
    if (bulkChargeForm.otherCost !== "") patch.otherCost = Number(bulkChargeForm.otherCost);
    setSiteCharges(prev => {
      const next = { ...prev };
      for (const id of selectedShortlisted) next[id] = { ...(next[id] || {}), ...patch };
      return next;
    });
    setSelectedShortlisted(new Set());
  };

  const buildPayload = () => ({
    assignments: allSites.map(s => ({
      assignmentId: s.assignmentId,
      isShortlisted: shortlisted.has(s.assignmentId),
      finalStartDate: useCustomDates[s.assignmentId] ? (siteDates[s.assignmentId]?.start || null) : null,
      finalEndDate: useCustomDates[s.assignmentId] ? (siteDates[s.assignmentId]?.end || null) : null,
      ...(siteCharges[s.assignmentId] || {}),
    })),
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/access/${token}/shortlist`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { setSaveMsg("Saved!"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await fetch(`${API}/api/access/${token}/shortlist`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()),
      });
      const res = await fetch(`${API}/api/access/${token}/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign?.id }),
      });
      if (res.ok) { setFinalized(true); setShowFinalModal(false); }
      else { const d = await res.json(); alert(d.detail || "Finalize failed"); }
    } catch { alert("Network error"); }
    setFinalizing(false);
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 grid place-items-center text-white font-bold text-xl"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>t</div>
        <p className="font-semibold" style={{ color: "#6B7280" }}>Verifying your access…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="mt-2" style={{ color: "#9CA3AF" }}>{error}</p>
      </div>
    </div>
  );

  if (finalized) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#070C1A" }}>
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(34,197,94,0.2)", border: "2px solid #22C55E" }}>
          <CheckCircle className="w-10 h-10" style={{ color: "#4ADE80" }} />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">Campaign Finalized!</h1>
        <p className="text-lg mb-2" style={{ color: "#9CA3AF" }}>
          Thank you, <span className="font-bold text-white">{data?.advertiser}</span>.
        </p>
        <p style={{ color: "#6B7280" }}>
          <span className="font-semibold text-white">"{campaign?.name}"</span> confirmed with{" "}
          <span className="font-bold" style={{ color: "#4ADE80" }}>{shortlistedSites.length} site{shortlistedSites.length !== 1 ? "s" : ""}</span>.
          The traqOOH team will be in touch.
        </p>
        <div className="mt-6 rounded-2xl p-5 text-left space-y-2 text-sm" style={darkCard}>
          {[
            ["Total Sites", shortlistedSites.length],
            ["Period", `${fmt(campaign?.startDate)} — ${fmt(campaign?.endDate)}`],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span style={{ color: "#9CA3AF" }}>{l}</span>
              <span className="font-bold text-white">{v}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="font-bold text-white">Grand Total</span>
            <span className="font-extrabold text-base" style={{ color: "#4ADE80" }}>{fmtINR(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────
  const statusStyle = STATUS_COLORS[campaign?.status] || STATUS_COLORS.DRAFT;
  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#fff", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(7,12,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg grid place-items-center font-bold text-lg text-white"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>t</div>
            <span className="font-bold tracking-tight" style={{ color: "#60A5FA" }}>traqOOH</span>
          </div>
          <span className="text-xs font-medium hidden sm:block" style={{ color: "#6B7280" }}>
            Campaign Proposal — {data?.advertiser}
          </span>
        </div>
      </header>

      {/* Campaign Banner */}
      <div style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(220,20,60,0.15) 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                  {campaign?.status || "DRAFT"}
                </span>
                {campaign?.campaignType && <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{campaign.campaignType}</span>}
              </div>
              <h1 className="text-2xl font-extrabold text-white">{campaign?.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>For {data?.advertiser}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              {[
                { icon: <Calendar className="w-3.5 h-3.5" />, text: `${fmt(campaign?.startDate)} — ${fmt(campaign?.endDate)}` },
                { icon: <MapPin className="w-3.5 h-3.5" />, text: `${allSites.length} Site${allSites.length !== 1 ? "s" : ""} Proposed` },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "#D1D5DB" }}>
                  {item.icon} {item.text}
                </div>
              ))}
              {shortlisted.size > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.2)", color: "#FB7185" }}>
                  <Heart className="w-3.5 h-3.5 fill-current" /> {shortlisted.size} Shortlisted
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="sticky top-14 z-40" style={{ background: "rgba(7,12,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex gap-1">
            {[
              { id: "sites", label: "All Sites", icon: <LayoutGrid className="w-4 h-4" />, count: allSites.length },
              { id: "shortlisted", label: "Shortlisted", icon: <Heart className="w-4 h-4" />, count: shortlisted.size },
              { id: "costsheet", label: "Cost Sheet", icon: <Calculator className="w-4 h-4" /> },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition"
                style={{
                  borderColor: activeTab === tab.id ? "#2563EB" : "transparent",
                  color: activeTab === tab.id ? "#60A5FA" : "#6B7280",
                }}>
                {tab.icon} {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: activeTab === tab.id ? "#2563EB" : "rgba(255,255,255,0.08)", color: "#fff" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-5 py-6">

        {/* ── ALL SITES ── */}
        {activeTab === "sites" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Proposed Sites <span className="font-normal text-base" style={{ color: "#6B7280" }}>({allSites.length})</span>
              </h2>
              {shortlisted.size > 0 && (
                <button onClick={() => setActiveTab("shortlisted")} className="text-sm font-semibold flex items-center gap-1 transition" style={{ color: "#60A5FA" }}>
                  View Shortlist ({shortlisted.size}) <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {allSites.length === 0 ? (
              <div className="py-20 text-center rounded-2xl" style={card}>
                <MapPin className="w-12 h-12 mx-auto mb-3" style={{ color: "#374151" }} />
                <p className="font-semibold" style={{ color: "#6B7280" }}>No sites have been added to this campaign yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allSites.map(site => (
                  <SiteCard key={site.assignmentId} site={site}
                    isShortlisted={shortlisted.has(site.assignmentId)}
                    onToggleShortlist={toggleShortlist}
                    onViewDetail={setSelectedSite}
                    onLightbox={setLightboxUrl} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SHORTLISTED ── */}
        {activeTab === "shortlisted" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Shortlisted Sites <span className="font-normal text-base" style={{ color: "#6B7280" }}>({shortlistedSites.length})</span>
              </h2>
              {shortlistedSites.length > 0 && (
                <button onClick={() => setActiveTab("costsheet")} className="text-sm font-semibold flex items-center gap-1" style={{ color: "#60A5FA" }}>
                  View Cost Sheet <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {shortlistedSites.length === 0 ? (
              <div className="py-20 text-center rounded-2xl" style={{ ...card, border: "2px dashed rgba(255,255,255,0.08)" }}>
                <Heart className="w-12 h-12 mx-auto mb-3" style={{ color: "#374151" }} />
                <p className="font-semibold text-white">No sites shortlisted yet</p>
                <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Go to "All Sites" and tap the heart icon to shortlist sites.</p>
                <button onClick={() => setActiveTab("sites")} className="mt-4 text-sm font-bold" style={{ color: "#60A5FA" }}>Browse Sites →</button>
              </div>
            ) : (() => {
              const allSel = selectedShortlisted.size === shortlistedSites.length && shortlistedSites.length > 0;
              const someSel = selectedShortlisted.size > 0 && !allSel;
              const cellInput = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "4px 8px", fontSize: 12, width: "100%", outline: "none" };
              return (
                <div className="rounded-2xl overflow-hidden" style={darkCard}>
                  {/* Bulk apply bar */}
                  {selectedShortlisted.size > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ background: "rgba(37,99,235,0.12)", borderBottom: "1px solid rgba(37,99,235,0.25)" }}>
                      <span className="text-xs font-bold" style={{ color: "#60A5FA" }}>{selectedShortlisted.size} selected — Apply common rate:</span>
                      <select value={bulkChargeForm.printingType} onChange={e => setBulkChargeForm(f => ({ ...f, printingType: e.target.value }))}
                        style={{ ...cellInput, width: 90 }}>
                        {PRINTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {[["Print ₹","printingCost"],["Mount ₹","mountingCost"],["Other ₹","otherCost"]].map(([lbl,key]) => (
                        <input key={key} type="number" placeholder={lbl} value={bulkChargeForm[key]}
                          onChange={e => setBulkChargeForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ ...cellInput, width: 88 }} />
                      ))}
                      <button onClick={applyBulkCharges}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>
                        ✓ Apply to {selectedShortlisted.size}
                      </button>
                      <button onClick={() => setSelectedShortlisted(new Set())} className="text-xs font-bold" style={{ color: "#6B7280" }}>Clear</button>
                    </div>
                  )}

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 980 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
                          <th className="px-3 py-3 w-8">
                            <div onClick={toggleSelectAllShortlisted}
                              className="w-4 h-4 rounded flex items-center justify-center border cursor-pointer"
                              style={{ borderColor: allSel ? "#3B82F6" : "rgba(255,255,255,0.2)", background: allSel ? "#3B82F6" : someSel ? "rgba(59,130,246,0.3)" : "transparent" }}>
                              {allSel ? <span style={{ color: "#fff", fontSize: 9 }}>✓</span> : someSel ? <div style={{ width: 8, height: 1, background: "#60A5FA", borderRadius: 1 }} /> : null}
                            </div>
                          </th>
                          {["#","Site","Type / Size","Period","Media Cost","Printing","Mounting","Other","Total",""].map(h => (
                            <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shortlistedSites.map((site, idx) => {
                          const id = site.assignmentId;
                          const custom = !!useCustomDates[id];
                          const { start, end } = getEffectiveDates(id);
                          const ch = getCharges(id);
                          const months = monthsBetween(start, end);
                          const base = (site.baseRate || 0) * months;
                          const total = computeSiteTotal(site, id);
                          const isSel = selectedShortlisted.has(id);
                          return (
                            <tr key={id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSel ? "rgba(37,99,235,0.07)" : idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                              {/* Checkbox */}
                              <td className="px-3 py-3">
                                <div onClick={() => toggleRowSel(id)} className="w-4 h-4 rounded flex items-center justify-center border cursor-pointer"
                                  style={{ borderColor: isSel ? "#3B82F6" : "rgba(255,255,255,0.2)", background: isSel ? "#3B82F6" : "transparent" }}>
                                  {isSel && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                                </div>
                              </td>
                              {/* # */}
                              <td className="px-3 py-3 text-xs" style={{ color: "#6B7280" }}>{idx + 1}</td>
                              {/* Site */}
                              <td className="px-3 py-3" style={{ minWidth: 170 }}>
                                <div className="flex items-center gap-2">
                                  {site.imageUrl
                                    ? <img src={site.imageUrl} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0 cursor-zoom-in" onClick={() => setLightboxUrl(site.imageUrl)} style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                                    : <div className="w-8 h-6 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}><ImageIcon className="w-3 h-3" style={{ color: "#374151" }} /></div>
                                  }
                                  <div className="min-w-0">
                                    <div className="font-semibold text-xs text-white truncate" style={{ maxWidth: 160 }}>{site.siteName}</div>
                                    <div className="text-[10px] truncate" style={{ color: "#6B7280", maxWidth: 160 }}>{[site.state, site.city].filter(Boolean).join(", ")}</div>
                                  </div>
                                </div>
                              </td>
                              {/* Type/Size */}
                              <td className="px-3 py-3" style={{ minWidth: 90 }}>
                                {site.type && <div className="text-[10px] font-bold px-2 py-0.5 rounded mb-0.5 w-fit" style={{ background: "rgba(37,99,235,0.15)", color: "#60A5FA" }}>{site.type}</div>}
                                {site.size && <div className="text-[10px]" style={{ color: "#6B7280" }}>{site.size}</div>}
                              </td>
                              {/* Period */}
                              <td className="px-3 py-3" style={{ minWidth: 170 }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <button onClick={() => setUseCustomDates(prev => ({ ...prev, [id]: false }))}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: !custom ? "#0D1428" : "transparent", color: !custom ? "#60A5FA" : "#4B5563", border: !custom ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent" }}>
                                    Campaign
                                  </button>
                                  <button onClick={() => setUseCustomDates(prev => ({ ...prev, [id]: true }))}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: custom ? "#0D1428" : "transparent", color: custom ? "#60A5FA" : "#4B5563", border: custom ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent" }}>
                                    Custom
                                  </button>
                                </div>
                                {!custom ? (
                                  <div className="text-[10px]" style={{ color: "#9CA3AF" }}>
                                    <div>{fmt(start)} →</div>
                                    <div>{fmt(end)}</div>
                                    <div style={{ color: "#6B7280" }}>{months} mo</div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <input type="date" value={siteDates[id]?.start || ""} style={{ ...cellInput, fontSize: 11 }}
                                      onChange={e => setSiteDates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), start: e.target.value } }))} />
                                    <input type="date" value={siteDates[id]?.end || ""} style={{ ...cellInput, fontSize: 11 }}
                                      onChange={e => setSiteDates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), end: e.target.value } }))} />
                                  </div>
                                )}
                              </td>
                              {/* Media Cost */}
                              <td className="px-3 py-3 text-xs font-semibold text-white whitespace-nowrap">{fmtINR(base)}</td>
                              {/* Printing */}
                              <td className="px-3 py-3" style={{ minWidth: 120 }}>
                                <select value={ch.printingType || "Flex"} onChange={e => updateCharge(id, "printingType", e.target.value)}
                                  style={{ ...cellInput, marginBottom: 4 }}>
                                  {PRINTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input type="number" min="0" placeholder="0" value={ch.printingCost || ""}
                                  onChange={e => updateCharge(id, "printingCost", e.target.value)} style={cellInput} />
                              </td>
                              {/* Mounting */}
                              <td className="px-3 py-3" style={{ minWidth: 90 }}>
                                <input type="number" min="0" placeholder="0" value={ch.mountingCost || ""}
                                  onChange={e => updateCharge(id, "mountingCost", e.target.value)} style={cellInput} />
                              </td>
                              {/* Other */}
                              <td className="px-3 py-3" style={{ minWidth: 90 }}>
                                <input type="number" min="0" placeholder="0" value={ch.otherCost || ""}
                                  onChange={e => updateCharge(id, "otherCost", e.target.value)} style={cellInput} />
                              </td>
                              {/* Total */}
                              <td className="px-3 py-3 text-xs font-extrabold whitespace-nowrap" style={{ color: "#60A5FA" }}>{fmtINR(total)}</td>
                              {/* Remove */}
                              <td className="px-3 py-3">
                                <button onClick={() => toggleShortlist(id)} className="p-1 rounded transition"
                                  style={{ color: "#6B7280" }}
                                  onMouseEnter={e => { e.currentTarget.style.color = "#FB7185"; e.currentTarget.style.background = "rgba(244,63,94,0.1)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.background = "transparent"; }}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "2px solid rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.08)" }}>
                          <td colSpan={5} className="px-3 py-3 text-xs font-bold" style={{ color: "#60A5FA" }}>Estimated Total — {shortlistedSites.length} sites</td>
                          <td className="px-3 py-3 text-xs font-bold text-white">{fmtINR(totalMedia)}</td>
                          <td className="px-3 py-3 text-xs font-bold text-white">{fmtINR(totalPrinting)}</td>
                          <td className="px-3 py-3 text-xs font-bold text-white">{fmtINR(totalMounting)}</td>
                          <td className="px-3 py-3 text-xs font-bold text-white">{fmtINR(totalOther)}</td>
                          <td className="px-3 py-3 text-sm font-extrabold" style={{ color: "#60A5FA" }}>{fmtINR(grandTotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Footer with Cost Sheet link */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-xs" style={{ color: "#6B7280" }}>Changes are saved automatically when you finalize.</span>
                    <button onClick={() => setActiveTab("costsheet")} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: "#2563EB" }}>
                      <Calculator className="w-4 h-4" /> View Cost Sheet
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── COST SHEET ── */}
        {activeTab === "costsheet" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Cost Sheet</h2>
              <div className="text-xs font-semibold" style={{ color: "#6B7280" }}>{shortlistedSites.length} sites</div>
            </div>

            {shortlistedSites.length === 0 ? (
              <div className="py-20 text-center rounded-2xl" style={{ ...card, border: "2px dashed rgba(255,255,255,0.08)" }}>
                <Calculator className="w-12 h-12 mx-auto mb-3" style={{ color: "#374151" }} />
                <p className="font-semibold text-white">No sites shortlisted yet</p>
                <button onClick={() => setActiveTab("sites")} className="mt-4 text-sm font-bold" style={{ color: "#60A5FA" }}>Browse Sites →</button>
              </div>
            ) : (
              <>
                <div className="rounded-2xl p-5" style={darkCard}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#6B7280" }}>Campaign Summary</div>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    {[["Campaign", campaign?.name], ["Advertiser", data?.advertiser], ["Period", `${fmt(campaign?.startDate)} — ${fmt(campaign?.endDate)}`]].map(([l, v]) => (
                      <div key={l}><div className="text-xs font-semibold mb-0.5" style={{ color: "#6B7280" }}>{l}</div><div className="font-bold text-white">{v}</div></div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden" style={darkCard}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {["#", "Site", "Type / Size", "Period", "Media Cost", "Printing", "Mounting", "Other", "Total"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "#6B7280" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shortlistedSites.map((site, idx) => {
                          const id = site.assignmentId;
                          const { start, end } = getEffectiveDates(id);
                          const months = monthsBetween(start, end);
                          const ch = getCharges(id);
                          const base = (site.baseRate || 0) * months;
                          const total = computeSiteTotal(site, id);
                          return (
                            <tr key={id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td className="px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white whitespace-nowrap">{site.siteName}</div>
                                <div className="text-xs" style={{ color: "#6B7280" }}>{[site.state, site.city].filter(Boolean).join(", ")}</div>
                                {useCustomDates[id] && <div className="text-[10px] font-semibold mt-0.5" style={{ color: "#60A5FA" }}>Custom dates</div>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-medium text-white">{site.type || "—"}</div>
                                <div className="text-xs" style={{ color: "#6B7280" }}>{site.size || "—"}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9CA3AF" }}>
                                <div>{fmt(start)} →</div>
                                <div>{fmt(end)}</div>
                                <div className="text-xs" style={{ color: "#6B7280" }}>{months} mo</div>
                              </td>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap text-white">{fmtINR(base)}</td>
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9CA3AF" }}>
                                <div>{fmtINR(ch.printingCost)}</div>
                                {ch.printingType && <div className="text-xs" style={{ color: "#6B7280" }}>{ch.printingType}</div>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9CA3AF" }}>{fmtINR(ch.mountingCost)}</td>
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9CA3AF" }}>{fmtINR(ch.otherCost)}</td>
                              <td className="px-4 py-3 font-extrabold whitespace-nowrap text-white">{fmtINR(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "2px solid rgba(37,99,235,0.4)", background: "rgba(37,99,235,0.08)" }}>
                          <td colSpan={4} className="px-4 py-3 font-bold text-white text-sm">TOTAL</td>
                          {[totalMedia, totalPrinting, totalMounting, totalOther].map((v, i) => (
                            <td key={i} className="px-4 py-3 font-bold text-white">{fmtINR(v)}</td>
                          ))}
                          <td className="px-4 py-3 font-extrabold text-base" style={{ color: "#60A5FA" }}>{fmtINR(grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Grand total CTA */}
                <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(220,20,60,0.2))", border: "1px solid rgba(37,99,235,0.3)" }}>
                  <div>
                    <div className="text-sm font-semibold mb-1" style={{ color: "#9CA3AF" }}>
                      Grand Total ({shortlistedSites.length} sites · {monthsBetween(campaign?.startDate, campaign?.endDate)} months)
                    </div>
                    <div className="text-3xl font-extrabold text-white">{fmtINR(grandTotal)}</div>
                    <div className="text-xs mt-1" style={{ color: "#6B7280" }}>
                      Media {fmtINR(totalMedia)} + Print {fmtINR(totalPrinting)} + Mount {fmtINR(totalMounting)} + Other {fmtINR(totalOther)}
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={handleSaveDraft} disabled={saving}
                      className="flex-1 sm:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                      style={{ background: "rgba(255,255,255,0.1)", color: "#D1D5DB" }}>
                      {saving ? "Saving…" : <><FileText className="w-4 h-4" />Save Draft</>}
                    </button>
                    <button onClick={() => setShowFinalModal(true)}
                      className="flex-1 sm:flex-none flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition"
                      style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)" }}>
                      <CheckCircle className="w-4 h-4" /> Finalize &amp; Start
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Sticky action bar */}
      {shortlisted.size > 0 && activeTab !== "costsheet" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3" style={{ background: "rgba(11,17,32,0.96)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="font-bold text-white">{shortlisted.size} site{shortlisted.size !== 1 ? "s" : ""} shortlisted</span>
              <span className="ml-2" style={{ color: "#6B7280" }}>· Est. {fmtINR(grandTotal)}</span>
              {saveMsg && <span className="ml-3 text-xs font-semibold" style={{ color: "#4ADE80" }}>{saveMsg}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveDraft} disabled={saving}
                className="text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.08)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.1)" }}>
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button onClick={() => setActiveTab("costsheet")}
                className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                style={{ background: "#2563EB" }}>
                <Calculator className="w-3.5 h-3.5" /> Cost Sheet
              </button>
            </div>
          </div>
        </div>
      )}
      {shortlisted.size > 0 && activeTab !== "costsheet" && <div className="h-16" />}

      {/* Modals */}
      <SiteDetailModal
        site={selectedSite} campaign={campaign}
        onClose={() => setSelectedSite(null)}
        onLightbox={url => { setSelectedSite(null); setLightboxUrl(url); }}
        isShortlisted={selectedSite ? shortlisted.has(selectedSite.assignmentId) : false}
        onToggleShortlist={toggleShortlist}
      />
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      {showFinalModal && (
        <FinalizeModal campaign={campaign} shortlistedSites={shortlistedSites} grandTotal={grandTotal}
          onConfirm={handleFinalize} onCancel={() => setShowFinalModal(false)} loading={finalizing} />
      )}

      <footer className="text-center py-6 text-xs" style={{ color: "#374151", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        Powered by <span className="font-bold" style={{ color: "#2563EB" }}>traqOOH</span> · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
