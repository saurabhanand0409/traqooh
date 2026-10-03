import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import AppShell from "../components/AppShell";
import {
  Search, Plus, Maximize2, X, Calendar as CalendarIcon,
  MapPin, CheckCircle, XCircle, Clock, Image as ImageIcon, Target, Edit,
  Star, Trash2, Upload as UploadIcon
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { compressImage } from "../utils/imageCompress";
import { parseSizeRows, formatSizeRow, formatSize, sizeRowsFor } from "../utils/sizeFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

// ── Site GPS helpers ─────────────────────────────────────────────────────────
// Proof photos are checked against the site's location (250 m), so every site needs one.
const hasGps = (s) => s.latitude != null && s.longitude != null && !(Number(s.latitude) === 0 && Number(s.longitude) === 0);
const toCoord = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// Reads "25.6030, 85.1370" or a full Google Maps link. The pin (!3d…!4d…) wins over
// the map centre (@lat,lng) because it's where the site actually is.
function parseLatLng(text) {
  const t = String(text || "").trim();
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
const inIndia = (lat, lng) => lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

// Visual rendering for the inventory list: small qty pill + dimension text.
// Falls back to plain text for legacy or empty rows.
function SizeCell({ site }) {
  const rows = sizeRowsFor(site);
  if (!rows.length) return <span style={{ color: "var(--gray2)" }}>—</span>;
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 flex-wrap">
          {r.qty > 1 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ background: "rgba(37,99,235,0.18)", color: "#93C5FD" }}>
              {r.qty}×
            </span>
          )}
          {r.dim && <span className="text-sm font-bold text-white">{r.dim}</span>}
          {r.note && <span className="text-xs" style={{ color: "var(--gray2)" }}>{r.note}</span>}
          {!r.dim && !r.note && <span className="text-xs" style={{ color: "var(--gray2)" }}>—</span>}
        </div>
      ))}
    </div>
  );
}

export default function Inventory() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);

  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [noGpsOnly, setNoGpsOnly] = useState(false);
  const [gpsPaste, setGpsPaste] = useState({ text: "", msg: "" }); // "paste a Maps link" box in the site form

  // Modals state
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editSite, setEditSite] = useState(null);

  // Details Modal state (for mobile tap)
  const [detailSite, setDetailSite] = useState(null);
  const [siteBookings, setSiteBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [detailTab, setDetailTab] = useState("bookings"); // "bookings" | "photos"
  const [siteGallery, setSiteGallery] = useState({});
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Hover popup state
  const [hoverSite, setHoverSite] = useState(null);
  const [hoverPopupStyle, setHoverPopupStyle] = useState({});
  const hoverTimeoutRef = useRef(null);

  // Big Image Modal state
  const [enlargedImage, setEnlargedImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [vendors, setVendors] = useState([]);
  const isAdmin = user.role === "ADMIN";
  // Everyone (admins, employees, super-admin) defaults to "All Vendors" so the team
  // can browse and share any vendor's inventory. Employees can still filter to a
  // specific vendor (including their own) via the Vendor dropdown above the list.
  const [currentOwnerId, setCurrentOwnerId] = useState(null);

  const emptyForm = {
    name: "", city: "", state: "", type: "Billboard", lightingType: "Lit",
    size: "", width: 0, length: 0, latitude: "", longitude: "",
    facing: "", status: "Active", potentialMonthly: "", imageUrl: "",
    ownerCompanyId: user.companyId || "", vendorId: user.companyId || "",
    addedByUserId: user.userId || ""
  };
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"

  // Fetch Sites
  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      setError("");
      try {
        let url = `/api/mobile/sites`;
        if (currentOwnerId) url += `?ownerId=${currentOwnerId}`;
        const res = await apiFetch(url);
        if (!res.ok) throw new Error("Failed to load sites");
        const data = await res.json();

        // Compute 3-tier status
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const enriched = (Array.isArray(data) ? data : []).map(s => {
          const isBooked = s.availabilityStatus === "BOOKED" || s.availabilityStatus === "BLOCKED";
          let computedStatus, statusColor, statusDot;
          if (!isBooked) {
            computedStatus = "Vacant";
            statusColor = "text-green-700 bg-green-50 border-green-200";
            statusDot = "bg-green-500";
          } else {
            const till = s.availableTill ? new Date(s.availableTill) : null;
            const daysUntilFree = till ? Math.ceil((till - today) / (1000 * 60 * 60 * 24)) : Infinity;
            if (daysUntilFree <= 7) {
              computedStatus = "Vacant Soon";
              statusColor = "text-yellow-700 bg-yellow-50 border-yellow-300";
              statusDot = "bg-yellow-500";
            } else {
              computedStatus = "Booked";
              statusColor = "text-red-700 bg-red-50 border-red-200";
              statusDot = "bg-red-500";
            }
          }
          return { ...s, computedStatus, statusColor, statusDot };
        });
        setSites(enriched);
      } catch (err) {
        setError(err.message || "Unable to fetch sites");
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, [currentOwnerId]);

  // Fetch vendors list for dropdown
  useEffect(() => {
    apiFetch(`/api/vendors`)
      .then(r => r.ok && r.json())
      .then(data => data && setVendors(data))
      .catch(() => {});
  }, [user.companyId]);

  // Filters Options
  const cities = ["All", ...new Set(sites.map(s => s.city).filter(Boolean))].sort();

  // Apply Search & Filters
  const filteredSites = sites.filter(s => {
    const matchesSearch = (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
                          (s.city || "").toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter === "All" || s.city === cityFilter;
    const matchesStatus = statusFilter === "All" || s.computedStatus === statusFilter;
    const matchesGps = !noGpsOnly || !hasGps(s);
    return matchesSearch && matchesCity && matchesStatus && matchesGps;
  });
  const missingGps = sites.filter(s => !hasGps(s)).length;

  // Calculate top-level stats
  const totalSites = sites.length;
  const vacantSites = sites.filter(s => s.computedStatus === "Vacant").length;
  const bookedSites = sites.filter(s => s.computedStatus === "Booked").length;
  const occupancyRate = totalSites ? Math.round((bookedSites / totalSites) * 100) : 0;

  // Image Upload
  const handleFileUpload = async (e, isEdit = false) => {
    const raw = e.target.files[0];
    if (!raw) return;
    const file = await compressImage(raw);
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      const res = await apiFetch(`/api/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.success) {
        if (isEdit) setEditSite({ ...editSite, imageUrl: data.imageUrl });
        else setForm({ ...form, imageUrl: data.imageUrl });
      }
    } catch (err) {
      alert("Unable to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Delete Site (cascade: also removes campaign bookings, audits, photos, execution history)
  const [deletingId, setDeletingId] = useState(null);
  const handleDeleteSite = async (site) => {
    if (!confirm(`Delete "${site.name}"?\n\nThis will also remove all of its campaign bookings, audits, photos, and execution history. This cannot be undone.`)) return;
    setDeletingId(site.id);
    try {
      const res = await apiFetch(`/api/sites/${site.id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg = `Delete failed (HTTP ${res.status})`;
        try { const d = await res.json(); if (d.detail) msg = d.detail; } catch {}
        alert(msg);
        return;
      }
      // Optimistic in-place removal (avoids a full reload which can hide slow errors)
      setSites(prev => prev.filter(s => s.id !== site.id));
    } catch (err) {
      // Network failure, CORS error, cold-start timeout, etc.
      alert(`Could not reach the server.\n\n${err?.message || err}\n\nIf the backend was sleeping, wait ~30s and try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  // Create Site
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        potentialMonthly: Number.parseFloat(form.potentialMonthly) || 0,
        width: Number(form.width) || 0,
        length: Number(form.length) || 0,
        totalArea: (Number(form.width) || 0) * (Number(form.length) || 0),
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        ownerCompanyId: form.vendorId ? Number(form.vendorId) : (form.ownerCompanyId ? Number(form.ownerCompanyId) : null),
        addedByUserId: user.userId || null,
        state: form.state || null,
        lightingType: form.lightingType || null,
        latitude: toCoord(form.latitude),
        longitude: toCoord(form.longitude),
      };
      const res = await apiFetch(`/api/sites`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save site");
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Edit Site
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...editSite,
        potentialMonthly: Number.parseFloat(editSite.potentialMonthly) || 0,
        width: Number(editSite.width) || 0,
        length: Number(editSite.length) || 0,
        totalArea: (Number(editSite.width) || 0) * (Number(editSite.length) || 0),
        vendorId: editSite.vendorId ? Number(editSite.vendorId) : null,
        ownerCompanyId: editSite.vendorId ? Number(editSite.vendorId) : (editSite.ownerCompanyId !== "" ? Number(editSite.ownerCompanyId) : null),
        state: editSite.state || null,
        lightingType: editSite.lightingType || null,
        latitude: toCoord(editSite.latitude),
        longitude: toCoord(editSite.longitude),
      };
      const res = await apiFetch(`/api/sites/${editSite.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update site");
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (site) => {
     setEditSite({
        id: site.id, name: site.name || "", city: site.city || "", state: site.state || "",
        type: site.type || "Billboard", lightingType: site.lightingType || "Lit",
        size: site.size || "", width: site.width || 0, length: site.length || 0, facing: site.facing || "",
        status: site.status || "Active", potentialMonthly: String(site.potentialMonthly || ""),
        occupancy: site.occupancy || 0, imageUrl: site.imageUrl || "",
        ownerCompanyId: site.ownerCompanyId || "", vendorId: site.vendorId || site.ownerCompanyId || "",
        latitude: site.latitude ?? "", longitude: site.longitude ?? "",
     });
     setGpsPaste({ text: "", msg: "" });
     setShowEdit(true);
  };

  // View Details — fetch bookings + gallery simultaneously
  const openDetails = async (site) => {
    setDetailSite(site);
    setDetailTab("bookings");
    setSiteBookings([]);
    setSiteGallery({});
    setLoadingBookings(true);
    setGalleryLoading(true);
    try {
      const [bkRes, galRes] = await Promise.all([
        apiFetch(`/api/sites/${site.id}/bookings`),
        apiFetch(`/api/sites/${site.id}/gallery`),
      ]);
      if (bkRes.ok) setSiteBookings(await bkRes.json());
      if (galRes.ok) { const g = await galRes.json(); setSiteGallery(g.grouped || {}); }
    } catch (err) { console.error(err); }
    setLoadingBookings(false);
    setGalleryLoading(false);
  };

  // Hover popup handlers
  const handleSiteNameMouseEnter = (e, site) => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 480;
    const leftPos = rect.right + 12;
    const rightOverflow = leftPos + popupWidth - window.innerWidth;
    const finalLeft = rightOverflow > 0 ? rect.left - popupWidth - 12 : leftPos;
    const finalTop = Math.min(rect.top, window.innerHeight - 560);
    setHoverPopupStyle({ top: finalTop, left: finalLeft });
    setHoverSite(site);
  };

  const handleSiteNameMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setHoverSite(null), 120);
  };

  const handlePopupMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
  };

  const handlePopupMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setHoverSite(null), 120);
  };

  // Type display helper: "Billboard (Lit)"
  const typeLabel = (type, lightingType) => {
    if (!lightingType) return type;
    return `${type} (${lightingType})`;
  };

  return (
    <AppShell user={user}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white">Inventory</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Manage sites, check availability, and track rates.</p>
        </div>
        {!isAdmin ? (
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
          >
            <Plus className="w-4 h-4"/> Add New Site
          </button>
        ) : (
          <span className="text-xs px-4 py-2.5 rounded-xl" style={{ color: "var(--gray2)", border: "1px solid var(--border)" }}>View Only Mode</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Sites", value: totalSites, color: "#2563EB", icon: <MapPin className="w-5 h-5"/> },
          { label: "Vacant",      value: vacantSites, color: "#22C55E", icon: <CheckCircle className="w-5 h-5"/> },
          { label: "Booked",      value: bookedSites, color: "#DC143C", icon: <XCircle className="w-5 h-5"/> },
          { label: "Occupancy",   value: `${occupancyRate}%`, color: "#F59E0B", icon: <Target className="w-5 h-5"/> },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: `${s.color}18`, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{s.label}</div>
              <div className="font-syne font-extrabold text-xl text-white">{s.value}</div>
            </div>
          </div>
        ))}
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
            placeholder="Search by name or location..."
            className="w-full bg-transparent border-none outline-none text-sm"
            style={{ color: "#fff" }}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select value={currentOwnerId || ""} onChange={e => setCurrentOwnerId(e.target.value ? Number(e.target.value) : null)} className="tq-input flex-1 md:w-40 py-2 text-sm" title="Filter sites by vendor">
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
          </select>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="tq-input flex-1 md:w-36 py-2 text-sm">
            {cities.map(c => <option key={c} value={c}>{c === "All" ? "All Cities" : c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="tq-input flex-1 md:w-36 py-2 text-sm">
            <option value="All">All Status</option>
            <option value="Vacant">Vacant</option>
            <option value="Booked">Booked</option>
            <option value="Vacant Soon">Vacant Soon</option>
          </select>
          <button onClick={() => setNoGpsOnly(v => !v)} title="Show only sites without a GPS location"
            className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition"
            style={noGpsOnly
              ? { background: "rgba(245,158,11,0.18)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.4)" }
              : { background: "rgba(255,255,255,0.05)", color: "var(--gray)", border: "1px solid var(--border)" }}>
            No GPS · {missingGps}
          </button>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border)" }}>
            {[["list","List"],["map","Map"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="px-3 py-2 text-xs font-bold transition-all"
                style={viewMode === mode ? { background: "rgba(37,99,235,0.2)", color: "#60A5FA" } : { color: "var(--gray2)", background: "transparent" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="glass rounded-2xl overflow-hidden mb-6" style={{ height: 480 }}>
          {filteredSites.filter(s => s.latitude && s.longitude).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <MapPin className="w-8 h-8" style={{ color: "var(--gray2)" }} />
              <p className="text-sm text-white">No sites with GPS coordinates</p>
              <p className="text-xs" style={{ color: "var(--gray2)" }}>Add latitude/longitude to sites to see them on the map.</p>
            </div>
          ) : (
            <MapContainer
              center={[filteredSites.find(s => s.latitude && s.longitude)?.latitude || 20.5937, filteredSites.find(s => s.latitude && s.longitude)?.longitude || 78.9629]}
              zoom={5} style={{ width: "100%", height: "100%" }}
              className="rounded-2xl"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {filteredSites.filter(s => s.latitude && s.longitude).map(s => {
                const color = s.computedStatus === "Vacant" ? "#22C55E" : s.computedStatus === "Vacant Soon" ? "#F59E0B" : "#DC143C";
                return (
                  <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={10}
                    pathOptions={{ fillColor: color, color: color, fillOpacity: 0.85, weight: 2 }}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <p style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</p>
                        <p style={{ fontSize: 12, color: "#6B7280" }}>{s.city}, {s.state}</p>
                        <p style={{ fontSize: 12, marginTop: 4 }}>{s.type} · {s.size}</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: color }}>{s.computedStatus}</p>
                        {s.potentialMonthly && <p style={{ fontSize: 12 }}>₹{Number(s.potentialMonthly).toLocaleString("en-IN")}/mo</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </div>
      )}

      {/* Sites Table */}
      {viewMode === "list" && <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["State / City", "Site Name", "Type & Size", "Vendor", "Status", "Rate / Month", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-sm" style={{ color: "var(--gray2)" }}>Loading inventory...</td></tr>
              )}
              {!loading && filteredSites.length === 0 && (
                <tr><td colSpan="7" className="px-6 py-12 text-center">
                  <div className="flex justify-center mb-3"><MapPin className="w-10 h-10" style={{ color: "var(--gray3)" }}/></div>
                  <p className="text-sm" style={{ color: "var(--gray2)" }}>No inventory matches your search.</p>
                </td></tr>
              )}
              {filteredSites.map((site) => (
                <tr key={site.id} className="group transition" style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td className="px-5 py-3 whitespace-nowrap">
                    {site.state && <div className="text-xs mb-0.5" style={{ color: "var(--gray2)" }}>{site.state}</div>}
                    <div className="font-semibold text-sm text-white">{site.city}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{site.areaLocality || "—"}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border)" }}>
                        {site.imageUrl
                          ? <img src={site.imageUrl} className="w-full h-full object-cover" alt={site.name} />
                          : <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}><ImageIcon className="w-4 h-4" style={{ color: "var(--gray2)" }}/></div>}
                      </div>
                      <div
                        className="cursor-pointer"
                        onMouseEnter={(e) => handleSiteNameMouseEnter(e, site)}
                        onMouseLeave={handleSiteNameMouseLeave}
                        onClick={() => { if (window.innerWidth < 768) openDetails(site); }}
                      >
                        <div className="font-bold text-white text-sm leading-tight hover:text-blue-400 transition">{site.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>ID: {site.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <SizeCell site={site} />
                    <span className="inline-flex mt-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>{typeLabel(site.type, site.lightingType)}</span>
                  </td>
                  <td className="px-5 py-3">
                    {site.owner?.name
                      ? <span className="text-xs font-medium badge-planned px-2 py-0.5 rounded-full">{site.owner.name}</span>
                      : <span className="text-xs" style={{ color: "var(--gray2)" }}>—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      site.computedStatus === "Vacant" ? "badge-vacant" :
                      site.computedStatus === "Vacant Soon" ? "badge-soon" : "badge-booked"
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{
                        background: site.computedStatus === "Vacant" ? "#22C55E" : site.computedStatus === "Vacant Soon" ? "#F59E0B" : "#DC143C"
                      }}/>
                      {site.computedStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-white whitespace-nowrap">
                    ₹{site.potentialMonthly ? Number(site.potentialMonthly).toLocaleString("en-IN") : "—"}
                    <span className="text-xs font-normal ml-0.5" style={{ color: "var(--gray2)" }}>/mo</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEditModal(site)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition" style={{ background: "rgba(37,99,235,0.1)", color: "#3B82F6", border: "1px solid rgba(37,99,235,0.2)" }} title="Edit">
                        <Edit className="w-3.5 h-3.5"/>
                      </button>
                      <button
                        onClick={() => handleDeleteSite(site)}
                        disabled={deletingId === site.id}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition disabled:opacity-50 disabled:cursor-wait"
                        style={{ background: "rgba(220,20,60,0.1)", color: "#F87171", border: "1px solid rgba(220,20,60,0.2)" }}
                        title={deletingId === site.id ? "Deleting…" : "Delete"}
                      >
                        {deletingId === site.id
                          ? <span className="text-[10px] font-bold animate-pulse">…</span>
                          : <Trash2 className="w-3.5 h-3.5"/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {/* --- HOVER POPUP (desktop) --- */}
      {hoverSite && (
        <div
          style={{ position: "fixed", top: hoverPopupStyle.top, left: hoverPopupStyle.left, zIndex: 9999, width: 420, background: "#0D1428", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <div className="h-52 relative" style={{ background: "rgba(255,255,255,0.05)" }}>
            {hoverSite.imageUrl ? (
              <img src={hoverSite.imageUrl} className="w-full h-full object-cover cursor-pointer" alt={hoverSite.name}
                onClick={() => { clearTimeout(hoverTimeoutRef.current); setHoverSite(null); setEnlargedImage(hoverSite.imageUrl); }} />
            ) : (
              <div className="flex items-center justify-center h-full"><ImageIcon className="w-10 h-10" style={{ color: "var(--gray2)" }}/></div>
            )}
            {hoverSite.imageUrl && (
              <button
                onClick={() => { clearTimeout(hoverTimeoutRef.current); setHoverSite(null); setEnlargedImage(hoverSite.imageUrl); }}
                className="absolute bottom-2 right-2 text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <Maximize2 className="w-3 h-3"/> Enlarge
              </button>
            )}
            <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              hoverSite.computedStatus === "Vacant" ? "badge-vacant" : hoverSite.computedStatus === "Vacant Soon" ? "badge-soon" : "badge-booked"
            }`}>
              {hoverSite.computedStatus}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="font-bold text-white text-base leading-tight">{hoverSite.name}</div>
              <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--gray2)" }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#3B82F6" }}/>
                {[hoverSite.state, hoverSite.city, hoverSite.areaLocality].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Size", value: formatSize(hoverSite) },
                { label: "Type", value: typeLabel(hoverSite.type, hoverSite.lightingType) },
                { label: "Rate", value: `₹${hoverSite.potentialMonthly ? Number(hoverSite.potentialMonthly).toLocaleString("en-IN") : "—"}/mo` },
                { label: "Facing", value: hoverSite.facing || "—" },
              ].map(d => (
                <div key={d.label} className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--gray2)" }}>{d.label}</div>
                  <div className="font-bold text-sm text-white">{d.value}</div>
                </div>
              ))}
            </div>
            {hoverSite.owner?.name && (
              <div className="text-xs font-medium px-3 py-2 rounded-xl badge-planned">{hoverSite.owner.name}</div>
            )}
          </div>
        </div>
      )}

      {/* --- SITE DETAILS MODAL (mobile tap) --- */}
      {detailSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="md:w-[45%] flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="h-56 relative" style={{ background: "rgba(255,255,255,0.05)" }}>
                {detailSite.imageUrl
                  ? <img src={detailSite.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setEnlargedImage(detailSite.imageUrl)} alt="Site" />
                  : <div className="flex items-center justify-center h-full"><ImageIcon className="w-12 h-12" style={{ color: "var(--gray2)" }}/></div>}
                <button onClick={() => setDetailSite(null)} className="md:hidden absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${detailSite.computedStatus === "Vacant" ? "badge-vacant" : "badge-booked"}`}>
                    {detailSite.computedStatus}
                  </span>
                  <span className="text-xl font-bold text-white">₹{detailSite.potentialMonthly ? Number(detailSite.potentialMonthly).toLocaleString("en-IN") : "—"}<span className="text-sm font-normal ml-0.5" style={{ color: "var(--gray2)" }}>/mo</span></span>
                </div>
                <h2 className="font-syne font-extrabold text-xl text-white mb-1 leading-tight">{detailSite.name}</h2>
                <div className="flex items-center gap-2 text-sm mb-5" style={{ color: "var(--gray)" }}>
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#3B82F6" }}/>
                  {[detailSite.state, detailSite.city, detailSite.areaLocality || detailSite.address].filter(Boolean).join(" • ") || "Address not provided"}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "Size", value: formatSize(detailSite) }, { label: "Type", value: typeLabel(detailSite.type, detailSite.lightingType) }, { label: "Facing", value: detailSite.facing || "N/A" }, { label: "Status", value: detailSite.status }].map(d => (
                    <div key={d.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5" style={{ color: "var(--gray2)" }}>{d.label}</div>
                      <div className="font-semibold text-sm text-white">{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="md:w-[55%] flex flex-col relative h-[400px] md:h-auto overflow-hidden">
              <button onClick={() => setDetailSite(null)} className="hidden md:flex absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center transition z-10" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}>
                <X className="w-5 h-5"/>
              </button>
              {/* Tab bar */}
              <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  { id: "bookings", label: "📅 Bookings" },
                  { id: "photos", label: `📷 Photos${Object.values(siteGallery).flat().length > 0 ? ` (${Object.values(siteGallery).flat().length})` : ""}` },
                ].map(t => (
                  <button key={t.id} onClick={() => setDetailTab(t.id)}
                    className="px-5 py-4 text-sm font-semibold border-b-2 transition"
                    style={detailTab === t.id
                      ? { borderColor: "#2563EB", color: "#3B82F6" }
                      : { borderColor: "transparent", color: "var(--gray2)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Bookings panel */}
              {detailTab === "bookings" && (
                <div className="flex-1 p-5 overflow-y-auto">
                  {loadingBookings ? (
                    <div className="flex items-center justify-center h-full" style={{ color: "var(--gray2)" }}><Clock className="w-5 h-5 animate-spin mr-2"/> Loading...</div>
                  ) : siteBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 rounded-2xl" style={{ border: "2px dashed var(--border)" }}>
                      <CheckCircle className="w-10 h-10 mb-3" style={{ color: "#22C55E" }}/>
                      <h4 className="font-bold text-white">Site is vacant</h4>
                      <p className="text-sm mt-1" style={{ color: "var(--gray2)" }}>Ready for a new campaign.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {siteBookings.map((bk) => (
                        <div key={bk.assignmentId} className="p-4 rounded-xl relative overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                          <div className="absolute top-0 left-0 w-1 h-full" style={{ background: bk.status === "ACTIVE" ? "#DC143C" : "#8B5CF6" }}/>
                          <div className="pl-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--gray2)" }}>{bk.bookedFrom} → {bk.bookedTill}</div>
                            <div className="font-bold text-sm text-white">{bk.campaignName}</div>
                            <div className="text-xs mt-0.5" style={{ color: "var(--gray)" }}>{bk.advertiserName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Photos panel */}
              {detailTab === "photos" && (
                <div className="flex-1 p-5 overflow-y-auto">
                  {galleryLoading ? (
                    <div className="flex items-center justify-center h-full" style={{ color: "var(--gray2)" }}><Clock className="w-5 h-5 animate-spin mr-2"/> Loading photos...</div>
                  ) : Object.keys(siteGallery).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 rounded-2xl" style={{ border: "2px dashed var(--border)" }}>
                      <span className="text-4xl mb-3">📷</span>
                      <h4 className="font-bold text-white">No photos yet</h4>
                      <p className="text-sm mt-1" style={{ color: "var(--gray2)" }}>Field workers log activity photos from the mobile app.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(siteGallery).map(([label, photos]) => (
                        <div key={label}>
                          <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--gray2)" }}>
                            {label} <span className="ml-1 font-normal normal-case">({photos.length})</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {photos.map((p, i) => (
                              <div key={i} className="group relative">
                                <img
                                  src={p.url}
                                  alt={label}
                                  className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition"
                                  onClick={() => setEnlargedImage(p.url)}
                                />
                                {(p.performedBy || p.activityDate) && (
                                  <div className="absolute bottom-0 left-0 right-0 rounded-b-xl px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                                    style={{ background: "rgba(0,0,0,0.7)", fontSize: "9px", color: "#fff" }}>
                                    {p.performedBy && <div className="truncate">{p.performedBy}</div>}
                                    {p.activityDate && <div className="text-gray-400">{p.activityDate}</div>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ENLARGE IMAGE MODAL --- */}
      {enlargedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200 p-4">
          <button onClick={() => setEnlargedImage(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition p-2 bg-white/10 hover:bg-white/20 rounded-full">
            <X className="w-8 h-8" />
          </button>
          <img src={enlargedImage} alt="Enlarged Site" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* --- CREATE / EDIT SITE FORM MODAL --- */}
      {(showAdd || showEdit) && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh", background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-syne font-bold text-xl text-white">{showEdit ? "Edit Site" : "Add New Site"}</h3>
              <button onClick={() => { setShowAdd(false); setShowEdit(false); setEditSite(null); }} className="p-2 rounded-xl transition" style={{ background: "rgba(255,255,255,0.08)", color: "var(--gray)" }}><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Helper to get/set value */}
              {(() => {
                const v = (key) => showEdit ? editSite[key] : form[key];
                const s = (key, val) => showEdit ? setEditSite({...editSite, [key]: val}) : setForm({...form, [key]: val});
                return (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Site Name *</label><input required value={v("name")} onChange={e => s("name", e.target.value)} className="tq-input"/></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>City *</label><input required value={v("city")} onChange={e => s("city", e.target.value)} className="tq-input"/></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>State</label><input value={v("state") || ""} onChange={e => s("state", e.target.value)} placeholder="e.g. Maharashtra" className="tq-input"/></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Maintenance Status</label><select value={v("status")} onChange={e => s("status", e.target.value)} className="tq-input"><option>Active</option><option>Inactive</option><option>Maintenance</option></select></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {(() => {
                        const KNOWN = ["Billboard", "Hoarding", "Unipole", "LED", "Digital Screen", "Wall Wrap", "Pole Kiosk", "Gantry", "Transit", "Bus Shelter", "Mall Media"];
                        const cur = v("type") || "Billboard";
                        const isCustom = !KNOWN.includes(cur);
                        return (
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Branding / Site Type</label>
                            <select value={isCustom ? "__other__" : cur}
                              onChange={e => s("type", e.target.value === "__other__" ? "" : e.target.value)}
                              className="tq-input">
                              {KNOWN.map(t => <option key={t} value={t}>{t}</option>)}
                              <option value="__other__">Other (specify)…</option>
                            </select>
                            {isCustom && (
                              <input value={cur} autoFocus onChange={e => s("type", e.target.value)}
                                placeholder="e.g. Tower Wrap, Mall Atrium, Foot Overbridge"
                                className="tq-input mt-2" />
                            )}
                          </div>
                        );
                      })()}
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Lighting</label><select value={v("lightingType") || "Lit"} onChange={e => s("lightingType", e.target.value)} className="tq-input"><option value="Lit">Lit</option><option value="Non-Lit">Non-Lit</option></select></div>
                    </div>
                    <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#3B82F6" }}>Rate (₹/mo) *</label>
                      <input type="number" step="1" placeholder="e.g. 15000" required value={v("potentialMonthly")} onChange={e => s("potentialMonthly", e.target.value)} className="tq-input md:w-1/3"/>
                    </div>
                    {(() => {
                      const setBoth = (patch) => showEdit ? setEditSite(e => ({ ...e, ...patch })) : setForm(f => ({ ...f, ...patch }));
                      const lat = toCoord(v("latitude")), lng = toCoord(v("longitude"));
                      const both = lat != null && lng != null;
                      return (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Location (GPS)</label>
                          <input value={gpsPaste.text} placeholder="Paste a Google Maps link, or type 25.6030, 85.1370"
                            className="tq-input"
                            onChange={e => {
                              const text = e.target.value;
                              const hit = parseLatLng(text);
                              if (hit) {
                                setBoth({ latitude: String(hit.lat), longitude: String(hit.lng) });
                                setGpsPaste({ text, msg: inIndia(hit.lat, hit.lng) ? "✓ Location filled in below" : "Filled in, but this point isn't in India. Check that latitude comes first." });
                              } else if (!text.trim()) {
                                setGpsPaste({ text, msg: "" });
                              } else if (/goo\.gl|maps\.app/.test(text)) {
                                setGpsPaste({ text, msg: "Short links can't be read. Open the link, then copy the full address from the browser bar." });
                              } else {
                                setGpsPaste({ text, msg: "Couldn't find coordinates in that. Paste a Google Maps link or lat, lng." });
                              }
                            }} />
                          {gpsPaste.msg && (
                            <p className="text-[11px] mt-1" style={{ color: gpsPaste.msg.startsWith("✓") ? "#4ADE80" : "#FBBF24" }}>{gpsPaste.msg}</p>
                          )}
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <input type="number" step="any" placeholder="Latitude" value={v("latitude")}
                              onChange={e => s("latitude", e.target.value)} className="tq-input" />
                            <input type="number" step="any" placeholder="Longitude" value={v("longitude")}
                              onChange={e => s("longitude", e.target.value)} className="tq-input" />
                          </div>
                          <p className="text-[10px] mt-1.5" style={{ color: "var(--gray2)" }}>
                            Proof photos are checked against this point: anything taken more than 250 m away is flagged.
                            {both && <>{" "}<a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="font-bold" style={{ color: "#60A5FA" }}>Check on map</a></>}
                          </p>
                        </div>
                      );
                    })()}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Size Description</label>
                      <SizeBuilder value={v("size")} onChange={(val) => s("size", val)} />
                      <p className="text-[10px] mt-2" style={{ color: "var(--gray2)" }}>
                        Add one or more rows to describe the inventory — e.g. <em>1× 1ft × 15ft</em> for a hoarding, or <em>20× 42 inch screens</em> for a multi-panel LED wall.
                      </p>
                    </div>
                    {showEdit && editSite?.id ? (
                      <SiteGallery
                        siteId={editSite.id}
                        siteType={v("type")}
                        coverUrl={v("imageUrl")}
                        onCoverChange={(url) => s("imageUrl", url)}
                      />
                    ) : (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Site Image</label>
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}>
                            {v("imageUrl") ? <img src={v("imageUrl")} className="w-full h-full object-cover"/> : <ImageIcon className="w-5 h-5" style={{ color: "var(--gray2)" }}/>}
                          </div>
                          <div className="flex-1">
                            <input type="file" onChange={(e) => handleFileUpload(e, showEdit)} className="tq-input text-sm cursor-pointer"/>
                            {uploading && <div className="text-xs font-bold mt-1 animate-pulse" style={{ color: "#3B82F6" }}>Uploading...</div>}
                            <p className="text-[10px] mt-1.5" style={{ color: "var(--gray2)" }}>You can add more photos after creating the site.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Assigned Vendor</label>
                      <select value={v("vendorId") || ""} onChange={e => { s("vendorId", e.target.value); s("ownerCompanyId", e.target.value); }} className="tq-input">
                        <option value="">No Vendor Assigned</option>
                        {vendors.map(v2 => <option key={v2.id} value={v2.id}>{v2.name}{v2.city ? ` — ${v2.city}` : ""}</option>)}
                      </select>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => { setShowAdd(false); setShowEdit(false); setEditSite(null); }} className="px-5 py-2.5 rounded-xl text-sm font-bold transition" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="button" onClick={showEdit ? handleEditSubmit : handleCreateSubmit} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>{saving ? "Saving..." : (showEdit ? "Save Changes" : "Create Site")}</button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}

// ── Size description builder (multi-row, qty × W × L unit + note) ───────────
function SizeBuilder({ value, onChange }) {
  const initial = (() => {
    const rows = parseSizeRows(value);
    if (Array.isArray(rows)) return rows;
    if (rows === null && value) {
      // Legacy free-text — carry it forward as a single note-only row.
      return [{ qty: 1, width: "", length: "", unit: "ft", note: value }];
    }
    return [];
  })();
  const [rows, setRows] = useState(initial);

  // Re-sync when caller resets the form (e.g., after Save / Cancel).
  useEffect(() => {
    const parsed = parseSizeRows(value);
    if (Array.isArray(parsed)) { setRows(parsed); return; }
    if (parsed === null && value) {
      setRows([{ qty: 1, width: "", length: "", unit: "ft", note: value }]);
    } else if (!value) {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === "" ? "" : null]); // only react to full clears

  const commit = (next) => {
    setRows(next);
    onChange(next.length ? JSON.stringify(next) : "");
  };

  const addRow = () => commit([...rows, { qty: 1, width: "", length: "", unit: "ft", note: "" }]);
  const removeRow = (i) => commit(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, key, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r);
    commit(next);
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="rounded-lg px-3 py-3 text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border)", color: "var(--gray2)" }}>
          No sizes added yet. Click <strong>+ Add size</strong> below to describe the inventory.
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Qty</label>
              <input type="number" min="1" value={r.qty}
                onChange={e => updateRow(i, "qty", e.target.value)}
                placeholder="1" className="tq-input" style={{ fontSize: "13px" }} />
            </div>
            <div className="col-span-3">
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Width</label>
              <input type="number" value={r.width}
                onChange={e => updateRow(i, "width", e.target.value)}
                placeholder="e.g. 1" className="tq-input" style={{ fontSize: "13px" }} />
            </div>
            <div className="col-span-3">
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Length</label>
              <input type="number" value={r.length}
                onChange={e => updateRow(i, "length", e.target.value)}
                placeholder="optional" className="tq-input" style={{ fontSize: "13px" }} />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Unit</label>
              <select value={r.unit || "ft"}
                onChange={e => updateRow(i, "unit", e.target.value)}
                className="tq-input" style={{ fontSize: "13px" }}>
                <option value="ft">ft</option>
                <option value="inch">inch</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end">
              <button type="button" onClick={() => removeRow(i)}
                title="Remove this row"
                className="p-2 rounded-lg transition"
                style={{ background: "rgba(220,20,60,0.12)", color: "#F87171", border: "1px solid rgba(220,20,60,0.3)" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="col-span-12">
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Note (optional)</label>
              <input type="text" value={r.note || ""}
                onChange={e => updateRow(i, "note", e.target.value)}
                placeholder='e.g. "screens", "panels", "video wall"'
                className="tq-input" style={{ fontSize: "13px" }} />
            </div>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: "var(--gray3)" }}>
            Preview: <span style={{ color: "#60A5FA" }}>{formatSizeRow(r) || "—"}</span>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-bold transition px-3 py-2 rounded-lg"
        style={{ color: "#60A5FA", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}>
        <Plus className="w-3.5 h-3.5" /> Add size
      </button>
    </div>
  );
}

// ── Per-site photo gallery (multiple images, pick the "face") ───────────────
const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(url || "");

function SiteGallery({ siteId, siteType, coverUrl, onCoverChange }) {
  const [images, setImages] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);

  const allowVideos = (siteType || "").toUpperCase() === "LED";

  useEffect(() => {
    apiFetch(`/api/sites/${siteId}/images`).then(r => r.ok ? r.json() : []).then(d => setImages(Array.isArray(d) ? d : [])).catch(() => setImages([]));
  }, [siteId]);

  const reload = async () => {
    const res = await apiFetch(`/api/sites/${siteId}/images`);
    if (res.ok) setImages(await res.json());
  };

  const uploadFiles = async (files) => {
    setBusy(true);
    try {
      for (const raw of Array.from(files)) {
        const isVid = (raw.type || "").startsWith("video/");
        const fd = new FormData();
        // Photos get canvas-compressed; videos upload as-is (preserve playable format)
        fd.append("file", isVid ? raw : await compressImage(raw));
        const res = await apiFetch(`/api/sites/${siteId}/images`, { method: "POST", body: fd });
        if (res.ok) {
          const created = await res.json();
          if (created.isPrimary) onCoverChange?.(created.imageUrl);
        }
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (img) => {
    const res = await apiFetch(`/api/sites/${siteId}/images/${img.id}/set-primary`, { method: "POST" });
    if (res.ok) {
      onCoverChange?.(img.imageUrl);
      await reload();
    }
  };

  const deleteImg = async (img) => {
    if (!confirm("Remove this photo from the site?")) return;
    const res = await apiFetch(`/api/sites/${siteId}/images/${img.id}`, { method: "DELETE" });
    if (res.ok) {
      // If we deleted the cover, the backend promoted another (or cleared it)
      const next = await apiFetch(`/api/sites/${siteId}/images`).then(r => r.ok ? r.json() : []);
      setImages(next);
      const newCover = next.find(x => x.isPrimary);
      if (img.imageUrl === coverUrl) onCoverChange?.(newCover ? newCover.imageUrl : "");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>
          {allowVideos ? "Site Photos / Videos" : "Site Photos"} {images && <span style={{ color: "var(--gray3)" }}>({images.length})</span>}
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer transition"
          style={{ color: "#60A5FA" }}>
          {busy ? "Uploading…" : <><UploadIcon className="w-3.5 h-3.5" /> {allowVideos ? "Add photos / videos" : "Add photos"}</>}
          <input type="file" accept={allowVideos ? "image/*,video/*" : "image/*"} multiple className="hidden" disabled={busy}
            onChange={e => {
              // Copy FileList before clearing — setting value="" empties the FileList too
              if (e.target.files?.length) {
                const filesCopy = Array.from(e.target.files);
                e.target.value = "";
                uploadFiles(filesCopy);
              } else { e.target.value = ""; }
            }} />
        </label>
      </div>

      {images === null ? (
        <div className="py-4 text-center text-xs" style={{ color: "var(--gray3)" }}>Loading photos…</div>
      ) : images.length === 0 ? (
        <div className="rounded-xl py-6 text-center text-xs"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border)", color: "var(--gray3)" }}>
          No photos yet. Add one (or several) — the first becomes the cover; tap ★ on any other to make it the cover.
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {images.map(img => {
            const video = isVideoUrl(img.imageUrl);
            return (
              <div key={img.id} className="relative group rounded-lg overflow-hidden"
                style={{ aspectRatio: "1/1", border: img.isPrimary ? "2px solid #F59E0B" : "1px solid var(--border)", background: "rgba(255,255,255,0.04)" }}>
                {video ? (
                  <div onClick={() => setZoom(img.imageUrl)}
                    className="w-full h-full cursor-pointer relative flex items-center justify-center"
                    style={{ background: "#000" }}>
                    <video src={img.imageUrl + "#t=0.1"} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                        <span style={{ color: "#fff", fontSize: 14, marginLeft: 2 }}>▶</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => setZoom(img.imageUrl)} />
                )}
                {img.isPrimary && (
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                    style={{ background: "rgba(245,158,11,0.95)", color: "#1a1100" }}>
                    <Star className="w-2.5 h-2.5 fill-current" /> Cover
                  </span>
                )}
                {video && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                    Video
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
                  {!img.isPrimary && !video ? (
                    <button onClick={() => setCover(img)} title="Set as cover"
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                      style={{ background: "rgba(245,158,11,0.2)", color: "#FBBF24" }}>
                      <Star className="w-2.5 h-2.5" /> Cover
                    </button>
                  ) : <span />}
                  <button onClick={() => deleteImg(img)} title={video ? "Remove video" : "Remove photo"}
                    className="text-[10px] font-bold p-1 rounded"
                    style={{ background: "rgba(220,20,60,0.2)", color: "#FB7185" }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setZoom(null)}>
          {isVideoUrl(zoom) ? (
            <video src={zoom} controls autoPlay playsInline className="max-w-full max-h-full rounded-xl bg-black" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={zoom} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          )}
          <button onClick={() => setZoom(null)} className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
