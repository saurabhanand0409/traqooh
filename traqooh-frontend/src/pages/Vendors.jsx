import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";
import AppShell from "../components/AppShell";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const FL = ({ children }) => (
  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>{children}</label>
);
const TH = ({ children, center }) => (
  <th className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${center ? "text-center" : "text-left"}`} style={{ color: "var(--gray2)" }}>{children}</th>
);
const trHover = {
  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
  onMouseLeave: e => e.currentTarget.style.background = "transparent",
};

export default function Vendors() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "", gstNumber: "", address: "", city: "", state: "", notes: "", status: "ACTIVE" });
  const [search, setSearch] = useState("");

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/vendors`);
    if (res.ok) setVendors(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `/api/vendors/${editing.id}` : "/api/vendors";
    const res = await apiFetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setEditing(null); fetchVendors(); }
  };

  const handleDelete = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/vendors/${v.id}`, { method: "DELETE" });
    if (res.ok) fetchVendors();
    else alert("Failed to delete vendor");
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ name: v.name, contactPerson: v.contactPerson || "", phone: v.phone || "", email: v.email || "", gstNumber: v.gstNumber || "", address: v.address || "", city: v.city || "", state: v.state || "", notes: v.notes || "", status: v.status || "ACTIVE" });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", contactPerson: "", phone: "", email: "", gstNumber: "", address: "", city: "", state: "", notes: "", status: "ACTIVE" });
    setShowModal(true);
  };

  const filtered = vendors.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell user={user}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-syne font-bold text-xl text-white">Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Manage media owner companies</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
          Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
        <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" /></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors by name or city..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#fff" }} />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--gray2)" }}>Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <TH>Company</TH>
                <TH>Contact</TH>
                <TH>City</TH>
                <TH center>Media Users</TH>
                <TH center>Sites</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                  <td className="px-4 py-3 font-medium text-white">{v.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--gray)" }}>
                    <div>{v.contactPerson || "—"}</div>
                    {v.phone && <div className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{v.phone}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{v.city || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold badge-planned">{v.mediaUserCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold badge-live">{v.siteCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${v.status === "ACTIVE" ? "badge-live" : "badge-draft"}`}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(v)} className="text-xs font-medium transition-colors" style={{ color: "#60A5FA" }} onMouseEnter={e => e.target.style.color = "#93C5FD"} onMouseLeave={e => e.target.style.color = "#60A5FA"}>Edit</button>
                      <button onClick={() => handleDelete(v)} className="text-xs font-medium transition-colors" style={{ color: "#F87171" }} onMouseEnter={e => e.target.style.color = "#FCA5A5"} onMouseLeave={e => e.target.style.color = "#F87171"}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>No vendors found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleSubmit} className="rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
              {[
                ["name", "Company Name *"], ["contactPerson", "Contact Person"], ["phone", "Phone"],
                ["email", "Email"], ["gstNumber", "GST Number"], ["address", "Address"],
                ["city", "City"], ["state", "State"]
              ].map(([k, l]) => (
                <div key={k}>
                  <FL>{l}</FL>
                  <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="tq-input" required={k === "name"} />
                </div>
              ))}
              <div>
                <FL>Notes</FL>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="tq-input" rows={2} style={{ resize: "none" }} />
              </div>
              <div>
                <FL>Status</FL>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="tq-input select">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>{editing ? "Update" : "Create"}</button>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
