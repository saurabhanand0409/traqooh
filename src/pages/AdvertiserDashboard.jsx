import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { signOut } from "../utils/auth";

const STATUS_STYLE = {
  RUNNING:   { label: "Live",      cls: "badge-live" },
  LIVE:      { label: "Live",      cls: "badge-live" },
  FINALIZED: { label: "Confirmed", cls: "badge-confirmed" },
  PLANNED:   { label: "Planned",   cls: "badge-planned" },
  DRAFT:     { label: "Draft",     cls: "badge-draft" },
  COMPLETE:  { label: "Completed", cls: "badge-sent" },
  COMPLETED: { label: "Completed", cls: "badge-sent" },
  PAUSED:    { label: "Paused",    cls: "badge-draft" },
  CANCELLED: { label: "Cancelled", cls: "badge-draft" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtCurrency(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function KPI({ label, value, sub, color }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{label}</span>
      <span className="font-syne font-bold text-2xl" style={{ color: color || "#fff" }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: "var(--gray2)" }}>{sub}</span>}
    </div>
  );
}

function ProgressBar({ pct, status }) {
  const color = status === "LIVE" ? "#22C55E" : status === "COMPLETED" ? "#3B82F6" : "var(--gray2)";
  return (
    <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(url || "");

function ProofModal({ proof, onClose }) {
  if (!proof) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Close
        </button>
        {isVideoUrl(proof.url)
          ? <video src={proof.url} controls autoPlay playsInline className="w-full rounded-2xl max-h-[75vh] bg-black" />
          : <img src={proof.url} alt={proof.type} className="w-full rounded-2xl object-contain max-h-[75vh]" />}
        <div className="mt-3 flex items-center gap-3 text-sm" style={{ color: "var(--gray)" }}>
          <span className="px-2 py-0.5 rounded-full badge-planned text-xs">{proof.type}</span>
          <span>{fmtDate(proof.date)}</span>
          {proof.notes && <span className="truncate">— {proof.notes}</span>}
          {proof.lat && proof.lng && (
            <a
              href={`https://www.google.com/maps?q=${proof.lat},${proof.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="ml-auto text-xs hover:underline"
              style={{ color: "#60A5FA" }}
            >
              Map
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }) {
  const [open, setOpen] = useState(false);
  const [activeSite, setActiveSite] = useState(null);
  const [lightboxProof, setLightboxProof] = useState(null);

  const st = STATUS_STYLE[campaign.status] || { label: campaign.status, cls: "badge-draft" };

  const allProofs = campaign.sites.flatMap(s =>
    s.proofs.map(p => ({ ...p, siteName: s.name, siteCity: s.city }))
  );

  const visibleProofs = activeSite
    ? campaign.sites.find(s => s.siteId === activeSite)?.proofs || []
    : allProofs;

  return (
    <div className="glass rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Card header */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-syne font-bold text-white text-sm">{campaign.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs mb-3" style={{ color: "var(--gray)" }}>
            <span>{fmtDate(campaign.startDate)} → {fmtDate(campaign.endDate)}</span>
            <span>{campaign.siteCount} site{campaign.siteCount !== 1 ? "s" : ""}</span>
            <span>{fmtCurrency(campaign.totalCost)}</span>
            {campaign.proofCount > 0 && (
              <span style={{ color: "#A78BFA" }}>{campaign.proofCount} proof photo{campaign.proofCount !== 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="space-y-1">
            <ProgressBar pct={campaign.progress} status={campaign.status} />
            <div className="text-[10px]" style={{ color: "var(--gray2)" }}>
              {campaign.progress}% elapsed
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--gray2)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded section */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {campaign.sites.length === 0 ? (
            <p className="p-5 text-sm" style={{ color: "var(--gray2)" }}>No sites assigned yet.</p>
          ) : (
            <div className="p-5">
              {/* Site tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActiveSite(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!activeSite ? "text-white" : ""}`}
                  style={{
                    background: !activeSite ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                    border: !activeSite ? "1px solid rgba(37,99,235,0.3)" : "1px solid var(--border)",
                    color: !activeSite ? "#fff" : "var(--gray)",
                  }}
                >
                  All Sites ({campaign.siteCount})
                </button>
                {campaign.sites.map(s => (
                  <button
                    key={s.siteId}
                    onClick={() => setActiveSite(a => a === s.siteId ? null : s.siteId)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: activeSite === s.siteId ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                      border: activeSite === s.siteId ? "1px solid rgba(37,99,235,0.3)" : "1px solid var(--border)",
                      color: activeSite === s.siteId ? "#fff" : "var(--gray)",
                    }}
                  >
                    {s.name} · {s.city}
                  </button>
                ))}
              </div>

              {/* Site details row (when specific site selected) */}
              {activeSite && (() => {
                const s = campaign.sites.find(x => x.siteId === activeSite);
                return s ? (
                  <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-6 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    {s.imageUrl && (
                      <img src={s.imageUrl} alt={s.name} className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-white">{s.name}</span>
                      <span style={{ color: "var(--gray)" }}>{s.city}{s.state ? `, ${s.state}` : ""}</span>
                      {s.size && <span className="text-xs" style={{ color: "var(--gray2)" }}>{s.type} · {s.size}</span>}
                    </div>
                    <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--gray)" }}>
                      <span>Booked: {fmtDate(s.bookedFrom)} – {fmtDate(s.bookedTill)}</span>
                      <span className="font-semibold" style={{ color: "#34D399" }}>{fmtCurrency(s.agreedCost)}</span>
                    </div>
                    {s.latitude && s.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs self-start mt-1 hover:underline"
                        style={{ color: "#60A5FA" }}
                      >
                        View on Map
                      </a>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Proof photos grid */}
              {visibleProofs.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--gray2)" }}>
                    Proof of Execution ({visibleProofs.length} photo{visibleProofs.length !== 1 ? "s" : ""})
                  </p>
                  <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                    {visibleProofs.map((p, i) => (
                      <div
                        key={i}
                        className="relative group rounded-xl overflow-hidden cursor-pointer"
                        style={{ aspectRatio: "4/3", background: "rgba(255,255,255,0.05)" }}
                        onClick={() => setLightboxProof(p)}
                      >
                        {isVideoUrl(p.url) ? (
                          <>
                            <video src={p.url + "#t=0.1"} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                                <span style={{ color: "#fff", fontSize: 14, marginLeft: 2 }}>▶</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={p.url} alt={p.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.type === "Install" ? "bg-blue-500/80" : p.type === "Monitor" ? "bg-amber-500/80" : "bg-gray-500/80"} text-white`}>
                            {p.type}
                          </span>
                          <span className="text-[9px] text-white/70">{fmtDate(p.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs py-2" style={{ color: "var(--gray2)" }}>
                  No proof photos yet for {activeSite ? "this site" : "this campaign"}.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {lightboxProof && <ProofModal proof={lightboxProof} onClose={() => setLightboxProof(null)} />}
    </div>
  );
}

export default function AdvertiserDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("tq_user") || "{}"); }
    catch { return {}; }
  })();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/advertisers/me/dashboard");
      if (res.status === 401) { signOut(navigate); return; }
      if (!res.ok) throw new Error("Failed to load dashboard");
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!user.email || user.role !== "ADVERTISER") {
      navigate("/login");
      return;
    }
    fetchDashboard();
  }, []);

  const advertiser = data?.advertiser || {};
  const summary = data?.summary || {};
  const campaigns = data?.campaigns || [];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <header
        className="flex items-center gap-4 px-6"
        style={{ height: 64, background: "var(--nav)", borderBottom: "1px solid var(--border)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <div
            className="flex items-center justify-center rounded-xl font-syne font-black text-white text-xs"
            style={{ width: 36, height: 36, background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
          >tq</div>
          <span className="font-syne font-extrabold text-[0.95rem] hidden sm:block">
            <span style={{ color: "#2563EB" }}>traq</span><span style={{ color: "#DC143C" }}>OOH</span>
          </span>
        </div>

        <div className="flex-1" />

        {advertiser.companyName && (
          <span className="text-sm font-semibold text-white hidden sm:block">{advertiser.companyName}</span>
        )}

        <button
          onClick={() => signOut(navigate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-red-500/10"
          style={{ color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </header>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="font-syne font-bold text-xl text-white">
            {advertiser.companyName ? `${advertiser.companyName}'s Dashboard` : "Campaign Dashboard"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>
            Track your campaigns, sites, and proof of execution
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#2563EB", borderTopColor: "transparent" }} />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm mb-4" style={{ color: "#F87171" }}>{error}</p>
            <button onClick={fetchDashboard} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--blue)" }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <KPI label="Total Campaigns" value={summary.totalCampaigns ?? 0} />
              <KPI label="Live Now" value={summary.liveCampaigns ?? 0} color="#22C55E" sub={summary.liveCampaigns ? "active" : "none active"} />
              <KPI label="Sites Booked" value={summary.totalSites ?? 0} color="#60A5FA" />
              <KPI label="Total Spend" value={fmtCurrency(summary.totalSpend)} color="#A78BFA" sub={`${summary.totalProofs ?? 0} proofs`} />
            </div>

            {/* Campaign list */}
            {campaigns.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium text-white">No campaigns yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Your campaigns will appear here once created by your account manager.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--gray2)" }}>
                  {campaigns.length} Campaign{campaigns.length !== 1 ? "s" : ""}
                </p>
                {campaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
