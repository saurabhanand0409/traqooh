import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  MapPin, Calendar, IndianRupee, ZoomIn, X, Heart, CheckCircle,
  LayoutGrid, ListChecks, Calculator, Send, Building2,
  Image as ImageIcon, ChevronRight, Info, Star, Check,
  Zap, Eye, FileText, Printer, Wrench, PlusCircle, Download
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "";

const PRINTING_TYPES = ["Flex", "Vinyl", "Backlit", "Frontlit", "Star Flex", "Digital Print", "Other"];

const STATUS_STYLES = {
  DRAFT: "bg-gray-100 text-gray-600",
  PLANNED: "bg-blue-50 text-blue-700",
  LIVE: "bg-green-50 text-green-700",
  COMPLETED: "bg-purple-50 text-purple-700",
  CANCELLED: "bg-red-50 text-red-600",
};

function monthsBetween(d1, d2) {
  if (!d1 || !d2) return 1;
  try {
    const a = new Date(d1), b = new Date(d2);
    const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    return Math.max(1, m);
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

// ─── Site Detail Modal ────────────────────────────────────────────────────────
function SiteDetailModal({ site, campaign, onClose, onLightbox, isShortlisted, onToggleShortlist }) {
  if (!site) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div className="relative">
          {site.imageUrl ? (
            <img src={site.imageUrl} alt={site.siteName} className="w-full h-56 object-cover rounded-t-2xl" />
          ) : (
            <div className="w-full h-56 bg-gray-200 rounded-t-2xl flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-gray-400" />
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
          {site.imageUrl && (
            <button onClick={() => onLightbox(site.imageUrl)} className="absolute top-3 right-12 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg transition" title="Enlarge">
              <ZoomIn className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{site.siteName || "—"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {[site.state, site.city].filter(Boolean).join(", ")}
                {site.location ? ` · ${site.location}` : ""}
              </p>
            </div>
            <button
              onClick={() => onToggleShortlist(site.assignmentId)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition ${
                isShortlisted
                  ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
              }`}
            >
              <Heart className={`w-4 h-4 ${isShortlisted ? "fill-rose-500 text-rose-500" : ""}`} />
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Site ID", `#${site.siteId}`],
              ["Type", site.type],
              ["Lighting", site.lightingType],
              ["Size", site.size],
              ["Vendor", site.vendorName],
              ["Base Rate", fmtINR(site.baseRate) + " / month"],
              ["Status", site.availabilityStatus],
              ["Booked From", fmt(site.bookedFrom)],
              ["Booked Till", fmt(site.bookedTill)],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="font-semibold text-gray-800 mt-0.5 truncate">{val}</div>
              </div>
            ))}
          </div>

          {site.address && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Full Address</div>
              <div className="text-blue-800 font-medium">{site.address}</div>
            </div>
          )}
          {site.remarks && (
            <div className="bg-amber-50 rounded-xl p-3 text-sm">
              <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Remarks</div>
              <div className="text-amber-800">{site.remarks}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function Lightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90" onClick={onClose}>
      <img src={url} alt="Site" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Finalize Confirm Modal ───────────────────────────────────────────────────
function FinalizeModal({ campaign, shortlistedSites, grandTotal, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Finalize Campaign</h2>
          </div>
          <p className="text-green-100 text-sm">Review your selection before confirming.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Campaign</span>
              <span className="font-bold text-gray-900">{campaign?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Shortlisted Sites</span>
              <span className="font-bold text-gray-900">{shortlistedSites.length}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Campaign Period</span>
              <span className="font-bold text-gray-900">{fmt(campaign?.startDate)} — {fmt(campaign?.endDate)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 font-bold">Grand Total</span>
              <span className="font-extrabold text-green-700 text-base">{fmtINR(grandTotal)}</span>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium">
            By confirming, you approve this campaign proposal. The campaign team will be notified and will proceed with execution.
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
              Go Back
            </button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? "Confirming..." : <><CheckCircle className="w-4 h-4" /> Confirm & Finalize</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Site Card (browse grid) ──────────────────────────────────────────────────
function SiteCard({ site, isShortlisted, onToggleShortlist, onViewDetail, onLightbox }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all overflow-hidden group">
      {/* Image */}
      <div className="relative">
        {site.imageUrl ? (
          <img
            src={site.imageUrl}
            alt={site.siteName}
            className="w-full h-44 object-cover cursor-zoom-in"
            onClick={() => onLightbox(site.imageUrl)}
          />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {/* Shortlist heart overlay */}
        <button
          onClick={() => onToggleShortlist(site.assignmentId)}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full shadow-lg transition ${
            isShortlisted ? "bg-rose-500 text-white" : "bg-white/90 text-gray-400 hover:text-rose-500"
          }`}
          title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
        >
          <Heart className={`w-4 h-4 ${isShortlisted ? "fill-white" : ""}`} />
        </button>
        {/* Type badge */}
        {site.type && (
          <span className="absolute bottom-2.5 left-2.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {site.type}{site.lightingType ? ` · ${site.lightingType}` : ""}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3
          className="font-bold text-gray-900 text-base leading-tight hover:text-blue-700 cursor-pointer transition group-hover:text-blue-700"
          onClick={() => onViewDetail(site)}
        >
          {site.siteName || "Unnamed Site"}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[site.state, site.city, site.location].filter(Boolean).join(", ") || "—"}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {site.size && (
            <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
              <div className="text-gray-400 font-semibold text-[9px] uppercase tracking-wider">Size</div>
              <div className="font-bold text-gray-700">{site.size}</div>
            </div>
          )}
          {site.vendorName && (
            <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
              <div className="text-gray-400 font-semibold text-[9px] uppercase tracking-wider">Vendor</div>
              <div className="font-bold text-gray-700 truncate">{site.vendorName}</div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Base Rate / Month</div>
            <div className="text-base font-extrabold text-gray-900">{fmtINR(site.baseRate)}</div>
          </div>
          <button
            onClick={() => onViewDetail(site)}
            className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
          >
            <Eye className="w-3.5 h-3.5" /> Details
          </button>
        </div>
      </div>

      {/* Shortlisted banner */}
      {isShortlisted && (
        <div className="bg-rose-50 border-t border-rose-100 px-4 py-2 flex items-center gap-1.5 text-xs font-bold text-rose-600">
          <Heart className="w-3.5 h-3.5 fill-rose-500" /> Shortlisted
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

  // UI
  const [activeTab, setActiveTab] = useState("sites");
  const [selectedSite, setSelectedSite] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Shortlist state (keyed by assignmentId)
  const [shortlisted, setShortlisted] = useState(new Set());
  const [useCustomDates, setUseCustomDates] = useState({});   // { id: bool }
  const [siteDates, setSiteDates] = useState({});             // { id: { start, end } }
  const [siteCharges, setSiteCharges] = useState({});         // { id: { printingType, printingCost, mountingCost, otherCost } }

  // Action loading
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // ── Load data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/access/${token}`);
        if (!res.ok) { const d = await res.json(); setError(d.detail || "Invalid or expired link"); return; }
        const d = await res.json();
        setData(d);
        // Hydrate shortlist state from saved data
        const campaign = d.campaigns?.[0];
        if (campaign) {
          const sSet = new Set();
          const custom = {};
          const dates = {};
          const charges = {};
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
          setShortlisted(sSet);
          setUseCustomDates(custom);
          setSiteDates(dates);
          setSiteCharges(charges);
        }
      } catch { setError("Failed to load. The link may be expired."); }
      finally { setLoading(false); }
    };
    load();
  }, [token]);

  const campaign = data?.campaigns?.[0];
  const allSites = campaign?.sites || [];
  const shortlistedSites = allSites.filter(s => shortlisted.has(s.assignmentId));

  // ── Helpers
  const getEffectiveDates = (assignmentId) => {
    if (useCustomDates[assignmentId] && siteDates[assignmentId]) {
      return { start: siteDates[assignmentId].start, end: siteDates[assignmentId].end };
    }
    return { start: campaign?.startDate || "", end: campaign?.endDate || "" };
  };

  const getCharges = (id) => siteCharges[id] || { printingType: "Flex", printingCost: 0, mountingCost: 0, otherCost: 0 };

  const computeSiteBase = (site, id) => {
    const { start, end } = getEffectiveDates(id);
    return (site.baseRate || 0) * monthsBetween(start, end);
  };

  const computeSiteTotal = (site, id) => {
    const ch = getCharges(id);
    return computeSiteBase(site, id) + Number(ch.printingCost || 0) + Number(ch.mountingCost || 0) + Number(ch.otherCost || 0);
  };

  const grandTotal = shortlistedSites.reduce((acc, s) => acc + computeSiteTotal(s, s.assignmentId), 0);
  const totalMedia = shortlistedSites.reduce((acc, s) => acc + computeSiteBase(s, s.assignmentId), 0);
  const totalPrinting = shortlistedSites.reduce((acc, s) => acc + Number(getCharges(s.assignmentId).printingCost || 0), 0);
  const totalMounting = shortlistedSites.reduce((acc, s) => acc + Number(getCharges(s.assignmentId).mountingCost || 0), 0);
  const totalOther = shortlistedSites.reduce((acc, s) => acc + Number(getCharges(s.assignmentId).otherCost || 0), 0);

  // ── Actions
  const toggleShortlist = (assignmentId) => {
    setShortlisted(prev => {
      const next = new Set(prev);
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId);
      return next;
    });
  };

  const updateCharge = (id, field, value) => {
    setSiteCharges(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { setSaveMsg("Selection saved!"); setTimeout(() => setSaveMsg(""), 3000); }
      else { const d = await res.json(); alert(d.detail || "Save failed"); }
    } catch { alert("Network error"); }
    setSaving(false);
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await fetch(`${API}/api/access/${token}/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const res = await fetch(`${API}/api/access/${token}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign?.id }),
      });
      if (res.ok) { setFinalized(true); setShowFinalModal(false); }
      else { const d = await res.json(); alert(d.detail || "Finalize failed"); }
    } catch { alert("Network error"); }
    setFinalizing(false);
  };

  // ── States: loading / error / finalized
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-blue-600 mx-auto mb-4 grid place-items-center text-white font-bold text-xl">t</div>
        <p className="text-gray-400 font-semibold">Verifying your access...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
        <p className="text-gray-500 mt-2">{error}</p>
      </div>
    </div>
  );

  if (finalized) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-300">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Campaign Finalized!</h1>
        <p className="text-gray-600 text-lg mb-2">
          Thank you, <span className="font-bold text-gray-900">{data?.advertiser}</span>.
        </p>
        <p className="text-gray-500">
          Your campaign <span className="font-semibold">"{campaign?.name}"</span> has been confirmed with{" "}
          <span className="font-bold text-green-700">{shortlistedSites.length} site{shortlistedSites.length !== 1 ? "s" : ""}</span>.
          The traqOOH team will be in touch to proceed with execution.
        </p>
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total Sites</span><span className="font-bold">{shortlistedSites.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Campaign Period</span><span className="font-bold">{fmt(campaign?.startDate)} — {fmt(campaign?.endDate)}</span></div>
          <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold text-gray-700">Grand Total</span><span className="font-extrabold text-green-700 text-base">{fmtINR(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );

  // ── Main render
  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center font-bold text-lg">t</div>
            <span className="font-bold text-blue-800 tracking-tight">traqOOH</span>
          </div>
          <span className="text-xs text-gray-400 font-medium hidden sm:block">
            Campaign Proposal — {data?.advertiser}
          </span>
        </div>
      </header>

      {/* Campaign Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-5 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-white/20 ${STATUS_STYLES[campaign?.status] || "bg-white/10 text-white"}`}>
                  {campaign?.status || "DRAFT"}
                </span>
                {campaign?.campaignType && <span className="text-blue-200 text-xs font-medium">{campaign.campaignType}</span>}
              </div>
              <h1 className="text-2xl font-extrabold">{campaign?.name}</h1>
              <p className="text-blue-200 text-sm mt-0.5">For {data?.advertiser}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-2 rounded-lg">
                <Calendar className="w-3.5 h-3.5" />
                {fmt(campaign?.startDate)} — {fmt(campaign?.endDate)}
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-2 rounded-lg">
                <MapPin className="w-3.5 h-3.5" />
                {allSites.length} Site{allSites.length !== 1 ? "s" : ""} Proposed
              </div>
              {shortlisted.size > 0 && (
                <div className="flex items-center gap-1.5 bg-rose-500/80 px-3 py-2 rounded-lg">
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  {shortlisted.size} Shortlisted
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex gap-1">
            {[
              { id: "sites", label: "All Sites", icon: <LayoutGrid className="w-4 h-4" />, count: allSites.length },
              { id: "shortlisted", label: "Shortlisted", icon: <Heart className="w-4 h-4" />, count: shortlisted.size },
              { id: "costsheet", label: "Cost Sheet", icon: <Calculator className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.icon} {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
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

        {/* ── TAB: ALL SITES ── */}
        {activeTab === "sites" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Proposed Sites <span className="text-gray-400 font-normal text-base">({allSites.length})</span></h2>
              {shortlisted.size > 0 && (
                <button onClick={() => setActiveTab("shortlisted")} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
                  View Shortlist ({shortlisted.size}) <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {allSites.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-semibold">No sites have been added to this campaign yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allSites.map(site => (
                  <SiteCard
                    key={site.assignmentId}
                    site={site}
                    isShortlisted={shortlisted.has(site.assignmentId)}
                    onToggleShortlist={toggleShortlist}
                    onViewDetail={setSelectedSite}
                    onLightbox={setLightboxUrl}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SHORTLISTED ── */}
        {activeTab === "shortlisted" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Shortlisted Sites <span className="text-gray-400 font-normal text-base">({shortlistedSites.length})</span></h2>
              {shortlistedSites.length > 0 && (
                <button onClick={() => setActiveTab("costsheet")} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
                  View Cost Sheet <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {shortlistedSites.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">No sites shortlisted yet</p>
                <p className="text-gray-400 text-sm mt-1">Go to "All Sites" and tap the heart icon to shortlist sites.</p>
                <button onClick={() => setActiveTab("sites")} className="mt-4 text-sm font-bold text-blue-600 hover:underline">Browse Sites →</button>
              </div>
            ) : (
              <div className="space-y-4">
                {shortlistedSites.map(site => {
                  const id = site.assignmentId;
                  const custom = !!useCustomDates[id];
                  const { start, end } = getEffectiveDates(id);
                  const ch = getCharges(id);
                  const months = monthsBetween(start, end);
                  const baseTotal = (site.baseRate || 0) * months;
                  const siteTotal = computeSiteTotal(site, id);

                  return (
                    <div key={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Site header */}
                      <div className="flex items-start gap-4 p-4 border-b border-gray-100">
                        {site.imageUrl ? (
                          <img src={site.imageUrl} alt={site.siteName} className="w-16 h-12 rounded-lg object-cover flex-shrink-0 cursor-zoom-in" onClick={() => setLightboxUrl(site.imageUrl)} />
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-gray-900">{site.siteName}</h3>
                              <p className="text-xs text-gray-500">{[site.state, site.city, site.location].filter(Boolean).join(", ")}</p>
                            </div>
                            <button onClick={() => toggleShortlist(id)} className="text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition flex-shrink-0" title="Remove">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {site.type && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">{site.type}</span>}
                            {site.lightingType && <span className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-bold border border-yellow-100">{site.lightingType}</span>}
                            {site.size && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{site.size}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Date controls */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Dates</span>
                          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
                            <button
                              onClick={() => setUseCustomDates(prev => ({ ...prev, [id]: false }))}
                              className={`px-3 py-1 rounded-md transition ${!custom ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              Campaign Dates
                            </button>
                            <button
                              onClick={() => setUseCustomDates(prev => ({ ...prev, [id]: true }))}
                              className={`px-3 py-1 rounded-md transition ${custom ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              Custom Dates
                            </button>
                          </div>
                        </div>
                        {!custom ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{fmt(campaign?.startDate)} — {fmt(campaign?.endDate)}</span>
                            <span className="text-blue-400 text-xs">({months} month{months !== 1 ? "s" : ""})</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Start Date</label>
                              <input
                                type="date"
                                value={siteDates[id]?.start || ""}
                                onChange={e => setSiteDates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), start: e.target.value } }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">End Date</label>
                              <input
                                type="date"
                                value={siteDates[id]?.end || ""}
                                onChange={e => setSiteDates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), end: e.target.value } }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Charges */}
                      <div className="p-4 border-b border-gray-100 grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Printing Type</label>
                          <select
                            value={ch.printingType || "Flex"}
                            onChange={e => updateCharge(id, "printingType", e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {PRINTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 flex items-center gap-1"><Printer className="w-3 h-3" />Printing Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={ch.printingCost || ""}
                            onChange={e => updateCharge(id, "printingCost", e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 flex items-center gap-1"><Wrench className="w-3 h-3" />Mounting Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={ch.mountingCost || ""}
                            onChange={e => updateCharge(id, "mountingCost", e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Other Charges (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={ch.otherCost || ""}
                            onChange={e => updateCharge(id, "otherCost", e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      {/* Site cost summary */}
                      <div className="px-4 py-3 bg-gray-50 flex flex-wrap gap-4 text-xs font-semibold text-gray-600">
                        <span>Base: {fmtINR(baseTotal)} ({months} mo × {fmtINR(site.baseRate)}/mo)</span>
                        {Number(ch.printingCost) > 0 && <span>Print: {fmtINR(ch.printingCost)}</span>}
                        {Number(ch.mountingCost) > 0 && <span>Mount: {fmtINR(ch.mountingCost)}</span>}
                        {Number(ch.otherCost) > 0 && <span>Other: {fmtINR(ch.otherCost)}</span>}
                        <span className="ml-auto font-extrabold text-gray-900 text-sm">Total: {fmtINR(siteTotal)}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Running total */}
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estimated Total ({shortlistedSites.length} sites)</div>
                    <div className="text-2xl font-extrabold text-gray-900">{fmtINR(grandTotal)}</div>
                  </div>
                  <button onClick={() => setActiveTab("costsheet")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition">
                    <Calculator className="w-4 h-4" /> Cost Sheet
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: COST SHEET ── */}
        {activeTab === "costsheet" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Cost Sheet</h2>
              <div className="text-xs font-semibold text-gray-400">{shortlistedSites.length} sites</div>
            </div>

            {shortlistedSites.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-700">No sites shortlisted yet</p>
                <button onClick={() => setActiveTab("sites")} className="mt-4 text-sm font-bold text-blue-600 hover:underline">Browse Sites →</button>
              </div>
            ) : (
              <>
                {/* Campaign Summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Campaign Summary</h3>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div><div className="text-gray-400 text-xs font-semibold mb-0.5">Campaign</div><div className="font-bold text-gray-900">{campaign?.name}</div></div>
                    <div><div className="text-gray-400 text-xs font-semibold mb-0.5">Advertiser</div><div className="font-bold text-gray-900">{data?.advertiser}</div></div>
                    <div><div className="text-gray-400 text-xs font-semibold mb-0.5">Period</div><div className="font-bold text-gray-900">{fmt(campaign?.startDate)} — {fmt(campaign?.endDate)}</div></div>
                  </div>
                </div>

                {/* Cost table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {["#", "Site", "Type / Size", "Period", "Media Cost", "Printing", "Mounting", "Other", "Total"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {shortlistedSites.map((site, idx) => {
                          const id = site.assignmentId;
                          const { start, end } = getEffectiveDates(id);
                          const months = monthsBetween(start, end);
                          const ch = getCharges(id);
                          const base = (site.baseRate || 0) * months;
                          const total = computeSiteTotal(site, id);
                          return (
                            <tr key={id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-gray-400 font-semibold">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900 whitespace-nowrap">{site.siteName}</div>
                                <div className="text-xs text-gray-400">{[site.state, site.city].filter(Boolean).join(", ")}</div>
                                {(useCustomDates[id]) && <div className="text-[10px] text-blue-500 font-semibold mt-0.5">Custom dates</div>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-gray-700 font-medium">{site.type || "—"}</div>
                                <div className="text-xs text-gray-400">{site.size || "—"}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                <div>{fmt(start)} →</div>
                                <div>{fmt(end)}</div>
                                <div className="text-xs text-gray-400">{months} mo</div>
                              </td>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmtINR(base)}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                <div>{fmtINR(ch.printingCost)}</div>
                                {ch.printingType && <div className="text-xs text-gray-400">{ch.printingType}</div>}
                              </td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtINR(ch.mountingCost)}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtINR(ch.otherCost)}</td>
                              <td className="px-4 py-3 font-extrabold text-gray-900 whitespace-nowrap">{fmtINR(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 text-sm">TOTAL</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{fmtINR(totalMedia)}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{fmtINR(totalPrinting)}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{fmtINR(totalMounting)}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{fmtINR(totalOther)}</td>
                          <td className="px-4 py-3 font-extrabold text-blue-700 text-base">{fmtINR(grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Grand total card */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl shadow-lg p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-blue-200 text-sm font-semibold mb-1">Grand Total ({shortlistedSites.length} sites · {monthsBetween(campaign?.startDate, campaign?.endDate)} months)</div>
                    <div className="text-3xl font-extrabold">{fmtINR(grandTotal)}</div>
                    <div className="text-blue-200 text-xs mt-1">Media {fmtINR(totalMedia)} + Printing {fmtINR(totalPrinting)} + Mounting {fmtINR(totalMounting)} + Other {fmtINR(totalOther)}</div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="flex-1 sm:flex-none flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                    >
                      {saving ? "Saving..." : <><FileText className="w-4 h-4" /> Save Draft</>}
                    </button>
                    <button
                      onClick={() => setShowFinalModal(true)}
                      className="flex-1 sm:flex-none flex items-center gap-2 bg-green-500 hover:bg-green-400 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-green-900/30"
                    >
                      <CheckCircle className="w-4 h-4" /> Finalize &amp; Start
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Sticky action bar (visible on sites/shortlisted tabs when shortlisted > 0) */}
      {shortlisted.size > 0 && activeTab !== "costsheet" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl px-4 py-3 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="font-bold text-gray-900">{shortlisted.size} site{shortlisted.size !== 1 ? "s" : ""} shortlisted</span>
              <span className="text-gray-400 ml-2">· Est. {fmtINR(grandTotal)}</span>
              {saveMsg && <span className="ml-3 text-green-600 font-semibold text-xs">{saveMsg}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveDraft} disabled={saving} className="text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition disabled:opacity-60">
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={() => setActiveTab("costsheet")} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                <Calculator className="w-3.5 h-3.5" /> Cost Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Padding to offset sticky bar */}
      {shortlisted.size > 0 && activeTab !== "costsheet" && <div className="h-16" />}

      {/* Modals */}
      <SiteDetailModal
        site={selectedSite}
        campaign={campaign}
        onClose={() => setSelectedSite(null)}
        onLightbox={url => { setSelectedSite(null); setLightboxUrl(url); }}
        isShortlisted={selectedSite ? shortlisted.has(selectedSite.assignmentId) : false}
        onToggleShortlist={id => { toggleShortlist(id); }}
      />

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {showFinalModal && (
        <FinalizeModal
          campaign={campaign}
          shortlistedSites={shortlistedSites}
          grandTotal={grandTotal}
          onConfirm={handleFinalize}
          onCancel={() => setShowFinalModal(false)}
          loading={finalizing}
        />
      )}

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-200 mt-6">
        Powered by <span className="font-bold text-blue-600">traqOOH</span> · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
