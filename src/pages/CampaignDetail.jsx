import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";
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

  // Execution Activities
  const [activities, setActivities] = useState([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ siteId:"", activityType:"PRINT", status:"DONE", performedBy:"", activityDate:"", notes:"" });
  const [activityFile, setActivityFile] = useState(null);
  const [savingActivity, setSavingActivity] = useState(false);

  const ACTIVITY_TYPES = ["PRINT","REPRINT","MOUNTING","AUDIT","MAINTENANCE","TAKEDOWN","START","END"];
  const ACTIVITY_ICONS = { PRINT:"🖨️", REPRINT:"♻️", MOUNTING:"🔧", AUDIT:"✅", MAINTENANCE:"🛠️", TAKEDOWN:"📦", START:"🚀", END:"🏁" };

  useEffect(() => { fetchCampaign(); fetchSites(); fetchActivities(); }, [id]);

  const fetchActivities = async () => {
    const res = await apiFetch(`/api/activities?campaignId=${id}`);
    if (res.ok) setActivities(await res.json());
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    setSavingActivity(true);
    try {
      const res = await apiFetch(`/api/activities`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          ...activityForm,
          campaignId:Number(id),
          siteId:Number(activityForm.siteId),
          createdByUserId: user.userId || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail||"Error logging activity"); return; }
      const created = await res.json();
      // upload photo if attached
      if (activityFile) {
        const fd = new FormData();
        fd.append("file", activityFile);
        await apiFetch(`/api/activities/${created.id}/upload-image`, { method:"POST", body: fd });
      }
      setShowActivity(false);
      setActivityFile(null);
      setActivityForm({ siteId:"", activityType:"PRINT", status:"DONE", performedBy:"", activityDate:"", notes:"" });
      fetchActivities();
    } finally { setSavingActivity(false); }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!confirm("Delete this activity?")) return;
    await apiFetch(`/api/activities/${activityId}`, { method:"DELETE" });
    fetchActivities();
  };

  const fetchCampaign = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/campaigns/${id}`);
    if (res.ok) setCampaign(await res.json());
    setLoading(false);
  };
  const fetchSites = async () => {
    const res = await apiFetch(`/api/sites?availabilityStatus=AVAILABLE`);
    if (res.ok) setSites(await res.json());
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/campaigns/${id}/assign-site`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...assignForm, siteId:Number(assignForm.siteId), agreedCost:Number(assignForm.agreedCost) }),
    });
    if (res.ok) { setShowAssign(false); fetchCampaign(); fetchSites(); }
    else { const d = await res.json(); alert(d.detail||"Error assigning site"); }
  };

  const handleRemoveSite = async (assignmentId) => {
    if (!confirm("Remove this site from campaign?")) return;
    await apiFetch(`/api/campaigns/${id}/remove-site/${assignmentId}`, { method:"DELETE" });
    fetchCampaign(); fetchSites();
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/audits`, {
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

        {/* Execution Activities */}
        <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Execution Activities ({activities.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Print · Reprint · Mounting · Audit · Maintenance · Take-down — with photos</p>
            </div>
            <button onClick={()=>{setActivityForm({siteId:campaign.assignments?.[0]?.siteId||"",activityType:"PRINT",status:"DONE",performedBy:user.displayName||"",activityDate:new Date().toISOString().slice(0,10),notes:""});setActivityFile(null);setShowActivity(true)}} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">+ Log Activity</button>
          </div>
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map(ac=>(
                <div key={ac.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{ACTIVITY_ICONS[ac.activityType]||"📌"}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{ac.activityType}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[ac.status]||"bg-gray-100 text-gray-600"}`}>{ac.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{ac.siteName||`Site #${ac.siteId}`} • {ac.activityDate||"—"} {ac.performedBy?`• ${ac.performedBy}`:""}</div>
                      {ac.notes && <div className="text-xs text-gray-400 truncate">{ac.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ac.imageUrls?.length > 0 && (
                      <div className="flex -space-x-2">
                        {ac.imageUrls.slice(0,3).map((u,i)=>(
                          <a key={i} href={u} target="_blank" rel="noopener">
                            <img src={u} alt="" className="w-9 h-9 rounded-lg object-cover border-2 border-white shadow" />
                          </a>
                        ))}
                        {ac.imageUrls.length > 3 && <span className="w-9 h-9 rounded-lg bg-gray-200 text-gray-500 text-xs flex items-center justify-center border-2 border-white">+{ac.imageUrls.length-3}</span>}
                      </div>
                    )}
                    {ac.source === "mobile" && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">📱 app</span>}
                    <button onClick={()=>handleDeleteActivity(ac.id)} className="text-red-400 text-xs hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm">No execution activities logged yet. Field staff can also log these via the TraqOOH mobile app.</p>}
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

      {/* Log Activity Modal */}
      {showActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreateActivity} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">Log Execution Activity</h2>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Site *</label>
              <select value={activityForm.siteId} onChange={e=>setActivityForm({...activityForm,siteId:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">Select site...</option>
                {(campaign.assignments||[]).map(a=><option key={a.siteId} value={a.siteId}>{a.siteName} ({a.siteCity})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Activity Type *</label>
                <select value={activityForm.activityType} onChange={e=>setActivityForm({...activityForm,activityType:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {ACTIVITY_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                <select value={activityForm.status} onChange={e=>setActivityForm({...activityForm,status:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {["PENDING","DONE","VERIFIED"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Date</label><input type="date" value={activityForm.activityDate} onChange={e=>setActivityForm({...activityForm,activityDate:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1">Performed By</label><input value={activityForm.performedBy} onChange={e=>setActivityForm({...activityForm,performedBy:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Staff name" /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Notes</label><textarea value={activityForm.notes} onChange={e=>setActivityForm({...activityForm,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="e.g. Flex mounted, photo attached for proof" /></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-1">Photo (proof)</label>
              <input type="file" accept="image/*" onChange={e=>setActivityFile(e.target.files?.[0]||null)} className="w-full text-sm" />
              {activityFile && <p className="text-xs text-green-600 mt-1">✓ {activityFile.name}</p>}
            </div>
            <div className="flex gap-3"><button type="submit" disabled={savingActivity} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50">{savingActivity?"Saving...":"Log Activity"}</button><button type="button" onClick={()=>setShowActivity(false)} className="flex-1 border py-2 rounded-lg text-gray-600">Cancel</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
