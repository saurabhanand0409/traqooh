import React, { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import {
  Search, Plus, Maximize2, X, Calendar as CalendarIcon,
  MapPin, CheckCircle, XCircle, Clock, Image as ImageIcon, Target, Edit
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function Inventory() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  }, []);

  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editSite, setEditSite] = useState(null);

  // Details Modal state (for mobile tap)
  const [detailSite, setDetailSite] = useState(null);
  const [siteBookings, setSiteBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

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
  const [currentOwnerId, setCurrentOwnerId] = useState(user.companyId || null);
  const isAdmin = user.role === "ADMIN";

  const emptyForm = {
    name: "", city: "", state: "", type: "Billboard", lightingType: "Lit",
    size: "", width: 0, length: 0,
    facing: "", status: "Active", potentialMonthly: "", imageUrl: "",
    ownerCompanyId: user.companyId || "", vendorId: user.companyId || "",
    addedByUserId: user.userId || ""
  };
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  // Fetch Sites
  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      setError("");
      try {
        let url = `${API_BASE}/api/mobile/sites`;
        if (currentOwnerId) url += `?ownerId=${currentOwnerId}`;
        const res = await fetch(url);
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
    fetch(`${API_BASE}/api/vendors`)
      .then(r => r.ok && r.json())
      .then(data => data && setVendors(data))
      .catch(() => {});
    if (user.companyId && !isAdmin) setCurrentOwnerId(user.companyId);
  }, [user.companyId]);

  // Filters Options
  const cities = ["All", ...new Set(sites.map(s => s.city).filter(Boolean))].sort();

  // Apply Search & Filters
  const filteredSites = sites.filter(s => {
    const matchesSearch = (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
                          (s.city || "").toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter === "All" || s.city === cityFilter;
    const matchesStatus = statusFilter === "All" || s.computedStatus === statusFilter;
    return matchesSearch && matchesCity && matchesStatus;
  });

  // Calculate top-level stats
  const totalSites = sites.length;
  const vacantSites = sites.filter(s => s.computedStatus === "Vacant").length;
  const bookedSites = sites.filter(s => s.computedStatus === "Booked").length;
  const occupancyRate = totalSites ? Math.round((bookedSites / totalSites) * 100) : 0;

  // Image Upload
  const handleFileUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
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

  // Delete Site
  const handleDeleteSite = async (site) => {
    if (!confirm(`Delete "${site.name}"? This cannot be undone.`)) return;
    await fetch(`${API_BASE}/api/sites/${site.id}`, { method: "DELETE" });
    window.location.reload();
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
      };
      const res = await fetch(`${API_BASE}/api/sites`, {
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
      };
      const res = await fetch(`${API_BASE}/api/sites/${editSite.id}`, {
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
     });
     setShowEdit(true);
  };

  // View Details & Fetch Bookings (mobile / manual trigger)
  const openDetails = async (site) => {
    setDetailSite(site);
    setSiteBookings([]);
    setLoadingBookings(true);
    try {
      const res = await fetch(`${API_BASE}/api/sites/${site.id}/bookings`);
      if (res.ok) {
        const bk = await res.json();
        setSiteBookings(bk);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingBookings(false);
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
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="tq-input flex-1 md:w-36 py-2 text-sm">
            {cities.map(c => <option key={c} value={c}>{c === "All" ? "All Cities" : c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="tq-input flex-1 md:w-36 py-2 text-sm">
            <option value="All">All Status</option>
            <option value="Vacant">Vacant</option>
            <option value="Booked">Booked</option>
            <option value="Vacant Soon">Vacant Soon</option>
          </select>
        </div>
      </div>

      {/* Sites Table */}
      <div className="glass rounded-2xl overflow-hidden">
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
                    <div className="font-bold text-sm text-white">{site.width && site.length ? `${site.width}×${site.length} ft` : (site.size || "—")}</div>
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
                    {!isAdmin && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(site)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition" style={{ background: "rgba(37,99,235,0.1)", color: "#3B82F6", border: "1px solid rgba(37,99,235,0.2)" }} title="Edit">
                          <Edit className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={() => handleDeleteSite(site)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition" style={{ background: "rgba(220,20,60,0.1)", color: "#F87171", border: "1px solid rgba(220,20,60,0.2)" }} title="Delete">
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                { label: "Size", value: hoverSite.width && hoverSite.length ? `${hoverSite.width}×${hoverSite.length} ft` : (hoverSite.size || "—") },
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
                  {[{ label: "Size", value: detailSite.width && detailSite.length ? `${detailSite.width}×${detailSite.length} ft` : (detailSite.size || "—") }, { label: "Type", value: typeLabel(detailSite.type, detailSite.lightingType) }, { label: "Facing", value: detailSite.facing || "N/A" }, { label: "Status", value: detailSite.status }].map(d => (
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
              <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-syne font-bold text-lg text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" style={{ color: "#2563EB" }}/> Booking Schedule
                </h3>
              </div>
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
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Site Type</label><select value={v("type")} onChange={e => s("type", e.target.value)} className="tq-input"><option>Billboard</option><option>LED</option><option>Hoarding</option><option>Unipole</option><option>Gantry</option><option>Transit</option></select></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Lighting</label><select value={v("lightingType") || "Lit"} onChange={e => s("lightingType", e.target.value)} className="tq-input"><option value="Lit">Lit</option><option value="Non-Lit">Non-Lit</option></select></div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Width (ft)</label><input type="number" placeholder="0" value={v("width")} onChange={e => s("width", e.target.value)} className="tq-input"/></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Length (ft)</label><input type="number" placeholder="0" value={v("length")} onChange={e => s("length", e.target.value)} className="tq-input"/></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#3B82F6" }}>Rate (₹/mo) *</label><input type="number" step="1" placeholder="e.g. 15000" required value={v("potentialMonthly")} onChange={e => s("potentialMonthly", e.target.value)} className="tq-input"/></div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>Site Image</label>
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}>
                          {v("imageUrl") ? <img src={v("imageUrl")} className="w-full h-full object-cover"/> : <ImageIcon className="w-5 h-5" style={{ color: "var(--gray2)" }}/>}
                        </div>
                        <div className="flex-1">
                          <input type="file" onChange={(e) => handleFileUpload(e, showEdit)} className="tq-input text-sm cursor-pointer"/>
                          {uploading && <div className="text-xs font-bold mt-1 animate-pulse" style={{ color: "#3B82F6" }}>Uploading...</div>}
                        </div>
                      </div>
                    </div>
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
