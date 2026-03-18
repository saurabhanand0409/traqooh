import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import UserMenu from "../components/UserMenu";

const API = import.meta.env.VITE_API_BASE || "";

export default function Campaigns() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ name:"", advertiserId:"", internalOwner:"", campaignType:"", startDate:"", endDate:"", totalCost:0, status:"DRAFT", notes:"", billingRemarks:"" });

  useEffect(() => {
    fetch(`${API}/api/advertisers`).then(r=>r.json()).then(setAdvertisers).catch(()=>{});
    fetchList();
  }, []);

  const fetchList = async () => {
    setLoading(true);
    let url = `${API}/api/campaigns`;
    const advId = params.get("advertiserId");
    if (advId) url += `?advertiserId=${advId}`;
    const res = await fetch(url);
    if (res.ok) setList(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `${API}/api/campaigns/${editing.id}` : `${API}/api/campaigns`;
    const payload = { ...form, advertiserId: Number(form.advertiserId), totalCost: Number(form.totalCost) };
    const res = await fetch(url, { method: editing?"PUT":"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    if (res.ok) { setShowModal(false); setEditing(null); fetchList(); }
    else { const d = await res.json(); alert(d.detail || "Error"); }
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name:c.name, advertiserId:String(c.advertiserId), internalOwner:c.internalOwner||"", campaignType:c.campaignType||"", startDate:c.startDate||"", endDate:c.endDate||"", totalCost:c.totalCost||0, status:c.status, notes:c.notes||"", billingRemarks:c.billingRemarks||"" });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name:"", advertiserId:params.get("advertiserId")||"", internalOwner:"", campaignType:"", startDate:"", endDate:"", totalCost:0, status:"DRAFT", notes:"", billingRemarks:"" });
    setShowModal(true);
  };

  const statusColors = { DRAFT:"bg-gray-200 text-gray-700", PLANNED:"bg-blue-100 text-blue-700", LIVE:"bg-green-100 text-green-700", COMPLETED:"bg-purple-100 text-purple-700", CANCELLED:"bg-red-100 text-red-700" };
  const filtered = statusFilter ? list.filter(c=>c.status===statusFilter) : list;

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
          <div><h1 className="text-3xl font-bold">Campaigns</h1><p className="text-gray-500 mt-1">Create, manage, and track campaigns</p></div>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ New Campaign</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["","DRAFT","PLANNED","LIVE","COMPLETED","CANCELLED"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusFilter===s?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-300"}`}>{s||"All"}</button>
          ))}
        </div>
        {loading ? <p className="text-center py-8 text-gray-400">Loading...</p> : (
          <div className="grid gap-4">
            {filtered.map(c => (
              <Link to={`/campaigns/${c.id}`} key={c.id} className="bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{c.name}</h3>
                  <p className="text-gray-500 text-sm">{c.advertiserName || "—"} • {c.campaignType || "General"}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.startDate || "—"} → {c.endDate || "—"}</p>
                </div>
                <div className="text-right space-y-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[c.status]||"bg-gray-200"}`}>{c.status}</span>
                  <p className="text-lg font-bold text-gray-700">₹{Number(c.totalCost||0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-400">{c.siteCount} site{c.siteCount!==1?"s":""}</p>
                </div>
              </Link>
            ))}
            {filtered.length===0 && <p className="text-center py-12 text-gray-400">No campaigns yet. Click "+ New Campaign" to start.</p>}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">{editing?"Edit Campaign":"New Campaign"}</h2>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Campaign Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Advertiser *</label>
              <select value={form.advertiserId} onChange={e=>setForm({...form,advertiserId:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">Select advertiser...</option>
                {advertisers.map(a=><option key={a.id} value={a.id}>{a.companyName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">End Date</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Total Cost (₹)</label><input type="number" value={form.totalCost} onChange={e=>setForm({...form,totalCost:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {["DRAFT","PLANNED","LIVE","COMPLETED","CANCELLED"].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Internal Owner</label><input value={form.internalOwner} onChange={e=>setForm({...form,internalOwner:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Campaign Type</label><input value={form.campaignType} onChange={e=>setForm({...form,campaignType:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Launch, Awareness, Festival" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">{editing?"Update":"Create"}</button>
              <button type="button" onClick={()=>{setShowModal(false);setEditing(null)}} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
