import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

const blankGst = () => ({
  gstNumber: "",
  gstCertificateUrl: "",
  gstAddress: "",
  primaryEmail: "",
  primaryPhone: "",
  contacts: [{ name: "", email: "", phone: "" }],
});

export default function MediaOwnerCreate() {
  const navigate = useNavigate();
  const [company, setCompany] = useState({
    companyName: "",
    rocAttachmentUrl: "",
    companyAddress: "",
    directorName: "",
    directorPhone: "",
    accountPassword: "",
  });
  const [gsts, setGsts] = useState([blankGst()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateGst = (idx, updater) => {
    setGsts((prev) => prev.map((g, i) => (i === idx ? { ...g, ...updater } : g)));
  };

  const updateContact = (gstIdx, contactIdx, updater) => {
    setGsts((prev) =>
      prev.map((g, i) =>
        i === gstIdx
          ? {
            ...g,
            contacts: g.contacts.map((c, ci) => (ci === contactIdx ? { ...c, ...updater } : c)),
          }
          : g
      )
    );
  };

  const addGstRow = () => setGsts((prev) => [...prev, blankGst()]);
  const removeGstRow = (idx) => setGsts((prev) => prev.filter((_, i) => i !== idx));
  const addContactRow = (gstIdx) =>
    setGsts((prev) =>
      prev.map((g, i) => (i === gstIdx ? { ...g, contacts: [...g.contacts, { name: "", email: "", phone: "" }] } : g))
    );
  const removeContactRow = (gstIdx, contactIdx) =>
    setGsts((prev) =>
      prev.map((g, i) =>
        i === gstIdx
          ? { ...g, contacts: g.contacts.filter((_, ci) => ci !== contactIdx) }
          : g
      )
    );

  const validate = () => {
    if (!company.companyName.trim()) return "Company name is required.";
    if (!company.directorName.trim()) return "Director name is required.";
    if (!company.directorPhone.trim()) return "Director phone is required.";
    if (!company.accountPassword.trim()) return "Account password is required.";
    if (!gsts.length) return "At least one GST registration is required.";
    for (const g of gsts) {
      if (!g.gstNumber.trim()) return "GST number is required.";
      if (!g.gstAddress.trim()) return "GST address is required.";
      if (!g.primaryEmail.trim()) return "Primary email is required.";
      if (!g.contacts.length) return "At least one contact is required.";
      for (const c of g.contacts) {
        if (!c.name.trim()) return "Contact name is required.";
        if (!c.email.trim()) return "Contact email is required.";
      }
    }
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationErr = validate();
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      for (const gst of gsts) {
        const payload = {
          companyName: company.companyName,
          rocAttachmentUrl: company.rocAttachmentUrl,
          companyAddress: company.companyAddress,
          gstNumber: gst.gstNumber,
          gstCertificateUrl: gst.gstCertificateUrl,
          gstAddress: gst.gstAddress,
          directorName: company.directorName,
          directorPhone: company.directorPhone,
          primaryEmail: gst.primaryEmail,
          primaryPhone: gst.primaryPhone,
          accountPassword: company.accountPassword,
          role: "MEDIA_OWNER",
          contacts: gst.contacts,
        };
        const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
        const res = await fetch(`${cleanBase}/api/media-owners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Failed to create media owner");
        }
      }
      setMessage("Media Owner account created successfully.");
      setTimeout(() => navigate("/media-owner"), 1000);
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to create account. Please check your connection or CORS settings.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.35)] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">Create Media Owner Account</h1>
            <p className="text-white/80 mt-1">Add company and one or more GST registrations.</p>
          </div>
          <Link to="/media-owner" className="text-white/80 hover:text-white text-sm">
            ← Back to Login
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/15 border border-red-400/40 px-4 py-3 text-red-100 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl bg-green-500/15 border border-green-400/40 px-4 py-3 text-green-100 text-sm">
            {message}
          </div>
        )}

        <form className="space-y-8" onSubmit={submit}>
          {/* Company info */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Company Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold">
                Company Name *
                <input
                  value={company.companyName}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                  placeholder="Acme OOH Pvt Ltd"
                />
              </label>
              <label className="text-sm font-semibold">
                ROC Attachment URL
                <input
                  value={company.rocAttachmentUrl}
                  onChange={(e) => setCompany({ ...company, rocAttachmentUrl: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                  placeholder="https://files.example.com/roc.pdf"
                />
              </label>
              <label className="text-sm font-semibold">
                Director Name * (applies to all GSTs)
                <input
                  value={company.directorName}
                  onChange={(e) => setCompany({ ...company, directorName: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                  placeholder="Jane Doe"
                />
              </label>
              <label className="text-sm font-semibold">
                Director Phone * (applies to all GSTs)
                <input
                  value={company.directorPhone}
                  onChange={(e) => setCompany({ ...company, directorPhone: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                  placeholder="+91-9876543210"
                />
              </label>
              <label className="text-sm font-semibold">
                Account Password * (for login)
                <input
                  type="password"
                  value={company.accountPassword}
                  onChange={(e) => setCompany({ ...company, accountPassword: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                  placeholder="Set a password"
                />
              </label>
            </div>
            <label className="text-sm font-semibold">
              Company Address
              <textarea
                value={company.companyAddress}
                onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                placeholder="123 Main St, City, State"
                rows={2}
              />
            </label>
          </section>

          {/* GST blocks */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">GST Registrations</h2>
              <button
                type="button"
                onClick={addGstRow}
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/15"
              >
                + Add GST
              </button>
            </div>

            {gsts.map((gst, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">GST #{idx + 1}</h3>
                  {gsts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGstRow(idx)}
                      className="text-sm text-white/80 hover:text-white"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm font-semibold">
                    GST Number *
                    <input
                      value={gst.gstNumber}
                      onChange={(e) => updateGst(idx, { gstNumber: e.target.value })}
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    GST Certificate URL
                    <input
                      value={gst.gstCertificateUrl}
                      onChange={(e) => updateGst(idx, { gstCertificateUrl: e.target.value })}
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                      placeholder="https://files.example.com/gst.pdf"
                    />
                  </label>
                </div>
                <label className="text-sm font-semibold">
                  GST Address * (unique per GST)
                  <textarea
                    value={gst.gstAddress}
                    onChange={(e) => updateGst(idx, { gstAddress: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                    placeholder="Warehouse / registered address for this GST"
                    rows={2}
                  />
                </label>

                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm font-semibold">
                    Primary Email (unique) *
                    <input
                      value={gst.primaryEmail}
                      onChange={(e) => updateGst(idx, { primaryEmail: e.target.value })}
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                      placeholder="finance@company.com"
                      type="email"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Primary Phone
                    <input
                      value={gst.primaryPhone}
                      onChange={(e) => updateGst(idx, { primaryPhone: e.target.value })}
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                      placeholder="+91-9876500000"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Contacts (unique email per GST, at least 1)</h4>
                    <button
                      type="button"
                      onClick={() => addContactRow(idx)}
                      className="text-sm text-white/80 hover:text-white"
                    >
                      + Add Contact
                    </button>
                    {idx > 0 && gsts[idx - 1] && (
                      <button
                        type="button"
                        onClick={() => updateGst(idx, { contacts: gsts[idx - 1].contacts.map((c) => ({ ...c })) })}
                        className="text-sm text-white/80 hover:text-white ml-3"
                      >
                        Same as above
                      </button>
                    )}
                  </div>
                  {gst.contacts.map((c, ci) => (
                    <div key={ci} className="grid md:grid-cols-3 gap-3 items-start">
                      <label className="text-sm font-semibold w-full">
                        Name *
                        <input
                          value={c.name}
                          onChange={(e) => updateContact(idx, ci, { name: e.target.value })}
                          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                          placeholder="Ops Lead"
                        />
                      </label>
                      <label className="text-sm font-semibold w-full">
                        Email *
                        <input
                          value={c.email}
                          onChange={(e) => updateContact(idx, ci, { email: e.target.value })}
                          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                          placeholder="ops@company.com"
                          type="email"
                        />
                      </label>
                      <div className="w-full">
                        <label className="text-sm font-semibold block">
                          Phone
                          <input
                            value={c.phone}
                            onChange={(e) => updateContact(idx, ci, { phone: e.target.value })}
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-3 outline-none placeholder-white/70 focus:border-white/40"
                            placeholder="+91-9999999999"
                          />
                        </label>
                        {gst.contacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContactRow(idx, ci)}
                            className="mt-2 text-xs text-white/80 hover:text-white px-2 py-2 rounded-lg border border-white/20 bg-white/10"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <div className="flex items-center justify-end gap-3">
            <Link to="/media-owner" className="text-white/80 hover:text-white text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2f6bff] hover:bg-[#2759d6] px-6 py-3 font-semibold shadow-lg transition disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

