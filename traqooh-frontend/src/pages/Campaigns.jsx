import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import { compressImage } from "../utils/imageCompress";
import { sizeRowsFor, formatSize } from "../utils/sizeFormat";
import { openProofReport, fmtDistance, shotLabel, OFFSITE_LIMIT_M } from "../utils/proofReport";
import { Link, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import {
  Target, Search, Plus, Calendar, IndianRupee, MapPin, Trash2,
  X, LayoutList, PlusCircle, CheckSquare, Square, Edit2,
  ChevronRight, Image as ImageIcon, Filter, Send, Copy, Check, ExternalLink, Share2,
  FileDown, ChevronDown, ChevronUp, Save, Camera, CheckCircle2, MapPinned, Clock, Upload,
  RotateCcw, Archive
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const STATUS_CLS = {
  DRAFT:     "badge-draft",
  PLANNED:   "badge-planned",
  FINALIZED: "badge-confirmed",
  RUNNING:   "badge-live",
  COMPLETE:  "badge-completed",
  CANCELLED: "bg-red-500/15 text-red-400 border border-red-500/20",
  // legacy aliases (pre-migration data)
  LIVE:      "badge-live",
  COMPLETED: "badge-completed",
};

const CAMPAIGN_STATUSES = ["DRAFT", "PLANNED", "FINALIZED", "RUNNING", "COMPLETE", "CANCELLED"];

function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-widest ${STATUS_CLS[status] || STATUS_CLS.DRAFT}`}>
      {status}
    </span>
  );
}

function parseSqft(sizeStr) {
  if (!sizeStr) return 0;
  // Try JSON shape first: [{qty, width, length, unit}, ...]
  // For each row with both width AND length, area = qty × w × l (sqft).
  // If unit is inches, convert: 1 sq inch = 1/144 sq ft.
  // Rows with only width (e.g. "42 inch screen" — diagonal, no area) contribute 0.
  try {
    const rows = JSON.parse(sizeStr);
    if (Array.isArray(rows)) {
      let total = 0;
      for (const r of rows) {
        const qty = Number(r.qty) || 1;
        const w = parseFloat(r.width);
        const l = parseFloat(r.length);
        if (!isFinite(w) || !isFinite(l) || w <= 0 || l <= 0) continue;
        const unit = (r.unit || "ft").toLowerCase();
        const factor = unit.startsWith("in") ? (1 / 144) : 1;
        total += qty * w * l * factor;
      }
      return total;
    }
  } catch {}
  // Legacy free-text fallback: "60×25", "60x25", "60 x 25", "60*25", "60×25 ft"
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return parseFloat(m[1]) * parseFloat(m[2]);
}

const PRINTING_TYPES = ["Not Applicable", "Flex", "Vinyl", "Backlit", "Sunboard", "Fabrication", "Fabrication and Flex", "Other"];

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
  const [activeTab, setActiveTab] = useState("sites"); // "sites" | "add" | "share" | "monitoring"

  // Execution / monitoring board
  const [monitoring, setMonitoring] = useState(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, meta }
  const [zipping, setZipping] = useState(false);   // photo zip download in progress
  const [review, setReview] = useState(null);       // needs-retake form: { activityId, reason, other }
  const [sendingLink, setSendingLink] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [linkWa, setLinkWa] = useState(""); // WhatsApp click-to-chat URL for the link just sent

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
  const [bulkForm, setBulkForm] = useState({ printingType: "Flex", mediaCost: "", printingCost: "", mountingCost: "", otherCost: "" });
  const [bulkApplying, setBulkApplying] = useState(false);

  const [form, setForm] = useState({
    name: "", advertiserId: "", internalOwner: "", campaignType: "",
    startDate: "", endDate: "", totalCost: 0, status: "DRAFT", notes: "", billingRemarks: ""
  });

  useEffect(() => {
    apiFetch(`/api/advertisers`).then(r => r.json()).then(setAdvertisers).catch(() => {});
    apiFetch(`/api/vendors`).then(r => r.json()).then(setVendors).catch(() => {});
    const companyId = user.companyId || user.vendorId;
    if (companyId) {
      // Employees + admins can share campaigns, so both need the colleague list
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

  const loadMonitoring = async () => {
    if (!detail) return;
    setMonitoringLoading(true);
    try {
      const res = await apiFetch(`/api/campaigns/${detail.id}/monitoring`);
      if (res.ok) setMonitoring(await res.json());
    } catch { /* ignore */ }
    finally { setMonitoringLoading(false); }
  };

  // Load the monitoring board whenever its tab opens
  useEffect(() => {
    if (activeTab === "monitoring" && detail) loadMonitoring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, detail?.id]);

  // Assign / clear which field worker monitors a site
  const setSiteMonitor = async (assignmentId, pinId, workerName) => {
    setMonitoring(m => m ? {
      ...m,
      sites: m.sites.map(s => s.assignmentId === assignmentId
        ? { ...s, monitorFieldPinId: pinId, monitorWorkerName: workerName } : s),
    } : m);
    await apiFetch(`/api/campaigns/${detail.id}/assignment/${assignmentId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorWorkerName: workerName || "", monitorFieldPinId: pinId }),
    });
  };

  // Review a visit (all photos from one upload together): VERIFIED, back to DONE, or
  // REJECTED with a reason — the field worker then sees "Retake needed" in the app.
  // Updates the board immediately and rolls back if the save fails.
  const setVisitStatus = async (activity, status, reviewNote = null) => {
    const patch = (a, st, note) => a.id === activity.id ? { ...a, status: st, reviewNote: st === "REJECTED" ? note : null } : a;
    const apply = (st, note) => {
      setMonitoring(m => m ? {
        ...m,
        sites: m.sites.map(s => ({
          ...s,
          phases: Object.fromEntries(Object.entries(s.phases).map(([ph, acts]) => [ph, acts.map(a => patch(a, st, note))])),
        })),
      } : m);
      setLightbox(lb => lb?.meta?.id === activity.id ? { ...lb, meta: patch(lb.meta, st, note) } : lb);
    };
    apply(status, reviewNote);
    try {
      const res = await apiFetch(`/api/activities/${activity.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      apply(activity.status, activity.reviewNote);
      alert("Couldn't save the review. Check your connection and try again.");
    }
  };
  const toggleVerify = (activity) => setVisitStatus(activity, activity.status === "VERIFIED" ? "DONE" : "VERIFIED");

  // Create a field-access PIN inline and immediately assign it to a site
  const createFieldAccess = async (assignmentId, workerName) => {
    const name = (workerName || "").trim();
    if (!name) return;
    const res = await apiFetch(`/api/admin/field-pins`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: name,
        vendorId: user.vendorId || user.companyId || null,
        adminEmail: user.email || "",
      }),
    });
    if (!res.ok) { alert("Could not create field access. Please try again."); return; }
    const pin = await res.json();
    setMonitoring(m => m ? {
      ...m,
      workers: [{ pinId: pin.id, workerName: pin.workerName, pin: pin.pin, expiresAt: pin.expiresAt }, ...m.workers],
    } : m);
    await setSiteMonitor(assignmentId, pin.id, pin.workerName);
  };

  // Team uploads execution photos from the web for a phase (START / MID / END). Multiple files allowed.
  const uploadPhasePhotos = async (site, phaseKey, files) => {
    const activityType = phaseKey === "END" ? "END" : phaseKey === "MID" ? "AUDIT" : "START";
    try {
      // One activity holds all photos uploaded in this batch
      const res = await apiFetch(`/api/activities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: detail.id,
          siteId: site.siteId,
          assignmentId: site.assignmentId,
          activityType,
          status: "DONE",
          source: "web",
          performedBy: user.displayName || user.email || "Team",
          activityDate: new Date().toISOString().slice(0, 10),
          createdByUserId: user.userId || null,
        }),
      });
      if (!res.ok) { alert("Could not create the activity. Please try again."); return; }
      const created = await res.json();

      let uploadedCount = 0;
      const failures = [];
      for (const f of Array.from(files)) {
        const isVid = (f.type || "").startsWith("video/");
        if (isVid && f.size > 80 * 1024 * 1024) {
          failures.push(`"${f.name}" is over 80 MB`);
          continue;
        }
        try {
          // Photos get canvas-compressed; videos upload as-is (preserve playable format)
          const payload = isVid ? f : await compressImage(f);
          const fd = new FormData();
          fd.append("file", payload, f.name);
          const upRes = await apiFetch(`/api/activities/${created.id}/upload-image`, { method: "POST", body: fd });
          if (!upRes.ok) {
            const errText = await upRes.text().catch(() => "");
            failures.push(`"${f.name}" — server returned ${upRes.status}${errText ? ` (${errText.slice(0,120)})` : ""}`);
          } else {
            uploadedCount += 1;
          }
        } catch (err) {
          failures.push(`"${f.name}" — ${err.message || "network error"}`);
        }
      }

      if (failures.length) {
        alert(`Uploaded ${uploadedCount} of ${files.length} file${files.length !== 1 ? "s" : ""}.\n\nIssues:\n• ${failures.join("\n• ")}`);
      } else if (uploadedCount > 0) {
        // Brief inline confirmation so the team knows the photos are in.
        setLinkMsg(`✓ ${uploadedCount} ${activityType === "END" ? "End" : "Start"} ${uploadedCount === 1 ? "photo/video" : "photos/videos"} added — refreshing…`);
        setTimeout(() => setLinkMsg(""), 4000);
      }
      await loadMonitoring();
    } catch (err) {
      alert(`Upload failed: ${err.message || "Please check your connection and try again."}`);
    }
  };

  // Remove a single photo/video from an activity (live campaigns, admin/employee only).
  const deletePhaseMedia = async (activity, url) => {
    const isVid = /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(url || "");
    if (!confirm(`Remove this ${isVid ? "video" : "photo"} permanently? This can't be undone.`)) return;
    try {
      const res = await apiFetch(`/api/activities/${activity.id}/image?imageUrl=${encodeURIComponent(url)}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Could not delete. Please try again.");
        return;
      }
      // If this was the last media on the activity, drop the empty activity too so the phase counter stays accurate.
      const remaining = (activity.imageUrls || []).filter(u => u !== url);
      if (remaining.length === 0) {
        await apiFetch(`/api/activities/${activity.id}`, { method: "DELETE" });
      }
      await loadMonitoring();
    } catch (err) {
      alert(`Delete failed: ${err.message || "Please check your connection and try again."}`);
    }
  };

  // Manually email the advertiser a link (purpose: "live" = track photos, "update" = approve new sites)
  const sendAdvertiserLink = async (purpose) => {
    if (!detail?.advertiserId) { alert("This campaign has no advertiser on file."); return; }
    setSendingLink(true); setLinkMsg(""); setLinkWa("");
    let keepFor = 7000;
    try {
      const res = await apiFetch(`/api/advertisers/send-access-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiserId: detail.advertiserId, campaignId: detail.id, purpose }),
      });
      if (res.ok) {
        const d = await res.json();
        const FRONTEND = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
        const fullUrl = `${FRONTEND}${d.accessUrl}`;
        setLinkWa(waShareUrl(d.advertiserPhone, waLinkMessage(purpose, detail.name, fullUrl, d.advertiserContact)));
        keepFor = 30000; // give time to tap the WhatsApp button
        setLinkMsg(d.emailed
          ? `✓ Link emailed to ${d.advertiserEmail}`
          : "Link generated, but no advertiser email is on file. Send it on WhatsApp instead.");
      } else setLinkMsg("Failed to send link.");
    } catch { setLinkMsg("Network error."); }
    finally {
      setSendingLink(false);
      setTimeout(() => { setLinkMsg(""); setLinkWa(""); }, keepFor);
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
      setSentLink({
        accessUrl: `${FRONTEND}${d.accessUrl}`, expiresAt: d.expiresAt,
        phone: d.advertiserPhone || "", contact: d.advertiserContact || "",
        hasLogin: !!d.advertiserHasLogin,
      });
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
      if (bulkForm.mediaCost !== "") payload.agreedCost = Math.round(Number(bulkForm.mediaCost) * (sqft || 1));
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
    if (!detail) {
      alert("Campaign details are still loading. Wait a second and try again.");
      return;
    }
    const allAssignments = detail.assignments || [];
    if (allAssignments.length === 0) {
      alert("This campaign has no linked sites yet. Add sites from the \"Add Sites\" tab first.");
      return;
    }
    // If the user hasn't ticked any checkboxes, include every linked site by default.
    const assignments = selectedRows.size > 0
      ? allAssignments.filter(a => selectedRows.has(a.assignmentId))
      : allAssignments;
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
        <td>${formatSize({ size: a.siteSize })}</td>
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',Arial,sans-serif;padding:28px 32px;color:#111;font-size:12px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
      .brand{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
      .brand-text{font-family:'Syne',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.3px;line-height:1}
      .brand-text .b{color:#2563EB}.brand-text .r{color:#DC143C}
      .brand small{font-size:11px;color:#888;font-weight:500;font-family:'Inter',Arial,sans-serif}
      .meta{text-align:right;color:#555;font-size:11px;line-height:1.7}
      h1{font-family:'Syne',Arial,sans-serif;font-size:18px;font-weight:800;margin-bottom:3px;color:#0f172a}
      .sub{color:#666;font-size:11px}
      .chips{display:flex;gap:16px;background:#f0f4ff;border:1px solid #dbe4ff;border-radius:10px;padding:14px 18px;margin-bottom:18px}
      .chip-label{font-size:9.5px;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
      .chip-val{font-size:14px;font-weight:700;color:#111;margin-top:2px}
      .chip-val.blue{color:#2563EB}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;font-family:'Inter',Arial,sans-serif}
      td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:middle}
      tr:nth-child(even) td{background:#f8fafc}
      .tot td{background:#1e293b;color:#fff;font-weight:700;font-size:12px;padding:9px 10px}
      .tot .blue{color:#60a5fa}
      .foot{margin-top:20px;text-align:center;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:14px}
      @media print{@page{size:A3 landscape;margin:12mm}button{display:none}}
    </style></head><body>
    <div class="hdr">
      <div>
        <div class="brand">
          <div class="brand-text"><span class="b">traq</span><span class="r">OOH</span></div>
          <small>by <span style="color:#2563EB;font-weight:700">BRAND</span><span style="color:#DC143C;font-weight:700">SCULPT</span></small>
        </div>
        <h1>${detail.name}</h1>
        <div class="sub">${detail.advertiserName||""} &nbsp;·&nbsp; ${detail.campaignType||"OOH Campaign"}</div>
      </div>
      <div class="meta">
        <div style="font-weight:700;font-size:13px;color:#0f172a">Cost Estimate Sheet</div>
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
    if (!win) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cost-sheet-${(detail?.name || "campaign").replace(/[^a-z0-9]+/gi, "-")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      alert("Your browser blocked the print-preview popup, so the cost sheet was downloaded as an HTML file instead. Open it from your Downloads folder and use Ctrl+P to print or save as PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  // Finalized-only cost sheet, sourced from the monitoring board (shortlisted sites)
  const downloadFinalizedCostSheet = () => {
    if (!detail || !monitoring || !monitoring.sites.length) return;
    // Only the approved (non-pending) finalized sites belong on the final cost sheet
    const sites = monitoring.sites.filter(s => !s.pendingApproval);
    if (!sites.length) return;
    // Display cost = negotiated agreed cost, else the site's rate card (potential_monthly)
    const disp = (s) => Number(s.agreedCost || s.potentialMonthly || 0);
    const fmt = n => Number(n||0).toLocaleString("en-IN");
    const totalSpace = sites.reduce((t, s) => t + disp(s), 0);
    const totalPrint = sites.reduce((t, s) => t + (s.printingCost||0), 0);
    const totalMount = sites.reduce((t, s) => t + (s.mountingCost||0), 0);
    const totalOther = sites.reduce((t, s) => t + (s.otherCost||0), 0);
    const grandTotal = totalSpace + totalPrint + totalMount + totalOther;
    const rows = sites.map((s, i) => `
      <tr>
        <td>${i+1}</td>
        <td><strong>${s.siteName||"—"}</strong></td>
        <td>${[s.siteCity, s.siteState].filter(Boolean).join(", ")||"—"}</td>
        <td>${s.siteType||"—"}</td>
        <td>${formatSize({ size: s.siteSize })}</td>
        <td style="text-align:right">₹${fmt(disp(s))}</td>
        <td style="text-align:right">₹${fmt(s.printingCost)}</td>
        <td style="text-align:right">₹${fmt(s.mountingCost)}</td>
        <td style="text-align:right">₹${fmt(s.otherCost)}</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8">₹${fmt(disp(s)+(s.printingCost||0)+(s.mountingCost||0)+(s.otherCost||0))}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Final Cost Sheet – ${detail.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',Arial,sans-serif;padding:28px 32px;color:#111;font-size:12px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
      .brand{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
      .brand-text{font-family:'Syne',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.3px;line-height:1}
      .brand-text .b{color:#2563EB}.brand-text .r{color:#DC143C}
      .brand small{font-size:11px;color:#888;font-weight:500;font-family:'Inter',Arial,sans-serif}
      .meta{text-align:right;color:#555;font-size:11px;line-height:1.7}
      h1{font-family:'Syne',Arial,sans-serif;font-size:18px;font-weight:800;margin-bottom:3px;color:#0f172a}
      .sub{color:#666;font-size:11px}
      .chips{display:flex;gap:16px;background:#f0f4ff;border:1px solid #dbe4ff;border-radius:10px;padding:14px 18px;margin-bottom:18px}
      .chip-label{font-size:9.5px;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
      .chip-val{font-size:14px;font-weight:700;color:#111;margin-top:2px}
      .chip-val.blue{color:#2563EB}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;font-family:'Inter',Arial,sans-serif}
      td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:middle}
      tr:nth-child(even) td{background:#f8fafc}
      .tot td{background:#1e293b;color:#fff;font-weight:700;font-size:12px;padding:9px 10px}
      .tot .blue{color:#60a5fa}
      .foot{margin-top:20px;text-align:center;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:14px}
      @media print{@page{size:A3 landscape;margin:12mm}button{display:none}}
    </style></head><body>
    <div class="hdr">
      <div>
        <div class="brand">
          <div class="brand-text"><span class="b">traq</span><span class="r">OOH</span></div>
          <small>by <span style="color:#2563EB;font-weight:700">BRAND</span><span style="color:#DC143C;font-weight:700">SCULPT</span></small>
        </div>
        <h1>${detail.name}</h1>
        <div class="sub">${detail.advertiserName||""} &nbsp;·&nbsp; ${detail.campaignType||"OOH Campaign"}</div>
      </div>
      <div class="meta">
        <div style="font-weight:700;font-size:13px;color:#0f172a">Final Cost Sheet</div>
        <div>${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
        ${detail.internalOwner?`<div>Prepared by: ${detail.internalOwner}</div>`:""}
      </div>
    </div>
    <div class="chips">
      <div><div class="chip-label">Advertiser</div><div class="chip-val">${detail.advertiserName||"—"}</div></div>
      <div><div class="chip-label">Duration</div><div class="chip-val">${detail.startDate||"TBD"} → ${detail.endDate||"TBD"}</div></div>
      <div><div class="chip-label">Finalized Sites</div><div class="chip-val">${sites.length}</div></div>
      <div><div class="chip-label">Display Cost</div><div class="chip-val">₹${fmt(totalSpace)}</div></div>
      <div><div class="chip-label">Production</div><div class="chip-val">₹${fmt(totalPrint+totalMount+totalOther)}</div></div>
      <div><div class="chip-label">Grand Total</div><div class="chip-val blue">₹${fmt(grandTotal)}</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Site Name</th><th>Location</th><th>Type</th><th>Size</th>
      <th style="text-align:right">Display Cost</th><th style="text-align:right">Printing</th>
      <th style="text-align:right">Mounting</th><th style="text-align:right">Other</th><th style="text-align:right">Total</th>
    </tr></thead><tbody>
      ${rows}
      <tr class="tot">
        <td colspan="5">GRAND TOTAL</td>
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
    if (!win) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cost-sheet-${(detail?.name || "campaign").replace(/[^a-z0-9]+/gi, "-")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      alert("Your browser blocked the print-preview popup, so the cost sheet was downloaded as an HTML file instead. Open it from your Downloads folder and use Ctrl+P to print or save as PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  // Proof of Display report: every approved site with its install / audit / takedown
  // photos, capture time, GPS and distance from the site. For the advertiser's sign-off.
  // Visits sent back for a retake are left out.
  const downloadProofOfDisplay = () => {
    if (!detail || !monitoring || !monitoring.sites.length) return;
    const sites = monitoring.sites.filter(s => !s.pendingApproval);
    if (!sites.length) return;
    const photosOf = (s, key) => (s.phases?.[key] || [])
      .filter(act => act.status !== "REJECTED")
      .flatMap(act => (act.imageUrls || []).map(url => ({
        url,
        label: act.imageLabels?.[url],
        status: act.status,
        when: act.capturedAt || act.createdAt,
        latitude: act.latitude,
        longitude: act.longitude,
        distanceM: act.distanceM,
        performedBy: act.performedBy,
        notes: act.notes,
      })));
    openProofReport({
      campaign: {
        name: detail.name, advertiserName: detail.advertiserName,
        startDate: detail.startDate, endDate: detail.endDate, preparedBy: detail.internalOwner,
      },
      sites: sites.map(s => ({
        name: s.siteName, city: s.siteCity, state: s.siteState, type: s.siteType,
        size: formatSize({ size: s.siteSize }), latitude: s.latitude, longitude: s.longitude,
        worker: s.monitorWorkerName,
        photos: { START: photosOf(s, "START"), MID: photosOf(s, "MID"), END: photosOf(s, "END") },
      })),
    });
  };

  // All accepted proof photos for the campaign as one zip (site / phase folders + index.csv)
  const downloadPhotoZip = async () => {
    if (!detail) return;
    setZipping(true);
    try {
      const res = await apiFetch(`/api/campaigns/${detail.id}/photos.zip`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(detail.name || "campaign").replace(/[^a-z0-9]+/gi, "-")}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert(`Couldn't download the photos (${e.message}). Check your connection and try again.`);
    } finally {
      setZipping(false);
    }
  };

  // Segment buckets (legacy LIVE/COMPLETED kept so pre-migration data still groups)
  const SEGMENT_STATUSES = {
    planned:   ["DRAFT", "PLANNED", "FINALIZED"],
    running:   ["RUNNING", "LIVE"],
    completed: ["COMPLETE", "COMPLETED", "CANCELLED"],
  };

  const filtered = list.filter(c => {
    const sMatch = SEGMENT_STATUSES[segment].includes(c.status);
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.advertiserName || "").toLowerCase().includes(search.toLowerCase());
    return sMatch && searchMatch;
  });

  const segmentCounts = {
    planned:   list.filter(c => SEGMENT_STATUSES.planned.includes(c.status)).length,
    running:   list.filter(c => SEGMENT_STATUSES.running.includes(c.status)).length,
    completed: list.filter(c => SEGMENT_STATUSES.completed.includes(c.status)).length,
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
                    // Monitoring (with photo/video upload) is available whenever the campaign has at least one site.
                    // Before, this was gated on FINALIZED/RUNNING/COMPLETE which hid the Add Photo button for
                    // DRAFT/PLANNED campaigns — confusing for employees who can't finalize without seeing it work.
                    ...((detail.assignments?.length || 0) > 0
                      ? [{ id: "monitoring", label: "Monitoring", icon: <Camera className="w-4 h-4" /> }] : []),
                    { id: "share", label: "Share", icon: <Share2 className="w-4 h-4" />, count: shares.length || undefined },
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
                                {selectedRows.size > 0 ? `Download (${selectedRows.size} sites)` : `Download Cost Sheet (all ${asgn.length})`}
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
                                  { key: "mediaCost", label: "Media ₹/sqft" },
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
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
                                      Media Cost <span style={{ color: "var(--gray3)", fontSize: 9 }}>(₹/sqft)</span>
                                    </th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
                                      Printing <span style={{ color: "var(--gray3)", fontSize: 9 }}>(₹/sqft)</span>
                                    </th>
                                    <th className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
                                      Mounting <span style={{ color: "var(--gray3)", fontSize: 9 }}>(₹/sqft)</span>
                                    </th>
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
                  {activeTab === "share" && (
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

                  {/* ── Monitoring / Execution Tab ── */}
                  {activeTab === "monitoring" && (
                    <div className="p-4">
                      {monitoringLoading && !monitoring ? (
                        <div className="py-16 text-center text-sm" style={{ color: "var(--gray2)" }}>Loading monitoring board…</div>
                      ) : !monitoring || monitoring.sites.length === 0 ? (
                        <div className="py-16 flex flex-col items-center text-center">
                          <Camera className="w-10 h-10 mb-3" style={{ color: "var(--gray3)" }} />
                          <p className="font-semibold text-sm text-white">No finalized sites yet.</p>
                          <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Once the advertiser finalizes their shortlist, sites appear here for execution & monitoring.</p>
                        </div>
                      ) : (() => {
                        const pendingCount = monitoring.sites.filter(s => s.pendingApproval).length;
                        const approvedCount = monitoring.sites.length - pendingCount;
                        return (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <p className="text-xs flex-1 min-w-[180px]" style={{ color: "var(--gray2)" }}>
                              {approvedCount} approved site{approvedCount !== 1 ? "s" : ""} · assign a field worker and track installation, audit and takedown photos. Tap the ✓ to verify a visit, or open a photo to send it back for a retake.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => sendAdvertiserLink("live")} disabled={sendingLink}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60"
                                style={{ background: "rgba(34,197,94,0.15)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.3)" }}>
                                <Send className="w-3.5 h-3.5" /> Send live link
                              </button>
                              <button onClick={downloadFinalizedCostSheet}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                style={{ background: "rgba(37,99,235,0.15)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.3)" }}>
                                <FileDown className="w-3.5 h-3.5" /> Finalized Cost Sheet
                              </button>
                              <button onClick={downloadProofOfDisplay}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                style={{ background: "rgba(34,197,94,0.12)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.3)" }}>
                                <FileDown className="w-3.5 h-3.5" /> Proof of Display Report
                              </button>
                              <button onClick={downloadPhotoZip} disabled={zipping}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60"
                                style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>
                                <Archive className="w-3.5 h-3.5" /> {zipping ? "Preparing zip…" : "Download all photos"}
                              </button>
                            </div>
                          </div>

                          {linkMsg && (
                            <div className="flex items-center justify-between gap-3 flex-wrap text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "rgba(37,99,235,0.1)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.2)" }}>
                              <span>{linkMsg}</span>
                              {linkWa && (
                                <a href={linkWa} target="_blank" rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-md font-bold"
                                  style={{ background: "rgba(37,211,102,0.15)", color: "#4ADE80", border: "1px solid rgba(37,211,102,0.3)" }}>
                                  Send on WhatsApp
                                </a>
                              )}
                            </div>
                          )}

                          {pendingCount > 0 && (
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl flex-wrap"
                              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                              <span className="text-xs font-semibold" style={{ color: "#FBBF24" }}>
                                ⏳ {pendingCount} newly-added site{pendingCount !== 1 ? "s" : ""} awaiting advertiser approval.
                              </span>
                              <button onClick={() => sendAdvertiserLink("update")} disabled={sendingLink}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60"
                                style={{ background: "rgba(245,158,11,0.2)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.4)" }}>
                                <Send className="w-3.5 h-3.5" /> Ask advertiser to approve
                              </button>
                            </div>
                          )}

                          {monitoring.sites.map(site => (
                            <MonitorSiteCard
                              key={site.assignmentId}
                              site={site}
                              workers={monitoring.workers}
                              onAssign={setSiteMonitor}
                              onVerify={toggleVerify}
                              onPhoto={setLightbox}
                              onCreateFieldAccess={createFieldAccess}
                              onUpload={uploadPhasePhotos}
                              onDeleteMedia={deletePhaseMedia}
                            />
                          ))}
                        </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photo detail lightbox (GPS + timestamp) */}
      {lightbox && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => { setLightbox(null); setReview(null); }}>
          <button onClick={() => { setLightbox(null); setReview(null); }} className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.1)" }}><X className="w-5 h-5" /></button>
          <div className="max-w-3xl w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {lightbox.video || isVideoUrl(lightbox.url) ? (
              <video src={lightbox.url} controls autoPlay playsInline className="w-full max-h-[62vh] rounded-xl bg-black" />
            ) : (
              <img src={lightbox.url} alt="" className="w-full max-h-[62vh] object-contain rounded-xl" />
            )}
            {lightbox.meta && (
              <div className="mt-3 rounded-xl p-4 text-sm" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
                {lightbox.meta.id && (
                  <ReviewBar
                    act={lightbox.meta}
                    review={review}
                    setReview={setReview}
                    onVerify={() => toggleVerify(lightbox.meta)}
                    onReject={(reason) => { setVisitStatus(lightbox.meta, "REJECTED", reason); setReview(null); }}
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <PhotoMeta icon={<Clock className="w-3.5 h-3.5" />} label="Taken on"
                    value={fmtDateTime(lightbox.meta.capturedAt || lightbox.meta.createdAt)} />
                  <PhotoMeta icon={<Camera className="w-3.5 h-3.5" />} label="Phase / Shot"
                    value={[lightbox.meta.activityType, shotLabel(lightbox.meta.imageLabels?.[lightbox.url])].filter(Boolean).join(" · ") || "—"} />
                  <PhotoMeta icon={<Target className="w-3.5 h-3.5" />} label="Logged by" value={lightbox.meta.performedBy || "—"} />
                  <PhotoMeta icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Status" value={lightbox.meta.status || "—"} />
                  {(lightbox.meta.latitude != null && lightbox.meta.longitude != null) && (
                    <div className="col-span-2">
                      <PhotoMeta
                        icon={<MapPinned className="w-3.5 h-3.5" />}
                        label="GPS Location"
                        value={`${Number(lightbox.meta.latitude).toFixed(6)}, ${Number(lightbox.meta.longitude).toFixed(6)}`
                          + (lightbox.meta.gpsAccuracyM != null ? ` (±${Math.round(lightbox.meta.gpsAccuracyM)} m)` : "")}
                      />
                      <a href={`https://www.google.com/maps?q=${lightbox.meta.latitude},${lightbox.meta.longitude}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs font-bold" style={{ color: "#60A5FA" }}>
                        Open in Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {lightbox.meta.distanceM != null && (
                    <div className="col-span-2">
                      <PhotoMeta
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        label="Distance from site"
                        value={lightbox.meta.offSite
                          ? `${fmtDistance(lightbox.meta.distanceM)} — outside the ${OFFSITE_LIMIT_M} m limit, check this photo`
                          : `${fmtDistance(lightbox.meta.distanceM)} — within the ${OFFSITE_LIMIT_M} m limit`}
                      />
                    </div>
                  )}
                  {lightbox.meta.notes && (
                    <div className="col-span-2"><PhotoMeta label="Notes" value={lightbox.meta.notes} /></div>
                  )}
                </div>
              </div>
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
                <a href={waShareUrl(sentLink.phone, waLinkMessage("proposal", detail?.name || "your campaign", sentLink.accessUrl, sentLink.contact))}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition"
                  style={{ background: "rgba(37,211,102,0.15)", color: "#4ADE80", border: "1px solid rgba(37,211,102,0.3)" }}>
                  Send on WhatsApp{sentLink.phone ? ` to ${sentLink.phone}` : ""}
                </a>
                {!sentLink.phone && (
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--gray2)" }}>
                    No phone number on file for this advertiser, so WhatsApp will ask you to pick the contact. Add their number on the Advertisers page to skip this.
                  </p>
                )}
                {!sentLink.hasLogin && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}>
                    This advertiser has no login yet. With one, they see all their campaigns and proof photos in one place instead of separate links.{" "}
                    <Link to="/advertisers" className="font-bold underline">Create a login on the Advertisers page</Link>
                  </div>
                )}
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
                    {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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

  // Only show what the admin/employee has actually entered for this campaign — never
  // pre-fill from the site's rate-card (potentialMonthly). Empty == empty.
  const defaultAgreedCost = a.agreedCost || 0;

  const [costs, setCosts] = React.useState({
    agreedCost: defaultAgreedCost,
    mediaRate: a.agreedCost ? rateFromCost(defaultAgreedCost) : "",
    printingType: a.printingType || "Flex",
    printingRate: a.printingCost ? rateFromCost(a.printingCost) : "",
    mountingRate: a.mountingCost ? rateFromCost(a.mountingCost) : "",
    otherCost: a.otherCost || 0,
  });

  // Sync from parent after bulk apply
  React.useEffect(() => {
    const sq = parseSqft(a.siteSize);
    const rate = (cost) => sq > 0 ? (Number(cost || 0) / sq) : Number(cost || 0);
    setCosts({
      agreedCost: a.agreedCost || 0,
      mediaRate: a.agreedCost ? rate(a.agreedCost) : "",
      printingType: a.printingType || "Flex",
      printingRate: a.printingCost ? rate(a.printingCost) : "",
      mountingRate: a.mountingCost ? rate(a.mountingCost) : "",
      otherCost: a.otherCost || 0,
    });
  }, [a.agreedCost, a.printingCost, a.mountingCost, a.otherCost, a.printingType, a.siteSize]);

  const mediaTotal = Math.round(Number(costs.mediaRate || 0) * (sqft || 1)) || Number(costs.agreedCost || 0);
  const printingTotal = Math.round(Number(costs.printingRate || 0) * (sqft || 1));
  const mountingTotal = Math.round(Number(costs.mountingRate || 0) * (sqft || 1));
  const total = mediaTotal + printingTotal + mountingTotal + Number(costs.otherCost||0);
  const fmt = n => Number(n||0).toLocaleString("en-IN");

  const saveOnBlur = () => {
    onCostUpdate(a.assignmentId, {
      agreedCost: mediaTotal,
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
        {(() => {
          const rows = sizeRowsFor({ size: a.siteSize });
          if (!rows.length) return null;
          return (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-1 flex-wrap text-[10px]">
                  {r.qty > 1 && (
                    <span className="px-1 rounded text-[9px] font-bold"
                      style={{ background: "rgba(37,99,235,0.18)", color: "#93C5FD" }}>
                      {r.qty}×
                    </span>
                  )}
                  {r.dim && <span className="text-white font-semibold">{r.dim}</span>}
                  {r.note && <span style={{ color: "var(--gray2)" }}>{r.note}</span>}
                </div>
              ))}
            </div>
          );
        })()}
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
          value={costs.mediaRate}
          onChange={e => setCosts(c => ({ ...c, mediaRate: e.target.value, agreedCost: Math.round(Number(e.target.value || 0) * (sqft || 1)) }))}
          onBlur={saveOnBlur}
          style={{ ...inputCls, width: 90 }}
          placeholder={sqft > 0 ? "₹/sqft" : "₹"}
        />
        {sqft > 0 && costs.mediaRate > 0 && (
          <div style={{ fontSize: 9, color: "var(--gray2)", textAlign: "right", marginTop: 2 }}>= ₹{fmt(mediaTotal)}</div>
        )}
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

// ── Monitoring helpers ──────────────────────────────────────────────────────
const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(url || "");

// WhatsApp click-to-chat link. A 10-digit Indian number gets the 91 prefix;
// with no number, WhatsApp opens and lets you pick the contact.
function waShareUrl(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  const num = digits.length === 10 ? "91" + digits : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function waLinkMessage(purpose, campaignName, url, contact) {
  const hi = contact ? `Hi ${contact}, ` : "Hi, ";
  if (purpose === "live") return `${hi}your campaign "${campaignName}" is live. You can see installation photos for every site here: ${url}`;
  if (purpose === "update") return `${hi}new sites were added to "${campaignName}". Please review and approve them here: ${url}`;
  return `${hi}here is your OOH campaign proposal for "${campaignName}". Review the sites and shortlist the ones you want: ${url}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

const RETAKE_REASONS = ["Blurry", "Wrong site", "Ad not visible", "Incomplete set", "Other"];

// Verify / needs-retake controls for one visit, shown in the photo viewer.
function ReviewBar({ act, review, setReview, onVerify, onReject }) {
  const open = review?.activityId === act.id;
  const count = (act.imageUrls || []).length;
  const verified = act.status === "VERIFIED";
  const rejected = act.status === "REJECTED";
  const reason = open ? review.reason : null;
  const finalReason = reason === "Other" ? (review.other || "").trim() : reason;
  const chip = (on) => ({
    background: on ? "rgba(220,20,60,0.18)" : "rgba(255,255,255,0.05)",
    color: on ? "#FCA5A5" : "var(--gray)",
    border: `1px solid ${on ? "rgba(220,20,60,0.45)" : "var(--border)"}`,
  });
  return (
    <div className="mb-3 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
      {rejected && (
        <div className="mb-2 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>
          Sent back for a retake{act.reviewNote ? `: ${act.reviewNote}` : ""}{act.reviewedBy ? ` · by ${act.reviewedBy}` : ""}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onVerify}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
          style={verified
            ? { background: "#22C55E", color: "#fff" }
            : { background: "rgba(34,197,94,0.12)", color: "#4ADE80", border: "1px solid rgba(34,197,94,0.3)" }}>
          <Check className="w-3.5 h-3.5" /> {verified ? "Verified" : "Mark verified"}
        </button>
        {!rejected && (
          <button onClick={() => setReview(open ? null : { activityId: act.id, reason: null, other: "" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            style={{ background: "rgba(220,20,60,0.1)", color: "#F87171", border: "1px solid rgba(220,20,60,0.3)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Needs retake
          </button>
        )}
        <span className="text-[11px]" style={{ color: "var(--gray2)" }}>
          Applies to all {count} photo{count === 1 ? "" : "s"} from this visit
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>What needs fixing?</div>
          <div className="flex flex-wrap gap-1.5">
            {RETAKE_REASONS.map(r => (
              <button key={r} onClick={() => setReview({ ...review, reason: r })}
                className="px-2.5 py-1 rounded-md text-xs font-semibold transition" style={chip(reason === r)}>{r}</button>
            ))}
          </div>
          {reason === "Other" && (
            <input autoFocus value={review.other} onChange={e => setReview({ ...review, other: e.target.value })}
              placeholder="Tell the field worker what to fix" className="tq-input text-sm" maxLength={200} />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={!finalReason} onClick={() => onReject(finalReason)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#DC143C" }}>
              Send back for retake
            </button>
            <button onClick={() => setReview(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>Cancel</button>
          </div>
          <p className="text-[11px]" style={{ color: "var(--gray2)" }}>
            The field worker sees this reason in the app. Photos sent back are hidden from the advertiser and left out of reports.
          </p>
        </div>
      )}
    </div>
  );
}

function PhotoMeta({ icon, label, value }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
        {icon}{label}
      </div>
      <div className="text-sm text-white mt-0.5 break-words">{value}</div>
    </div>
  );
}

const MONITOR_PHASES = [
  { key: "START", label: "Start / Install", color: "#2563EB" },
  { key: "MID",   label: "Audit", color: "#F59E0B" },
  { key: "END",   label: "End / Takedown", color: "#22C55E" },
];

function MonitorSiteCard({ site, workers, onAssign, onVerify, onPhoto, onCreateFieldAccess, onUpload, onDeleteMedia }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingPhase, setUploadingPhase] = useState(null);

  const handleUpload = async (phaseKey, files) => {
    setUploadingPhase(phaseKey);
    try { await onUpload(site, phaseKey, files); }
    finally { setUploadingPhase(null); }
  };
  // Build dropdown options; keep the assigned worker visible even if its PIN expired
  const opts = [...(workers || [])];
  if (site.monitorWorkerName && !opts.find(w => w.pinId === site.monitorFieldPinId)) {
    opts.unshift({ pinId: site.monitorFieldPinId, workerName: site.monitorWorkerName, pin: "expired" });
  }
  const location = [site.siteCity, site.siteState].filter(Boolean).join(", ");
  const pending = !!site.pendingApproval;

  const submitNew = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    await onCreateFieldAccess(site.assignmentId, newName);
    setBusy(false); setNewName(""); setCreating(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${pending ? "rgba(245,158,11,0.35)" : "var(--border)"}` }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {site.imageUrl
          ? <img src={site.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
          : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}><ImageIcon className="w-4 h-4" style={{ color: "var(--gray3)" }} /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-bold text-sm text-white truncate">{site.siteName || "—"}</div>
            {pending && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.15)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.3)" }}>
                Awaiting approval
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: "var(--gray2)" }}>
            <span className="truncate">{location || "—"}</span>
            {site.latitude != null && site.longitude != null && (
              <a href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-0.5 flex-shrink-0 font-bold" style={{ color: "#60A5FA" }}>
                <MapPinned className="w-3 h-3" /> Map
              </a>
            )}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--gray3)" }}>{[site.siteType, formatSize({ size: site.siteSize }) === "—" ? null : formatSize({ size: site.siteSize })].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      {/* Field-worker assignment */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--gray2)" }}>Field access</span>
          <select
            value={site.monitorFieldPinId || ""}
            onChange={e => {
              const pid = e.target.value ? Number(e.target.value) : null;
              const w = opts.find(x => x.pinId === pid);
              onAssign(site.assignmentId, pid, w ? w.workerName : "");
            }}
            className="tq-input flex-1 py-1.5 text-xs"
          >
            <option value="">— Unassigned —</option>
            {opts.map(w => (
              <option key={w.pinId ?? w.workerName} value={w.pinId || ""}>
                {w.workerName}{w.pin && w.pin !== "expired" ? ` (PIN ${w.pin})` : w.pin === "expired" ? " (PIN expired)" : ""}
              </option>
            ))}
          </select>
          <button onClick={() => setCreating(c => !c)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition"
            style={{ background: "rgba(37,99,235,0.12)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.25)" }}>
            <PlusCircle className="w-3.5 h-3.5" /> New
          </button>
        </div>
        {creating && (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
              placeholder="Field worker name…" className="tq-input flex-1 py-1.5 text-xs" />
            <button onClick={submitNew} disabled={busy || !newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>
              {busy ? "Creating…" : "Create & assign"}
            </button>
          </div>
        )}
        {creating && (
          <p className="text-[10px] mt-1.5" style={{ color: "var(--gray3)" }}>
            Creates a 4-digit PIN (valid 72h) the worker uses to log in. Re-issue later with the same name to keep this assignment.
          </p>
        )}
      </div>

      {/* Phases */}
      <div className={`grid gap-px ${MONITOR_PHASES.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ background: "var(--border)" }}>
        {MONITOR_PHASES.map(phase => {
          const photos = (site.phases?.[phase.key] || []).flatMap(act =>
            (act.imageUrls || []).map(url => ({ url, act }))
          );
          return (
            <div key={phase.key} className="p-2.5" style={{ background: "#0B1120" }}>
              <div className="flex items-center gap-1 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: phase.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--gray)" }}>{phase.label}</span>
                {photos.length > 0 && <span className="text-[10px]" style={{ color: "var(--gray3)" }}>· {photos.length}</span>}
                <label className="ml-auto flex items-center gap-1 text-[10px] font-bold cursor-pointer transition px-2 py-1 rounded"
                  style={{ color: "#fff", background: uploadingPhase === phase.key ? "rgba(96,165,250,0.4)" : "#2563EB" }}>
                  {uploadingPhase === phase.key ? "Uploading…" : <><Upload className="w-3 h-3" /> Add Photo</>}
                  <input type="file" accept="image/*,video/*" multiple className="hidden"
                    disabled={uploadingPhase === phase.key}
                    onChange={e => {
                      // CRITICAL: copy the FileList into a real array BEFORE clearing the input.
                      // Setting input.value = "" empties the FileList object too — if we kept
                      // the reference, the async upload would iterate over zero files.
                      if (e.target.files?.length) {
                        const filesCopy = Array.from(e.target.files);
                        e.target.value = "";
                        handleUpload(phase.key, filesCopy);
                      } else {
                        e.target.value = "";
                      }
                    }} />
                </label>
              </div>
              {photos.length === 0 ? (
                <div className="rounded-lg py-4 text-center text-[10px]" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border)", color: "var(--gray3)" }}>
                  Awaiting photos
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {photos.map(({ url, act }, i) => {
                    const verified = act.status === "VERIFIED";
                    const rejected = act.status === "REJECTED";
                    const video = isVideoUrl(url);
                    const tileBorder = verified ? "2px solid #22C55E" : rejected ? "2px solid #DC143C" : "1px solid var(--border)";
                    return (
                      <div key={i} className={`relative group ${rejected ? "opacity-60" : ""}`}>
                        {video ? (
                          <div onClick={() => onPhoto({ url, meta: act, video: true })}
                            className="w-full aspect-square rounded-lg cursor-pointer flex items-center justify-center relative overflow-hidden"
                            style={{ border: tileBorder, background: "#000" }}>
                            <video src={url + "#t=0.1"} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                                <span style={{ color: "#fff", fontSize: 12, marginLeft: 2 }}>▶</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => onPhoto({ url, meta: act })}
                            title="Click to view full size"
                            className="w-full aspect-square rounded-lg cursor-zoom-in overflow-hidden"
                            style={{ border: tileBorder }}>
                            <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onVerify(act); }}
                          title={verified ? "Verified — click to un-verify" : "Mark verified"}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: verified ? "#22C55E" : "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)" }}>
                          <Check className="w-3 h-3" style={{ color: verified ? "#fff" : "rgba(255,255,255,0.6)" }} />
                        </button>
                        {onDeleteMedia && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteMedia(act, url); }}
                            title={video ? "Delete video" : "Delete photo"}
                            className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(220,20,60,0.85)", border: "1px solid rgba(255,255,255,0.25)" }}>
                            <Trash2 className="w-3 h-3" style={{ color: "#fff" }} />
                          </button>
                        )}
                        {rejected ? (
                          <span
                            title={`Sent back for a retake${act.reviewNote ? `: ${act.reviewNote}` : ""}`}
                            className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold rounded px-1 py-0.5 pointer-events-none truncate"
                            style={{ background: "rgba(220,20,60,0.92)", color: "#fff" }}>
                            ↺ Retake{act.reviewNote ? `: ${act.reviewNote}` : ""}
                          </span>
                        ) : act.offSite && (
                          <span
                            title={`Taken ${fmtDistance(act.distanceM)} from the site's location`}
                            className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold rounded px-1 py-0.5 pointer-events-none"
                            style={{ background: "rgba(245,158,11,0.92)", color: "#1A1200" }}>
                            ⚠ {fmtDistance(act.distanceM)} away
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
