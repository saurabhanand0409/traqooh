import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import UserMenu from "../components/UserMenu";

const API = import.meta.env.VITE_API_BASE || "";

export default function Advertisers() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedAdv, setSelectedAdv] = useState(null);
  const [form, setForm] = useState({ companyName:"", contactPerson:"", email:"", phone:"", billingAddress:"", gstNumber:"", notes:"", status:"ACTIVE" });
  const [loginForm, setLoginForm] = useState({ email:"", password:"", displayName:"" });
  const [linkResult, setLinkResult] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/advertisers`);
    if (res.ok) setList(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `${API}/api/advertisers/${editing.id}` : `${API}/api/advertisers`;
    const res = await fetch(url, { method: editing?"PUT":"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setEditing(null); fetchList(); }
  };

  const handleCreateLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/advertisers/create-login`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ advertiserId: selectedAdv.id, ...loginForm }),
    });
    if (res.ok) { alert("Advertiser login created!"); setShowLoginModal(false); }
    else { const d = await res.json(); alert(d.detail || "Error"); }
  };

  const handleSendLink = async () => {
    const res = await fetch(`${API}/api/advertisers/send-access-link`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ advertiserId: selectedAdv.id, expiryDays: 7 }),
    });
    if (res.ok) { setLinkResult(await res.json()); }
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ companyName:a.companyName, contactPerson:a.contactPerson||"", email:a.email||"", phone:a.phone||"", billingAddress:a.billingAddress||"", gstNumber:a.gstNumber||"", notes:a.notes||"", status:a.status||"ACTIVE" });
    setShowModal(true);
  };

  const openCreate = () => { setEditing(null); setForm({ companyName:"", contactPerson:"", email:"", phone:"", billingAddress:"", gstNumber:"", notes:"", status:"ACTIVE" }); setShowModal(true); };

  const filtered = list.filter(a => a.companyName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-blue-700">traqOOH</Link>
          <AdminNav user={user} />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Advertisers</h1><p className="text-gray-500 mt-1">Manage advertiser/client accounts</p></div>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ Add Advertiser</button>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border px-4 py-2 shadow-sm">
          <span>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search advertisers..." className="flex-1 outline-none text-sm" />
        </div>
        {loading ? <p className="text-center py-8 text-gray-400">Loading...</p> : (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.companyName}</td>
                    <td className="px-4 py-3 text-gray-500">{a.contactPerson||"—"}</td>
                    <td className="px-4 py-3 text-gray-500">{a.email||"—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-gray-200 text-gray-600"}`}>{a.status}</span></td>
                    <td className="px-4 py-3 flex gap-2 flex-wrap">
                      <button onClick={()=>openEdit(a)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={()=>{setSelectedAdv(a);setLoginForm({email:a.email||"",password:"",displayName:a.contactPerson||""});setShowLoginModal(true)}} className="text-green-600 hover:underline text-xs">Create Login</button>
                      <button onClick={()=>{setSelectedAdv(a);setLinkResult(null);setShowLinkModal(true)}} className="text-purple-600 hover:underline text-xs">Send Link</button>
                      <Link to={`/campaigns?advertiserId=${a.id}`} className="text-gray-500 hover:underline text-xs">Campaigns →</Link>
                    </td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No advertisers found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">{editing?"Edit Advertiser":"Add Advertiser"}</h2>
            {[["companyName","Company Name *"],["contactPerson","Contact Person"],["email","Email"],["phone","Phone"],["billingAddress","Billing Address"],["gstNumber","GST Number"]].map(([k,l])=>(
              <div key={k}><label className="text-xs font-medium text-gray-500 block mb-1">{l}</label><input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required={k==="companyName"} /></div>
            ))}
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">{editing?"Update":"Create"}</button>
              <button type="button" onClick={()=>{setShowModal(false);setEditing(null)}} className="flex-1 border py-2 rounded-lg font-semibold text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreateLogin} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Create Login for {selectedAdv?.companyName}</h2>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Email</label><input value={loginForm.email} onChange={e=>setLoginForm({...loginForm,email:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Password</label><input type="password" value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Display Name</label><input value={loginForm.displayName} onChange={e=>setLoginForm({...loginForm,displayName:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex gap-3"><button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold">Create Login</button><button type="button" onClick={()=>setShowLoginModal(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button></div>
          </form>
        </div>
      )}

      {/* Send Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Send Access Link — {selectedAdv?.companyName}</h2>
            {linkResult ? (
              <div className="space-y-3">
                <p className="text-green-600 font-medium">✅ Link generated!</p>
                <div className="bg-gray-50 p-3 rounded-lg text-xs font-mono break-all">{window.location.origin}{linkResult.accessUrl}</div>
                <p className="text-xs text-gray-500">Expires: {linkResult.expiresAt}</p>
                <button onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}${linkResult.accessUrl}`); alert("Copied!"); }} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">Copy Link</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">Generate a secure, time-limited access link for this advertiser. Link expires in 7 days.</p>
                <button onClick={handleSendLink} className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold">Generate Link</button>
              </div>
            )}
            <button onClick={()=>{setShowLinkModal(false);setLinkResult(null)}} className="w-full border py-2 rounded-lg text-gray-600">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
