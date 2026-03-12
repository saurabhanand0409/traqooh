import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function Inventory() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("tq_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const displayName = (user.email && user.email.split("@")[0]) || "Demo User";
  const roleLabel =
    user.role === "media-owner"
      ? "Vendor User"
      : user.role === "advertiser"
        ? "Advertiser"
        : "Vendor User";

  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState([]);
  const [currentOwnerId, setCurrentOwnerId] = useState(user.companyId || null);
  const [form, setForm] = useState({
    name: "",
    city: "",
    type: "Billboard",
    size: "",
    width: 0,
    length: 0,
    totalArea: 0,
    facing: "",
    status: "Active",
    potentialMonthly: "1.0",
    imageUrl: "",
    ownerCompanyId: user.companyId || "",
  });

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      setError("");
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setEditSite({ ...editSite, imageUrl: data.imageUrl });
        } else {
          setForm({ ...form, imageUrl: data.imageUrl });
        }
      }
    } catch (err) {
      setError(err.message || "Unable to upload image");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        setError("");

        // Use mobile API which works correctly
        let url = `${API_BASE}/api/mobile/sites`;
        if (currentOwnerId) {
          url += `?ownerId=${currentOwnerId}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load sites");
        const data = await res.json();
        setSites(
          data.map((s) => ({
            ...s,
            tag: (s.type || "").toUpperCase(),
            potential: Number(s.potentialMonthly || 0),
            ownerName: s.owner?.name || s.owner?.companyName,
            ownerId: s.owner?.id,
          }))
        );
      } catch (err) {
        setError(err.message || "Unable to fetch sites");
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, [search, typeFilter, currentOwnerId]);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/media-owners/all`);
        if (!res.ok) throw new Error("Failed to load media owners");
        const data = await res.json();
        setOwners(data);
      } catch (err) {
        console.warn(err);
      }
    };
    fetchOwners();

    // Use companyId directly from localStorage
    if (user.companyId) {
      setCurrentOwnerId(user.companyId);
    }
  }, [user.companyId]);

  const totalSites = sites.length;
  const activeSites = sites.filter((s) => (s.status || "").toLowerCase() === "active").length;
  const totalArea = sites.reduce((sum, s) => sum + (Number(s.total_area) || (Number(s.width) * Number(s.length)) || 0), 0);
  const avgOccupancy =
    sites.length > 0
      ? Math.round(sites.reduce((sum, s) => sum + (s.occupancy || 0), 0) / sites.length)
      : 0;

  // Sort sites alphabetically by city
  const filteredSites = [...sites].sort((a, b) =>
    (a.city || "").localeCompare(b.city || "")
  );

  const siteTypes = ["All", ...new Set(sites.map((s) => s.type))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        name: form.name || "Untitled Site",
        city: form.city || "Unknown",
        type: form.type,
        status: form.status,
        size: form.size || "N/A",
        width: Number(form.width) || 0,
        length: Number(form.length) || 0,
        totalArea: (Number(form.width) || 0) * (Number(form.length) || 0),
        facing: form.facing || "N/A",
        potentialMonthly: Number.parseFloat(form.potentialMonthly) || 0,
        occupancy: form.status === "Active" ? 70 : 0,
        imageUrl:
          form.imageUrl ||
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        ownerCompanyId: form.ownerCompanyId ? Number(form.ownerCompanyId) : (currentOwnerId ? Number(currentOwnerId) : null),
      };
      const res = await fetch(`${API_BASE}/api/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save site");
      const created = await res.json();
      setSites((prev) => [
        {
          ...created,
          tag: (created.type || "").toUpperCase(),
          potential: Number(created.potentialMonthly || payload.potentialMonthly || 0),
          ownerName: created.owner?.name || created.owner?.companyName,
          ownerId: created.owner?.id,
        },
        ...prev,
      ]);
      setForm({
        name: "",
        city: "",
        type: "Billboard",
        size: "",
        width: 0,
        length: 0,
        totalArea: 0,
        facing: "",
        status: "Active",
        potentialMonthly: "1.0",
        imageUrl: "",
        ownerCompanyId: currentOwnerId || "",
      });
      setShowAdd(false);
    } catch (err) {
      setError(err.message || "Unable to save site");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (site) => {
    setEditSite({
      id: site.id,
      name: site.name || "",
      city: site.city || "",
      type: site.type || "Billboard",
      size: site.size || "",
      width: site.width || 0,
      length: site.length || 0,
      totalArea: site.total_area || (site.width * site.length) || 0,
      facing: site.facing || "",
      status: site.status || "Active",
      potentialMonthly: String(site.potentialMonthly || site.potential || "0"),
      occupancy: site.occupancy || 0,
      imageUrl: site.imageUrl || "",
    });
    setShowEdit(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        name: editSite.name,
        city: editSite.city,
        type: editSite.type,
        status: editSite.status,
        size: editSite.size,
        width: Number(editSite.width) || 0,
        length: Number(editSite.length) || 0,
        totalArea: (Number(editSite.width) || 0) * (Number(editSite.length) || 0),
        facing: editSite.facing,
        potentialMonthly: Number.parseFloat(editSite.potentialMonthly) || 0,
        occupancy: Number(editSite.occupancy) || 0,
        imageUrl: editSite.imageUrl,
      };
      const res = await fetch(`${API_BASE}/api/sites/${editSite.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update site");
      const updated = await res.json();
      setSites((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? {
              ...updated,
              tag: (updated.type || "").toUpperCase(),
              potential: Number(updated.potentialMonthly || 0),
              ownerName: updated.owner?.name || updated.owner?.companyName,
              ownerId: updated.owner?.id,
            }
            : s
        )
      );
      setShowEdit(false);
      setEditSite(null);
    } catch (err) {
      setError(err.message || "Unable to update site");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (siteId) => {
    if (!window.confirm("Are you sure you want to delete this site?")) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete site");
      setSites((prev) => prev.filter((s) => s.id !== siteId));
    } catch (err) {
      setError(err.message || "Unable to delete site");
    }
  };


  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="traqOOH logo" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-[#0f172a]">OOH Marketplace</span>
          </div>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-[#475569]">
            <Link className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100" to="/dashboard">
              🏠 Dashboard
            </Link>
            <Link
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
              to="/inventory"
            >
              🗂️ My Inventory
            </Link>
            <a className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100" href="#">
              🎯 Campaign Requests
            </a>
            <a className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100" href="#">
              🤝 Collaborate
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100" title="Notifications">
              🔔
            </button>
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">My Inventory</h1>
            <p className="text-gray-600 mt-2">Manage your media sites and track performance</p>
          </div>
          <div className="text-sm text-gray-600">
            {currentOwnerId
              ? "Showing only your sites"
              : "Showing all sites (no owner filter applied)"}
          </div>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700"
        >
          + Add New Site
        </button>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Sites</div>
            <div className="text-3xl font-semibold mt-2">{totalSites}</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Active Sites</div>
            <div className="text-3xl font-semibold mt-2">{activeSites}</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Area</div>
            <div className="text-3xl font-semibold mt-2">{totalArea.toLocaleString()} sqft</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Avg. Occupancy</div>
            <div className="text-3xl font-semibold mt-2">{avgOccupancy}%</div>
          </div>
        </section>

        {/* Filters */}
        <section className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1 flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-2 shadow-sm">
            <span className="text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by city or site name..."
              className="w-full outline-none text-sm text-gray-700 placeholder:text-gray-400"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="md:w-48 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            {siteTypes.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Types" : t}
              </option>
            ))}
          </select>
        </section>

        {/* Sites Table */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && (
            <div className="p-6 text-center text-gray-600">
              Loading sites...
            </div>
          )}
          {!loading && error && (
            <div className="p-6 text-center text-red-700 bg-red-50">
              {error}
            </div>
          )}
          {!loading && !error && filteredSites.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No sites found
            </div>
          )}
          {!loading && !error && filteredSites.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">City</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Site Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">W x L (ft)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Area (sqft)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Facing</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">₹ Potential (L)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Occupancy</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSites.map((site) => (
                    <tr key={site.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{site.city}</td>
                      <td className="px-4 py-3 text-gray-700">{site.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {site.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {site.width} x {site.length}
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        {site.total_area || (site.width * site.length) || 0}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{site.facing || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${(site.status || "").toLowerCase() === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                          }`}>
                          {site.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">₹{(site.potential || 0).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${site.occupancy || 0}%` }}
                            />
                          </div>
                          <span className="text-gray-600">{site.occupancy || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(site)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(site.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Add Site modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Add New Site</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-800 text-xl">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Site Name
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Central Mall LED"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  City
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Mumbai"
                    required
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Type
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Billboard</option>
                    <option>LED</option>
                    <option>Hoarding</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Width (ft)
                  <input
                    type="number"
                    value={form.width}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      setForm({ ...form, width: w, totalArea: w * (form.length || 0) });
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Width"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Length (ft)
                  <input
                    type="number"
                    value={form.length}
                    onChange={(e) => {
                      const l = Number(e.target.value);
                      setForm({ ...form, length: l, totalArea: (form.width || 0) * l });
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Length"
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Total Area</span>
                  <div className="text-2xl font-bold text-blue-700">{form.totalArea} sqft</div>
                </div>
                <label className="text-sm font-medium text-gray-700">
                  Facing
                  <input
                    value={form.facing}
                    onChange={(e) => setForm({ ...form, facing: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., East"
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Monthly Potential (₹ L)
                  <input
                    type="number"
                    step="0.1"
                    value={form.potentialMonthly}
                    onChange={(e) => setForm({ ...form, potentialMonthly: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Site Photo (optional)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                      {form.imageUrl ? (
                        <img src={form.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e)}
                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {uploading && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
                    </div>
                  </div>
                </div>
              </div>

              <label className="text-sm font-medium text-gray-700 block">
                Owner (Media Owner)
                <select
                  value={form.ownerCompanyId}
                  onChange={(e) => setForm({ ...form, ownerCompanyId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {owners.map((o) => (
                    <option key={`${o.companyId}-${o.gstId}`} value={o.companyId}>
                      {o.companyName} ({o.gstNumber})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )
      }

      {/* Edit Site Modal */}
      {showEdit && editSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Edit Site</h3>
              <button onClick={() => { setShowEdit(false); setEditSite(null); }} className="text-gray-500 hover:text-gray-800 text-xl">
                ×
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Site Name
                  <input
                    value={editSite.name}
                    onChange={(e) => setEditSite({ ...editSite, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Central Mall LED"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  City
                  <input
                    value={editSite.city}
                    onChange={(e) => setEditSite({ ...editSite, city: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Mumbai"
                    required
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Type
                  <select
                    value={editSite.type}
                    onChange={(e) => setEditSite({ ...editSite, type: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Billboard</option>
                    <option>LED</option>
                    <option>Hoarding</option>
                    <option>Unipole</option>
                    <option>Digital Screen</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Status
                  <select
                    value={editSite.status}
                    onChange={(e) => setEditSite({ ...editSite, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Maintenance</option>
                  </select>
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Width (ft)
                  <input
                    type="number"
                    value={editSite.width}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      setEditSite({ ...editSite, width: w, totalArea: w * (editSite.length || 0) });
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Length (ft)
                  <input
                    type="number"
                    value={editSite.length}
                    onChange={(e) => {
                      const l = Number(e.target.value);
                      setEditSite({ ...editSite, length: l, totalArea: (editSite.width || 0) * l });
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Total Area</span>
                  <div className="text-2xl font-bold text-blue-700">{editSite.totalArea} sqft</div>
                </div>
                <label className="text-sm font-medium text-gray-700">
                  Facing
                  <input
                    value={editSite.facing}
                    onChange={(e) => setEditSite({ ...editSite, facing: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., East"
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Monthly Potential (₹ L)
                  <input
                    type="number"
                    step="0.1"
                    value={editSite.potentialMonthly}
                    onChange={(e) => setEditSite({ ...editSite, potentialMonthly: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 2.5"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Occupancy (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editSite.occupancy}
                    onChange={(e) => setEditSite({ ...editSite, occupancy: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 75"
                  />
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Site Photo
                </label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    {editSite.imageUrl ? (
                      <img src={editSite.imageUrl} alt="Site" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, true)}
                      className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {uploading && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEdit(false); setEditSite(null); }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Update Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}





