import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "";

export default function AccessView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`${API}/api/access/${token}`);
        if (!res.ok) { const d = await res.json(); setError(d.detail || "Invalid or expired link"); return; }
        setData(await res.json());
      } catch { setError("Failed to load. The link may be expired."); }
      finally { setLoading(false); }
    };
    validate();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-400 text-lg">Verifying access...</div></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><div className="text-5xl mb-4">🔒</div><h1 className="text-2xl font-bold text-gray-700">Access Denied</h1><p className="text-gray-500 mt-2">{error}</p></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-700">traqOOH</span>
          <span className="text-sm text-gray-500">Campaign Access — {data.advertiser}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Your Campaigns</h1>
        <p className="text-gray-500">Welcome, {data.advertiser}. Here are your campaign details.</p>

        {data.campaigns?.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{c.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.status==="LIVE"?"bg-green-100 text-green-700":"bg-blue-100 text-blue-700"}`}>{c.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Start Date</div><div className="font-semibold">{c.startDate||"—"}</div></div>
              <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">End Date</div><div className="font-semibold">{c.endDate||"—"}</div></div>
            </div>

            {c.sites?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Media Sites ({c.sites.length})</h3>
                <div className="space-y-2">
                  {c.sites.map((s,j) => (
                    <div key={j} className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
                      <span>{s.bookedFrom} → {s.bookedTill}</span>
                      <span className="text-gray-500">₹{Number(s.agreedCost||0).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {c.audits?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Proof of Display</h3>
                <div className="space-y-2">
                  {c.audits.map((au,j) => (
                    <div key={j} className="bg-gray-50 rounded-lg p-3">
                      <span className="text-sm font-medium">{au.type} Audit — {au.date}</span>
                      {au.images && <div className="mt-2 flex gap-2 flex-wrap">{JSON.parse(au.images||"[]").map((img,k)=><img key={k} src={img} alt="audit" className="h-20 rounded-lg object-cover" />)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {(!data.campaigns || data.campaigns.length === 0) && <p className="text-center py-12 text-gray-400">No campaigns found for your account.</p>}
      </main>
      <footer className="text-center py-6 text-xs text-gray-400">Powered by traqOOH • {new Date().getFullYear()}</footer>
    </div>
  );
}
