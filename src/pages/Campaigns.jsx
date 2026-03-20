import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmployeeNav from "../components/EmployeeNav";
import UserMenu from "../components/UserMenu";
import { Target, Search, Plus, Calendar, IndianRupee, MapPin } from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function Campaigns() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  
  const [form, setForm] = useState({ 
    name:"", advertiserId:"", internalOwner:"", campaignType:"", 
    startDate:"", endDate:"", totalCost:0, status:"DRAFT", notes:"", billingRemarks:"" 
  });

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
    setForm({ 
      name:c.name, advertiserId:String(c.advertiserId), internalOwner:c.internalOwner||"", 
      campaignType:c.campaignType||"", startDate:c.startDate||"", endDate:c.endDate||"", 
      totalCost:c.totalCost||0, status:c.status, notes:c.notes||"", billingRemarks:c.billingRemarks||"" 
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      name:"", advertiserId:params.get("advertiserId")||"", internalOwner:"", campaignType:"", 
      startDate:"", endDate:"", totalCost:0, status:"DRAFT", notes:"", billingRemarks:"" 
    });
    setShowModal(true);
  };

  const statusColors = { 
    DRAFT: "bg-gray-100 text-gray-700 border-gray-200", 
    PLANNED: "bg-blue-50 text-blue-700 border-blue-200", 
    LIVE: "bg-green-50 text-green-700 border-green-200", 
    COMPLETED: "bg-purple-50 text-purple-700 border-purple-200", 
    CANCELLED: "bg-red-50 text-red-700 border-red-200" 
  };

  const filtered = list.filter(c => {
    const sMatch = !statusFilter || c.status === statusFilter;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.advertiserName || "").toLowerCase().includes(search.toLowerCase());
    return sMatch && searchMatch;
  });

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#0f172a] font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 h-16">
        <div className="mx-auto max-w-7xl px-5 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 text-white grid place-items-center">
              <span className="font-bold text-xl leading-none">t</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-900 tracking-tight">traqOOH</span>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Shared Dashboard Tabs */}
      <EmployeeNav />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Campaign Requests</h1>
            <p className="text-gray-500 mt-1 font-medium">Create, manage, and track advertising campaigns.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition">
            <Plus className="w-5 h-5"/> New Campaign
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full">
            <Search className="w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search campaigns or advertisers..." className="w-full bg-transparent border-none outline-none text-sm font-medium" />
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            {["", "DRAFT", "PLANNED", "LIVE", "COMPLETED", "CANCELLED"].map(s => (
              <button 
                key={s} 
                onClick={() => setStatusFilter(s)} 
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase transition ${
                  statusFilter === s 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30" 
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500 animate-pulse">
            <Target className="w-10 h-10 mb-3 text-gray-300" />
            <p className="font-semibold text-sm uppercase tracking-wider">Loading Campaigns...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 hover:shadow-lg hover:border-blue-100 transition-all group flex flex-col justify-between cursor-pointer" onClick={() => openEdit(c)}>
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-xl text-gray-900 leading-tight group-hover:text-blue-700 transition">{c.name}</h3>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest border ${statusColors[c.status] || statusColors.DRAFT}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-600 mb-4">{c.advertiserName || "Unknown Advertiser"} • <span className="text-gray-400 font-medium">{c.campaignType || "Standard"}</span></div>
                  
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500"/>{c.startDate || "TBD"} &rarr; {c.endDate || "TBD"}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-500"/>{c.siteCount} Site{c.siteCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Booking Value</div>
                    <div className="text-lg font-bold text-gray-900">₹{Number(c.totalCost || 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-blue-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition bg-blue-50 px-3 py-1.5 rounded-lg">Edit Details &rarr;</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-1 lg:col-span-2 py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-white text-center">
                <Target className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">No campaigns found</h3>
                <p className="text-gray-500 mt-1 max-w-sm">You haven't created any campaigns matching this criteria yet. Click "New Campaign" to create one.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit/Create Modal - Enhanced */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50 font-sans">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2"><Target className="w-5 h-5 text-blue-600"/> {editing ? "Edit Campaign" : "New Campaign"}</h2>
              <button type="button" onClick={() => {setShowModal(false); setEditing(null)}} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm border border-gray-200 transition text-gray-500">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Name *</label>
                  <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="e.g. Summer Mega Sale" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Advertiser *</label>
                  <select value={form.advertiserId} onChange={e=>setForm({...form,advertiserId:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer" required>
                    <option value="">Select advertiser...</option>
                    {advertisers.map(a=><option key={a.id} value={a.id}>{a.companyName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">End Date</label>
                  <input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Total Cost (₹)</label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" value={form.totalCost} onChange={e=>setForm({...form,totalCost:e.target.value})} className="w-full border-gray-300 rounded-xl pl-10 pr-4 py-3 bg-gray-50 focus:bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                    {["DRAFT","PLANNED","LIVE","COMPLETED","CANCELLED"].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Type</label>
                <input value={form.campaignType} onChange={e=>setForm({...form,campaignType:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="e.g. Billboard, Digital, Print" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notes & Remarks</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" rows={3} placeholder="Add any details or instructions here..." />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button type="button" onClick={()=>{setShowModal(false);setEditing(null)}} className="flex-1 px-5 py-3 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition shadow-sm">Cancel</button>
              <button type="submit" className="flex-1 px-5 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transition shadow-blue-600/30">{editing ? "Update Campaign" : "Create Campaign"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
