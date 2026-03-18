import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import UserMenu from "../components/UserMenu";

const API = import.meta.env.VITE_API_BASE || "";

export default function CampaignDetail() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [assignForm, setAssignForm] = useState({ siteId:"", bookedFrom:"", bookedTill:"", agreedCost:0, notes:"" });
  const [auditForm, setAuditForm] = useState({ siteId:"", auditType:"START", scheduledDate:"", auditor:"", notes:"" });

  useEffect(() => { fetchCampaign(); fetchSites(); }, [id]);

  const fetchCampaign = async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/campaigns/${id}`);
    if (res.ok) setCampaign(await res.json());
    setLoading(false);
  };
  const fetchSites = async () => {
    const res = await fetch(`${API}/api/sites?availabilityStatus=AVAILABLE`);
    if (res.ok) setSites(await res.json());
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/campaigns/${id}/assign-site`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...assignForm, siteId:Number(assignForm.siteId), agreedCost:Number(assignForm.agreedCost) }),
    });
    if (res.ok) { setShowAssign(false); fetchCampaign(); fetchSites(); }
    else { const d = await res.json(); alert(d.detail||"Error assigning site"); }
  };

  const handleRemoveSite = async (assignmentId) => {
    if (!confirm("Remove this site from campaign?")) return;
    await fetch(`${API}/api/campaigns/${id}/remove-site/${assignmentId}`, { method:"DELETE" });
    fetchCampaign(); fetchSites();
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/audits`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...auditForm, campaignId:Number(id), siteId:Number(auditForm.siteId) }),
    });
    if (res.ok) { setShowAudit(false); fetchCampaign(); }
    else { const d = await res.json(); alert(d.detail||"Error"); }
  };

  const statusColors = { DRAFT:"bg-gray-200 text-gray-700", PLANNED:"bg-blue-100 text-blue-700", LIVE:"bg-green-100 text-green-700", COMPLETED:"bg-purple-100 text-purple-700", CANCELLED:"bg-red-100 text-red-700", PENDING:"bg-yellow-100 text-yellow-700", DONE:"bg-green-100 text-green-700", MISSED:"bg-red-100 text-red-700" };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!campaign) return <div className="min-h-screen flex items-center justify-center text-gray-400">Campaign not found</div>;

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
        <Link to="/campaigns" className="text-blue-600 text-sm hover:underline">← Back to Campaigns</Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-gray-500 mt-1">{campaign.advertiserName} • {campaign.campaignType||"General"}</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${statusColors[campaign.status]||""}`}>{campaign.status}</span>
        </div>

        {/* Campaign Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["Start",campaign.startDate||"—"],["End",campaign.endDate||"—"],["Cost",`₹${Number(campaign.totalCost||0).toLocaleString("en-IN")}`],["Owner",campaign.internalOwner||"—"]].map(([l,v])=>(
            <div key={l} className="bg-white rounded-xl border p-4 shadow-sm"><div className="text-xs text-gray-500">{l}</div><div className="text-lg font-semibold mt-1">{v}</div></div>
          ))}
        </div>

        {/* Assigned Sites */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Assigned Sites ({campaign.assignments?.length||0})</h2>
            <button onClick={()=>setShowAssign(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">+ Assign Site</button>
          </div>
          {campaign.assignments?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Site</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Dates</th><th className="px-3 py-2">Cost</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
              <tbody className="divide-y">
                {campaign.assignments.map(a=>(
                  <tr key={a.assignmentId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{a.siteName} <span className="text-xs text-gray-400">({a.siteCity})</span></td>
                    <td className="px-3 py-2 text-gray-500">{a.vendorName||"—"}</td>
                    <td className="px-3 py-2 text-xs">{a.bookedFrom||"—"} → {a.bookedTill||"—"}</td>
                    <td className="px-3 py-2 font-medium">₹{Number(a.agreedCost||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[a.status]||""}`}>{a.status}</span></td>
                    <td className="px-3 py-2"><button onClick={()=>handleRemoveSite(a.assignmentId)} className="text-red-500 text-xs hover:underline">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-400 text-sm">No sites assigned yet.</p>}
        </section>

        {/* Audits */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Audits ({campaign.audits?.length||0})</h2>
            <button onClick={()=>{setAuditForm({siteId:campaign.assignments?.[0]?.siteId||"",auditType:"START",scheduledDate:"",auditor:"",notes:""});setShowAudit(true)}} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">+ Create Audit</button>
          </div>
          {campaign.audits?.length > 0 ? (
            <div className="space-y-2">
              {campaign.audits.map(au=>(
                <div key={au.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div><span className={`px-2 py-0.5 rounded text-xs font-semibold mr-2 ${statusColors[au.status]||""}`}>{au.status}</span><span className="font-medium text-sm">{au.auditType} Audit</span><span className="text-xs text-gray-400 ml-2">Site #{au.siteId}</span></div>
                  <div className="text-xs text-gray-500">{au.scheduledDate||"—"} • {au.auditor||"Unassigned"}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm">No audits yet.</p>}
        </section>
      </main>

      {/* Assign Site Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAssign} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Assign Site to Campaign</h2>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Site *</label>
              <select value={assignForm.siteId} onChange={e=>setAssignForm({...assignForm,siteId:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">Select available site...</option>
                {sites.map(s=><option key={s.id} value={s.id}>{s.name} — {s.city} ({s.owner?.name||"No vendor"})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">From</label><input type="date" value={assignForm.bookedFrom} onChange={e=>setAssignForm({...assignForm,bookedFrom:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Till</label><input type="date" value={assignForm.bookedTill} onChange={e=>setAssignForm({...assignForm,bookedTill:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Agreed Cost (₹)</label><input type="number" value={assignForm.agreedCost} onChange={e=>setAssignForm({...assignForm,agreedCost:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex gap-3"><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold">Assign</button><button type="button" onClick={()=>setShowAssign(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button></div>
          </form>
        </div>
      )}

      {/* Create Audit Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreateAudit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Create Audit</h2>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Site</label>
              <select value={auditForm.siteId} onChange={e=>setAuditForm({...auditForm,siteId:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">Select site...</option>
                {(campaign.assignments||[]).map(a=><option key={a.siteId} value={a.siteId}>{a.siteName} ({a.siteCity})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                <select value={auditForm.auditType} onChange={e=>setAuditForm({...auditForm,auditType:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {["START","MID","END","EXTRA"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Scheduled Date</label><input type="date" value={auditForm.scheduledDate} onChange={e=>setAuditForm({...auditForm,scheduledDate:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Auditor</label><input value={auditForm.auditor} onChange={e=>setAuditForm({...auditForm,auditor:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Notes</label><textarea value={auditForm.notes} onChange={e=>setAuditForm({...auditForm,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
            <div className="flex gap-3"><button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold">Create Audit</button><button type="button" onClick={()=>setShowAudit(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
