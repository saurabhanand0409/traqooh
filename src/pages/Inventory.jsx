import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";
import EmployeeNav from "../components/EmployeeNav";
import {
  Search, Plus, Maximize2, X, Calendar as CalendarIcon,
  MapPin, CheckCircle, XCircle, ChevronRight, Clock, Image as ImageIcon, Target, Edit
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
    <div className="min-h-screen bg-[#f3f4f6] text-[#0f172a] font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-16">
        <div className="mx-auto max-w-7xl px-5 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 text-white grid place-items-center">
              <span className="font-bold text-xl">t</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-900 tracking-tight">traqOOH</span>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Tabs / Sub-Nav */}
      <EmployeeNav />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Inventory Management</h1>
            <p className="text-gray-500 mt-1 font-medium">Manage sites, check availability, edit features and rates.</p>
          </div>
          {!isAdmin && (
            <button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition">
              <Plus className="w-5 h-5"/> Add New Site
            </button>
          )}
          {isAdmin && (
            <span className="text-xs text-gray-400 border rounded-lg px-4 py-2.5 bg-gray-50">👁 View Only Mode</span>
          )}
        </div>

        {/* Dashboard Analytics Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><MapPin className="w-6 h-6"/></div>
            <div><div className="text-sm font-semibold text-gray-500">Total Sites</div><div className="text-2xl font-bold">{totalSites}</div></div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle className="w-6 h-6"/></div>
            <div><div className="text-sm font-semibold text-gray-500">Vacant Sites</div><div className="text-2xl font-bold">{vacantSites}</div></div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><XCircle className="w-6 h-6"/></div>
            <div><div className="text-sm font-semibold text-gray-500">Booked Sites</div><div className="text-2xl font-bold">{bookedSites}</div></div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Target className="w-6 h-6"/></div>
            <div><div className="text-sm font-semibold text-gray-500">Occupancy</div><div className="text-2xl font-bold">{occupancyRate}%</div></div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full">
            <Search className="w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by site name or location..." className="w-full bg-transparent border-none outline-none text-sm font-medium" />
          </div>
          <div className="flex flex-row gap-3 w-full md:w-auto">
            <select value={cityFilter} onChange={e=>setCityFilter(e.target.value)} className="bg-gray-50 border border-gray-200 text-sm font-medium rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-40 cursor-pointer">
              {cities.map(c => <option key={c} value={c}>{c === "All" ? "All Cities" : c}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="bg-gray-50 border border-gray-200 text-sm font-medium rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-40 cursor-pointer">
              <option value="All">All Status</option>
              <option value="Vacant">Vacant</option>
              <option value="Booked">Booked</option>
            </select>
          </div>
        </div>

        {/* Sites Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold border border-gray-200">State / City</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200">Site Name</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200">Type & Size</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200">Vendor</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200 text-center">Status</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200 text-right">Rate / Month</th>
                  <th className="px-5 py-3 font-semibold border border-gray-200 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500 font-medium border border-gray-200">Loading inventory...</td></tr>}
                {!loading && filteredSites.length === 0 && (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500 border border-gray-200">
                    <div className="flex justify-center mb-3"><MapPin className="w-10 h-10 text-gray-300"/></div>
                    No inventory matches your search.
                  </td></tr>
                )}

                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-blue-50/40 transition-colors group">

                    {/* Col 1: State / City */}
                    <td className="px-5 py-3 border border-gray-200 whitespace-nowrap">
                      {site.state && <div className="text-xs text-gray-400 font-medium mb-0.5">{site.state}</div>}
                      <div className="font-semibold text-gray-800 text-sm">{site.city}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{site.areaLocality || site.address || "—"}</div>
                    </td>

                    {/* Col 2: Site Name + Photo (hover for popup, tap for modal on mobile) */}
                    <td className="px-5 py-3 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-100 overflow-hidden flex-shrink-0">
                          {site.imageUrl
                            ? <img src={site.imageUrl} className="w-full h-full object-cover" alt={site.name} />
                            : <ImageIcon className="w-5 h-5 text-gray-400 m-auto mt-4" />}
                        </div>
                        <div
                          className="cursor-pointer"
                          onMouseEnter={(e) => handleSiteNameMouseEnter(e, site)}
                          onMouseLeave={handleSiteNameMouseLeave}
                          onClick={() => { if (window.innerWidth < 768) openDetails(site); }}
                        >
                          <div className="font-bold text-gray-900 group-hover:text-blue-700 transition leading-tight hover:underline decoration-dotted underline-offset-2">{site.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">ID: {site.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Col 3: Type & Size — Size prominent on top, Type with lighting below */}
                    <td className="px-5 py-3 border border-gray-200 whitespace-nowrap">
                      <div className="font-bold text-gray-800 text-sm">{site.width && site.length ? `${site.width}×${site.length} ft` : (site.size || "—")}</div>
                      <span className="inline-flex mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">{typeLabel(site.type, site.lightingType)}</span>
                    </td>

                    {/* Col 4: Vendor */}
                    <td className="px-5 py-3 border border-gray-200">
                      {site.owner?.name
                        ? <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{site.owner.name}</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>

                    {/* Col 5: Status */}
                    <td className="px-5 py-3 border border-gray-200 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${site.statusColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${site.statusDot}`}></div>
                        {site.computedStatus}
                      </span>
                    </td>

                    {/* Col 6: Rate per Month */}
                    <td className="px-5 py-3 border border-gray-200 text-right font-bold text-gray-900 whitespace-nowrap">
                      ₹{site.potentialMonthly ? Number(site.potentialMonthly).toLocaleString("en-IN") : "—"}<span className="text-xs font-normal text-gray-400 ml-0.5">/mo</span>
                    </td>

                    {/* Col 7: Actions */}
                    <td className="px-5 py-3 border border-gray-200 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {!isAdmin && (
                          <>
                            <button onClick={() => openEditModal(site)} className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50 bg-gray-50 rounded-lg border border-gray-200 transition" title="Edit">
                              <Edit className="w-4 h-4"/>
                            </button>
                            <button onClick={() => handleDeleteSite(site)} className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-red-600 hover:bg-red-50 bg-gray-50 rounded-lg border border-gray-200 transition" title="Delete">
                              <X className="w-4 h-4"/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- HOVER POPUP (desktop) --- */}
      {hoverSite && (
        <div
          style={{ position: "fixed", top: hoverPopupStyle.top, left: hoverPopupStyle.left, zIndex: 9999, width: 480 }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Image */}
          <div className="h-64 bg-gray-100 relative">
            {hoverSite.imageUrl ? (
              <img
                src={hoverSite.imageUrl}
                className="w-full h-full object-cover cursor-pointer"
                alt={hoverSite.name}
                onClick={() => { clearTimeout(hoverTimeoutRef.current); setHoverSite(null); setEnlargedImage(hoverSite.imageUrl); }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300"><ImageIcon className="w-10 h-10"/></div>
            )}
            {hoverSite.imageUrl && (
              <button
                onClick={() => { clearTimeout(hoverTimeoutRef.current); setHoverSite(null); setEnlargedImage(hoverSite.imageUrl); }}
                className="absolute bottom-2 right-2 bg-black/60 text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-black/80 transition"
              >
                <Maximize2 className="w-3 h-3"/> Enlarge
              </button>
            )}
            <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${hoverSite.statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hoverSite.statusDot}`}></span>
              {hoverSite.computedStatus}
            </span>
          </div>
          {/* Details */}
          <div className="p-5 space-y-4">
            <div>
              <div className="font-bold text-gray-900 text-lg leading-tight">{hoverSite.name}</div>
              <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0"/>
                {[hoverSite.state, hoverSite.city, hoverSite.areaLocality].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-gray-400 font-semibold uppercase tracking-wide text-xs mb-1">Size</div>
                <div className="font-bold text-gray-800 text-base">{hoverSite.width && hoverSite.length ? `${hoverSite.width}×${hoverSite.length} ft` : (hoverSite.size || "—")}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-gray-400 font-semibold uppercase tracking-wide text-xs mb-1">Type</div>
                <div className="font-bold text-gray-800 text-base">{typeLabel(hoverSite.type, hoverSite.lightingType)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-gray-400 font-semibold uppercase tracking-wide text-xs mb-1">Rate</div>
                <div className="font-bold text-blue-700 text-base">₹{hoverSite.potentialMonthly ? Number(hoverSite.potentialMonthly).toLocaleString("en-IN") : "—"}<span className="text-gray-400 font-normal text-sm">/mo</span></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-gray-400 font-semibold uppercase tracking-wide text-xs mb-1">Facing</div>
                <div className="font-bold text-gray-800 text-base">{hoverSite.facing || "—"}</div>
              </div>
            </div>
            {hoverSite.owner?.name && (
              <div className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-xl font-medium">
                Vendor: {hoverSite.owner.name}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SITE DETAILS MODAL (mobile tap) --- */}
      {detailSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-black/40 animate-in zoom-in-95 duration-200 outline-none">

            {/* Modal Left - Image Gallery & Basic Info */}
            <div className="md:w-[45%] bg-gray-50 border-r border-gray-100 flex flex-col">
              <div className="h-64 relative bg-gray-200">
                {detailSite.imageUrl ? (
                  <img src={detailSite.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setEnlargedImage(detailSite.imageUrl)} alt="Site" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400"><ImageIcon className="w-12 h-12 opacity-50"/></div>
                )}
                <button onClick={() => setDetailSite(null)} className="md:hidden absolute top-4 right-4 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${detailSite.statusColor}`}>
                    <div className={`w-2 h-2 rounded-full ${detailSite.computedStatus === "Booked" ? "bg-red-500" : "bg-green-500"}`}></div>
                    {detailSite.computedStatus.toUpperCase()}
                  </span>
                  <span className="text-xl font-bold">₹{detailSite.potentialMonthly ? Number(detailSite.potentialMonthly).toLocaleString("en-IN") : "—"}<span className="text-sm font-normal text-gray-400">/mo</span></span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1 leading-tight">{detailSite.name}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-6">
                  <MapPin className="w-4 h-4 text-blue-500"/>
                  {[detailSite.state, detailSite.city, detailSite.areaLocality || detailSite.address].filter(Boolean).join(" • ") || "Address not provided"}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border p-3 rounded-xl shadow-sm"><div className="text-xs text-gray-400 uppercase font-bold">Size</div><div className="font-semibold text-gray-800">{detailSite.width && detailSite.length ? `${detailSite.width}×${detailSite.length} ft` : (detailSite.size || "—")}</div></div>
                  <div className="bg-white border p-3 rounded-xl shadow-sm"><div className="text-xs text-gray-400 uppercase font-bold">Type</div><div className="font-semibold text-gray-800">{typeLabel(detailSite.type, detailSite.lightingType)}</div></div>
                  <div className="bg-white border p-3 rounded-xl shadow-sm"><div className="text-xs text-gray-400 uppercase font-bold">Facing</div><div className="font-semibold text-gray-800">{detailSite.facing || "N/A"}</div></div>
                  <div className="bg-white border p-3 rounded-xl shadow-sm"><div className="text-xs text-gray-400 uppercase font-bold">Maintenance</div><div className="font-semibold text-gray-800">{detailSite.status}</div></div>
                </div>
              </div>
            </div>

            {/* Modal Right - Booking Schedule */}
            <div className="md:w-[55%] flex flex-col relative h-[500px] md:h-auto overflow-hidden">
              <button onClick={() => setDetailSite(null)} className="hidden md:flex absolute top-4 right-4 w-8 h-8 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full items-center justify-center transition z-10">
                <X className="w-5 h-5"/>
              </button>

              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                  <CalendarIcon className="w-5 h-5 text-blue-600" /> Booking Schedule
                </h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">View availability and active campaigns.</p>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
                {loadingBookings ? (
                  <div className="flex items-center justify-center h-full text-gray-500"><Clock className="w-6 h-6 animate-spin mr-2"/> Loading schedule...</div>
                ) : siteBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-gray-200 rounded-2xl">
                    <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
                    <h4 className="font-bold text-gray-800">Site is completely vacant</h4>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">No active or upcoming bookings found.<br/>This site is ready for a new campaign.</p>
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:left-[17px] before:w-0.5 before:bg-blue-100">
                    {siteBookings.map((bk) => (
                      <div key={bk.assignmentId} className="relative pl-10">
                        <div className="absolute left-0 top-1.5 w-9 h-9 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center z-10">
                          <Target className="w-4 h-4 text-blue-600"/>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group hover:border-blue-200 hover:shadow-md transition">
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${bk.status === "ACTIVE" ? "bg-red-500" : "bg-purple-500"}`}></div>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                {bk.bookedFrom} &rarr; {bk.bookedTill}
                              </div>
                              <h5 className="font-bold text-gray-900 group-hover:text-blue-700 transition">{bk.campaignName}</h5>
                              <div className="text-sm font-medium text-gray-600 mt-0.5">{bk.advertiserName}</div>
                            </div>
                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${bk.status === "ACTIVE" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>
                              {bk.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="relative pl-10 pt-4">
                      <div className="absolute left-0 top-5.5 w-9 h-9 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center z-10">
                        <CheckCircle className="w-5 h-5"/>
                      </div>
                      <div className="py-2">
                        <span className="font-bold text-green-600 text-sm">Becomes Vacant</span>
                        <div className="text-xs text-gray-500 mt-0.5">After {siteBookings[siteBookings.length-1].bookedTill}</div>
                      </div>
                    </div>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">{showEdit ? "Edit Inventory Details" : "Add New Inventory"}</h3>
                <button onClick={() => { setShowAdd(false); setShowEdit(false); setEditSite(null); }} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm border border-gray-200 transition text-gray-500"><X className="w-4 h-4"/></button>
             </div>
             <form onSubmit={showEdit ? handleEditSubmit : handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Site Name *</label>
                    <input required value={showEdit ? editSite.name : form.name} onChange={e=> showEdit ? setEditSite({...editSite, name:e.target.value}) : setForm({...form, name:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">City *</label>
                    <input required value={showEdit ? editSite.city : form.city} onChange={e=> showEdit ? setEditSite({...editSite, city:e.target.value}) : setForm({...form, city:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">State</label>
                    <input value={showEdit ? (editSite.state || "") : form.state} onChange={e=> showEdit ? setEditSite({...editSite, state:e.target.value}) : setForm({...form, state:e.target.value})} placeholder="e.g. Maharashtra" className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Maintenance Status</label>
                    <select value={showEdit ? editSite.status : form.status} onChange={e=> showEdit ? setEditSite({...editSite, status:e.target.value}) : setForm({...form, status:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                      <option>Active</option><option>Inactive</option><option>Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Site Type</label>
                    <select value={showEdit ? editSite.type : form.type} onChange={e=> showEdit ? setEditSite({...editSite, type:e.target.value}) : setForm({...form, type:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                      <option>Billboard</option><option>LED</option><option>Hoarding</option><option>Unipole</option><option>Gantry</option><option>Transit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Lighting Type</label>
                    <select value={showEdit ? (editSite.lightingType || "Lit") : form.lightingType} onChange={e=> showEdit ? setEditSite({...editSite, lightingType:e.target.value}) : setForm({...form, lightingType:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                      <option value="Lit">Lit</option>
                      <option value="Non-Lit">Non-Lit</option>
                    </select>
                  </div>
                </div>

                {/* Dimensions & Rate */}
                <div className="grid md:grid-cols-3 gap-5 border-t border-gray-100 pt-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Width (ft)</label>
                    <input type="number" placeholder="0" value={showEdit ? editSite.width : form.width} onChange={e=> showEdit ? setEditSite({...editSite, width:e.target.value}) : setForm({...form, width:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Height / Length (ft)</label>
                    <input type="number" placeholder="0" value={showEdit ? editSite.length : form.length} onChange={e=> showEdit ? setEditSite({...editSite, length:e.target.value}) : setForm({...form, length:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1.5">Rate (₹ / month)</label>
                    <input type="number" step="1" placeholder="e.g. 15000" required value={showEdit ? editSite.potentialMonthly : form.potentialMonthly} onChange={e=> showEdit ? setEditSite({...editSite, potentialMonthly:e.target.value}) : setForm({...form, potentialMonthly:e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-blue-50/50 border-blue-100 focus:bg-white font-bold text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"/>
                  </div>
                </div>

                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Site Image Upload</label>
                   <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                       {(showEdit ? editSite.imageUrl : form.imageUrl) ? (
                         <img src={showEdit ? editSite.imageUrl : form.imageUrl} className="w-full h-full object-cover"/>
                       ) : <ImageIcon className="w-6 h-6 text-gray-400"/>}
                     </div>
                     <div className="flex-1">
                       <input type="file" onChange={(e) => handleFileUpload(e, showEdit)} className="w-full border border-gray-300 rounded-xl p-2 text-sm file:mr-4 file:px-4 file:py-1.5 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 transition cursor-pointer"/>
                       {uploading && <div className="text-xs font-bold text-blue-600 mt-1.5 animate-pulse">Uploading securely to cloud...</div>}
                     </div>
                   </div>
                </div>

                {/* Assigned Vendor */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Assigned Vendor</label>
                  <select
                    value={showEdit ? (editSite.vendorId || "") : (form.vendorId || "")}
                    onChange={e => showEdit ? setEditSite({...editSite, vendorId: e.target.value, ownerCompanyId: e.target.value}) : setForm({...form, vendorId: e.target.value, ownerCompanyId: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                    <option value="">No Vendor Assigned</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
                  </select>
                </div>

             </form>
             <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50 rounded-b-3xl">
                <button type="button" onClick={() => {setShowAdd(false); setShowEdit(false); setEditSite(null)}} className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition shadow-sm">Cancel</button>
                <button type="button" onClick={showEdit ? handleEditSubmit : handleCreateSubmit} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-md shadow-blue-500/20">{saving ? "Saving..." : (showEdit ? "Save Changes" : "Create Site")}</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
