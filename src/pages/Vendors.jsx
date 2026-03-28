import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import UserMenu from "../components/UserMenu";

const API = import.meta.env.VITE_API_BASE || "";

export default function Vendors() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", contactPerson:"", phone:"", email:"", gstNumber:"", address:"", city:"", state:"", notes:"", status:"ACTIVE" });
  const [search, setSearch] = useState("");

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/vendors`);
    if (res.ok) setVendors(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `${API}/api/vendors/${editing.id}` : `${API}/api/vendors`;
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setEditing(null); fetchVendors(); }
  };

  const handleDelete = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    const res = await fetch(`${API}/api/vendors/${v.id}`, { method: "DELETE" });
    if (res.ok) fetchVendors();
    else alert("Failed to delete vendor");
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ name:v.name, contactPerson:v.contactPerson||"", phone:v.phone||"", email:v.email||"", gstNumber:v.gstNumber||"", address:v.address||"", city:v.city||"", state:v.state||"", notes:v.notes||"", status:v.status||"ACTIVE" });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name:"", contactPerson:"", phone:"", email:"", gstNumber:"", address:"", city:"", state:"", notes:"", status:"ACTIVE" });
    setShowModal(true);
  };

  const filtered = vendors.filter(v => v.name?.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-blue-700">traqOOH</Link>
          <AdminNav user={user} />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendors / Media Owners</h1>
            <p className="text-gray-500 mt-1">Manage all vendor/media owner companies</p>
          </div>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ Add Vendor</button>
        </div>

        <div className="flex items-center gap-3 bg-white rounded-xl border px-4 py-2 shadow-sm">
          <span>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendors..." className="flex-1 outline-none text-sm" />
        </div>

        {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3 text-center">Media Users</th>
                  <th className="px-4 py-3 text-center">Sites</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-gray-500">{v.contactPerson || "—"}<br/><span className="text-xs">{v.phone||""}</span></td>
                    <td className="px-4 py-3">{v.city || "—"}</td>
                    <td className="px-4 py-3 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">{v.mediaUserCount ?? 0}</span></td>
                    <td className="px-4 py-3 text-center"><span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">{v.siteCount ?? 0}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-gray-200 text-gray-600"}`}>{v.status}</span></td>
                    <td className="px-4 py-3 flex gap-3">
                      <button onClick={()=>openEdit(v)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={()=>handleDelete(v)} className="text-red-500 hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No vendors found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
            {[
              ["name","Company Name *"],["contactPerson","Contact Person"],["phone","Phone"],["email","Email"],
              ["gstNumber","GST Number"],["address","Address"],["city","City"],["state","State"]
            ].map(([k,l])=>(
              <div key={k}>
                <label className="text-xs font-medium text-gray-500 block mb-1">{l}</label>
                <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required={k==="name"} />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">{editing?"Update":"Create"}</button>
              <button type="button" onClick={()=>{setShowModal(false);setEditing(null)}} className="flex-1 border py-2 rounded-lg font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
