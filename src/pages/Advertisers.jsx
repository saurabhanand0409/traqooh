import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const API = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const FL = ({ children }) => (
  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--gray2)" }}>{children}</label>
);
const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--gray2)" }}>{children}</th>
);
const trHover = {
  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
  onMouseLeave: e => e.currentTarget.style.background = "transparent",
};

const EMPTY_FORM = { companyName: "", contactPerson: "", email: "", phone: "", billingAddress: "", gstNumber: "", notes: "", status: "ACTIVE" };

export default function Advertisers() {
  const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState("account"); // "account" | "link"
  const [addForm, setAddForm] = useState({ companyName: "", email: "", password: "", displayName: "", contactPerson: "", phone: "" });
  const [addErr, setAddErr] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addSuccess, setAddSuccess] = useState(null); // { type, linkUrl? }

  // Edit modal (admin only)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // Login modal (admin only)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedAdv, setSelectedAdv] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "", displayName: "" });

  // Link modal (admin only)
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkResult, setLinkResult] = useState(null);

  const [search, setSearch] = useState("");
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/advertisers`);
    if (res.ok) setList(await res.json());
    setLoading(false);
  };

  // ── Add advertiser (two modes) ──────────────────────────────────────────────
  const openAdd = () => {
    setAddForm({ companyName: "", email: "", password: "", displayName: "", contactPerson: "", phone: "" });
    setAddErr("");
    setAddSuccess(null);
    setAddMode("account");
    setShowAddModal(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.email.trim()) return setAddErr("Email is required.");
    if (addMode === "account" && !addForm.password.trim()) return setAddErr("Password is required for account creation.");
    setAddErr("");
    setAddSaving(true);
    try {
      // Step 1: create the advertiser record
      const advRes = await apiFetch(`/api/advertisers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: addForm.companyName || addForm.email.split("@")[0],
          contactPerson: addForm.contactPerson || addForm.displayName || "",
          email: addForm.email,
          phone: addForm.phone || "",
        }),
      });
      if (!advRes.ok) {
        const d = await advRes.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to create advertiser");
      }
      const adv = await advRes.json();

      if (addMode === "account") {
        // Step 2a: create login
        const loginRes = await apiFetch(`/api/advertisers/create-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advertiserId: adv.id,
            email: addForm.email,
            password: addForm.password,
            displayName: addForm.displayName || addForm.companyName || addForm.email.split("@")[0],
          }),
        });
        if (!loginRes.ok) {
          const d = await loginRes.json().catch(() => ({}));
          throw new Error(d.detail || "Advertiser created but login setup failed");
        }
        setAddSuccess({ type: "account", email: addForm.email });
      } else {
        // Step 2b: generate access link
        const linkRes = await apiFetch(`/api/advertisers/send-access-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ advertiserId: adv.id, expiryDays: 7 }),
        });
        if (!linkRes.ok) {
          const d = await linkRes.json().catch(() => ({}));
          throw new Error(d.detail || "Advertiser created but link generation failed");
        }
        const linkData = await linkRes.json();
        setAddSuccess({ type: "link", linkUrl: `${window.location.origin}${linkData.accessUrl}`, expiresAt: linkData.expiresAt });
      }
      fetchList();
    } catch (err) {
      setAddErr(err.message);
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit (admin) ──────────────────────────────────────────────────────────
  const openEdit = (a) => {
    setEditing(a);
    setEditForm({ companyName: a.companyName, contactPerson: a.contactPerson || "", email: a.email || "", phone: a.phone || "", billingAddress: a.billingAddress || "", gstNumber: a.gstNumber || "", notes: a.notes || "", status: a.status || "ACTIVE" });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/advertisers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
    if (res.ok) { setShowEditModal(false); setEditing(null); fetchList(); }
  };

  // ── Create Login (admin) ──────────────────────────────────────────────────
  const handleCreateLogin = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/advertisers/create-login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advertiserId: selectedAdv.id, ...loginForm }),
    });
    if (res.ok) { fetchList(); setShowLoginModal(false); }
    else { const d = await res.json().catch(() => ({})); alert(d.detail || "Error"); }
  };

  // ── Send Link (admin) ─────────────────────────────────────────────────────
  const handleSendLink = async () => {
    const res = await apiFetch(`/api/advertisers/send-access-link`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advertiserId: selectedAdv.id, expiryDays: 7 }),
    });
    if (res.ok) setLinkResult(await res.json());
  };

  const filtered = list.filter(a => a.companyName?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell user={user}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-syne font-bold text-xl text-white">Advertisers</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--gray2)" }}>Manage advertiser and client accounts</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
          Add Advertiser
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
        <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" /></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: "#fff" }} />
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
                <TH>Email</TH>
                <TH>Contact</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                {isAdmin && <TH>Actions</TH>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }} {...trHover}>
                  <td className="px-4 py-3 font-medium text-white">{a.companyName}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--gray)" }}>{a.email || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--gray)" }}>{a.contactPerson || "—"}</td>
                  <td className="px-4 py-3">
                    {a.hasLogin ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold badge-planned">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Account
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold badge-sent">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Link Only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${a.status === "ACTIVE" ? "badge-live" : "badge-draft"}`}>{a.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(a)} className="text-xs font-medium" style={{ color: "#60A5FA" }} onMouseEnter={e => e.target.style.color = "#93C5FD"} onMouseLeave={e => e.target.style.color = "#60A5FA"}>Edit</button>
                        {!a.hasLogin && (
                          <button onClick={() => { setSelectedAdv(a); setLoginForm({ email: a.email || "", password: "", displayName: a.contactPerson || "" }); setShowLoginModal(true); }} className="text-xs font-medium" style={{ color: "#34D399" }} onMouseEnter={e => e.target.style.color = "#6EE7B7"} onMouseLeave={e => e.target.style.color = "#34D399"}>+ Login</button>
                        )}
                        <button onClick={() => { setSelectedAdv(a); setLinkResult(null); setShowLinkModal(true); }} className="text-xs font-medium" style={{ color: "#A78BFA" }} onMouseEnter={e => e.target.style.color = "#C4B5FD"} onMouseLeave={e => e.target.style.color = "#A78BFA"}>Link</button>
                        <Link to={`/campaigns?advertiserId=${a.id}`} className="text-xs font-medium" style={{ color: "var(--gray2)" }} onMouseEnter={e => e.target.style.color = "#fff"} onMouseLeave={e => e.target.style.color = "var(--gray2)"}>Campaigns →</Link>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-sm" style={{ color: "var(--gray2)" }}>No advertisers found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Advertiser Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl w-full max-w-md flex flex-col" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Add Advertiser</h2>
              <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>Email is required for all advertiser types.</p>
            </div>

            {addSuccess ? (
              /* ── Success state ── */
              <div className="px-6 py-6 flex flex-col gap-4">
                {addSuccess.type === "account" ? (
                  <>
                    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)" }}>
                      <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#60A5FA" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                      <div>
                        <p className="text-sm font-semibold text-white">TraqOOH account created</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>{addSuccess.email} can now log in via /login</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}>
                      <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#A78BFA" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                      <div>
                        <p className="text-sm font-semibold text-white">Access link generated</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--gray2)" }}>Share this link — expires {addSuccess.expiresAt?.split("T")[0]}</p>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 rounded-xl text-xs font-mono break-all" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--gray)" }}>
                      {addSuccess.linkUrl}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(addSuccess.linkUrl); }}
                      className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
                      style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}
                    >
                      Copy Link
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Form state ── */
              <form onSubmit={handleAdd}>
                {/* Mode tabs */}
                <div className="px-6 pt-5 pb-0 flex gap-2">
                  {[
                    { key: "account", label: "TraqOOH Account", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    { key: "link",    label: "Email / Link Only", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setAddMode(tab.key); setAddErr(""); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={addMode === tab.key
                        ? { background: tab.key === "account" ? "rgba(37,99,235,0.2)" : "rgba(124,58,237,0.2)", border: `1px solid ${tab.key === "account" ? "rgba(37,99,235,0.4)" : "rgba(124,58,237,0.4)"}`, color: tab.key === "account" ? "#60A5FA" : "#A78BFA" }
                        : { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--gray2)" }
                      }
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d={tab.icon} /></svg>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Mode description */}
                <div className="px-6 pt-3 pb-1">
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "var(--gray2)" }}>
                    {addMode === "account"
                      ? "Creates a TraqOOH login — advertiser can sign in at /login to view their campaigns."
                      : "No login needed — advertiser receives a secure link to view their campaigns."}
                  </p>
                </div>

                <div className="px-6 py-4 flex flex-col gap-4">
                  {/* Email — always required */}
                  <div>
                    <FL>Email *</FL>
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                      className="tq-input"
                      placeholder="advertiser@company.com"
                      required
                    />
                  </div>

                  {/* Company Name */}
                  <div>
                    <FL>Company / Brand Name</FL>
                    <input
                      value={addForm.companyName}
                      onChange={e => setAddForm({ ...addForm, companyName: e.target.value })}
                      className="tq-input"
                      placeholder="Defaults to email prefix if left blank"
                    />
                  </div>

                  {addMode === "account" ? (
                    <>
                      <div>
                        <FL>Display Name</FL>
                        <input
                          value={addForm.displayName}
                          onChange={e => setAddForm({ ...addForm, displayName: e.target.value })}
                          className="tq-input"
                          placeholder="Contact person's name"
                        />
                      </div>
                      <div>
                        <FL>Password *</FL>
                        <input
                          type="password"
                          value={addForm.password}
                          onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                          className="tq-input"
                          placeholder="Set a login password"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <FL>Contact Person</FL>
                      <input
                        value={addForm.contactPerson}
                        onChange={e => setAddForm({ ...addForm, contactPerson: e.target.value })}
                        className="tq-input"
                        placeholder="Name of the contact (optional)"
                      />
                    </div>
                  )}

                  {addErr && (
                    <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{addErr}</div>
                  )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <button
                    type="submit"
                    disabled={addSaving}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                    style={{ background: addMode === "account" ? "linear-gradient(135deg,#2563EB,#1d50c8)" : "linear-gradient(135deg,#7C3AED,#6D28D9)" }}
                  >
                    {addSaving ? "Creating…" : addMode === "account" ? "Create Account" : "Add & Generate Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Modal (admin) ──────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleEdit} className="rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Edit Advertiser</h2>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
              {[["companyName", "Company Name *"], ["contactPerson", "Contact Person"], ["email", "Email"], ["phone", "Phone"], ["billingAddress", "Billing Address"], ["gstNumber", "GST Number"]].map(([k, l]) => (
                <div key={k}><FL>{l}</FL><input value={editForm[k]} onChange={e => setEditForm({ ...editForm, [k]: e.target.value })} className="tq-input" required={k === "companyName"} /></div>
              ))}
              <div><FL>Notes</FL><textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="tq-input" rows={2} style={{ resize: "none" }} /></div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>Update</button>
              <button type="button" onClick={() => { setShowEditModal(false); setEditing(null); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Create Login Modal (admin, link-only advertisers) ────────────────── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleCreateLogin} className="rounded-2xl w-full max-w-md flex flex-col" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Create Login</h2>
              <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>{selectedAdv?.companyName}</p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div><FL>Email</FL><input value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} className="tq-input" required /></div>
              <div><FL>Password</FL><input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} className="tq-input" required /></div>
              <div><FL>Display Name</FL><input value={loginForm.displayName} onChange={e => setLoginForm({ ...loginForm, displayName: e.target.value })} className="tq-input" /></div>
            </div>
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>Create Login</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Access Link Modal (admin) ─────────────────────────────────────────── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl w-full max-w-md flex flex-col" style={{ background: "#0D1428", border: "1px solid var(--border)" }}>
            <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-syne font-bold text-lg text-white">Access Link</h2>
              <p className="text-xs mt-1" style={{ color: "var(--gray2)" }}>{selectedAdv?.companyName}</p>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {linkResult ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#34D399" }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                    Link generated successfully!
                  </div>
                  <div className="px-4 py-3 rounded-xl text-xs font-mono break-all" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--gray)" }}>
                    {window.location.origin}{linkResult.accessUrl}
                  </div>
                  <p className="text-xs" style={{ color: "var(--gray2)" }}>Expires: {linkResult.expiresAt}</p>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${linkResult.accessUrl}`); }} className="w-full py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#2563EB,#1d50c8)" }}>Copy Link</button>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--gray)" }}>Generate a secure, time-limited access link. Expires in 7 days.</p>
                  <button onClick={handleSendLink} className="w-full py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>Generate Link</button>
                </>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => { setShowLinkModal(false); setLinkResult(null); }} className="w-full py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)", border: "1px solid var(--border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
