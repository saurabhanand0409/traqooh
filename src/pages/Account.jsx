import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "../components/UserMenu";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

// Fields that require addendum (cannot be directly edited - legal/compliance)
const ADDENDUM_FIELDS = ["companyName", "gstNumber", "rocAttachmentUrl", "gstCertificateUrl"];

export default function Account() {
    const navigate = useNavigate();
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("tq_user") || "{}");
        } catch {
            return {};
        }
    }, []);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [accountData, setAccountData] = useState(null);
    const [editData, setEditData] = useState(null);

    useEffect(() => {
        const fetchAccountData = async () => {
            try {
                setLoading(true);
                setError("");

                // Fetch media owner data by email
                const res = await fetch(`${API_BASE}/api/media-owners?email=${encodeURIComponent(user.email)}`);
                if (!res.ok) throw new Error("Failed to load account details");
                const data = await res.json();

                setAccountData(data);
                setEditData({
                    companyName: data.company?.name || "",
                    companyAddress: data.gstAddress || "",
                    rocAttachmentUrl: data.company?.rocAttachmentUrl || "",
                    directorName: data.directorName || "",
                    directorPhone: data.directorPhone || "",
                    gstNumber: data.gstNumber || "",
                    gstCertificateUrl: data.gstCertificateUrl || "",
                    gstAddress: data.gstAddress || "",
                    primaryEmail: data.primaryEmail || "",
                    primaryPhone: data.primaryPhone || "",
                });
            } catch (err) {
                setError(err.message || "Unable to load account details");
            } finally {
                setLoading(false);
            }
        };

        if (user.email) {
            fetchAccountData();
        } else {
            navigate("/get-started");
        }
    }, [user.email, navigate]);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError("");
            setSuccess("");

            // Only save editable fields (exclude addendum fields)
            const updatePayload = {
                directorName: editData.directorName,
                directorPhone: editData.directorPhone,
                gstAddress: editData.gstAddress,
                primaryPhone: editData.primaryPhone,
            };

            const res = await fetch(`${API_BASE}/api/media-owners/${accountData.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });

            if (!res.ok) throw new Error("Failed to update account");

            setSuccess("Account details updated successfully!");
            setEditMode(false);

            // Refresh data
            const refreshRes = await fetch(`${API_BASE}/api/media-owners?email=${encodeURIComponent(user.email)}`);
            if (refreshRes.ok) {
                setAccountData(await refreshRes.json());
            }
        } catch (err) {
            setError(err.message || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const isAddendumField = (fieldName) => ADDENDUM_FIELDS.includes(fieldName);

    const renderField = (label, fieldName, value, textarea = false) => {
        const isLocked = isAddendumField(fieldName);
        const displayValue = editMode && !isLocked ? editData[fieldName] : value;

        return (
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600">{label}</label>
                    {isLocked && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            Requires Addendum
                        </span>
                    )}
                </div>
                {editMode && !isLocked ? (
                    textarea ? (
                        <textarea
                            value={displayValue || ""}
                            onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                        />
                    ) : (
                        <input
                            type="text"
                            value={displayValue || ""}
                            onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    )
                ) : (
                    <div className={`text-gray-900 ${isLocked ? "bg-gray-50 px-3 py-2 rounded-lg border border-gray-200" : ""}`}>
                        {displayValue || <span className="text-gray-400 italic">Not provided</span>}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
                <div className="text-gray-600">Loading account details...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-[#0f172a]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-blue-600 text-white grid place-items-center">🏙️</div>
                        <span className="text-xl font-semibold text-[#0f172a]">OOH Marketplace</span>
                    </div>
                    <nav className="hidden lg:flex items-center gap-4 text-sm text-[#475569]">
                        <Link className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100" to="/dashboard">
                            📊 Dashboard
                        </Link>
                        <Link className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100" to="/inventory">
                            🗂️ My Inventory
                        </Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <button className="p-2 rounded-lg hover:bg-gray-100" title="Notifications">🔔</button>
                        <UserMenu user={user} />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-4xl px-5 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Account Details</h1>
                        <p className="text-gray-600 mt-1">View and manage your company information</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {editMode ? (
                            <>
                                <button
                                    onClick={() => setEditMode(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditMode(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit Details
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm">
                        {success}
                    </div>
                )}

                {/* Info Banner */}
                <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm flex items-start gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                        <strong>Note:</strong> Fields marked with <span className="text-amber-600 font-medium">"Requires Addendum"</span> are legal/compliance fields and can only be changed through a formal amendment process. Please contact support to request changes to these fields.
                    </div>
                </div>

                {/* Company Details */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
                    </div>
                    <div className="p-6 grid md:grid-cols-2 gap-6">
                        {renderField("Company Name", "companyName", accountData?.company?.name)}
                        {renderField("ROC Certificate", "rocAttachmentUrl", accountData?.company?.rocAttachmentUrl)}
                        {renderField("Director Name", "directorName", accountData?.directorName)}
                        {renderField("Director Phone", "directorPhone", accountData?.directorPhone)}
                    </div>
                </div>

                {/* GST Details */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-900">GST Registration</h2>
                    </div>
                    <div className="p-6 grid md:grid-cols-2 gap-6">
                        {renderField("GST Number", "gstNumber", accountData?.gstNumber)}
                        {renderField("GST Certificate", "gstCertificateUrl", accountData?.gstCertificateUrl)}
                        {renderField("GST Address", "gstAddress", accountData?.gstAddress, true)}
                    </div>
                </div>

                {/* Contact Details */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
                    </div>
                    <div className="p-6 grid md:grid-cols-2 gap-6">
                        {renderField("Primary Email", "primaryEmail", accountData?.primaryEmail)}
                        {renderField("Primary Phone", "primaryPhone", accountData?.primaryPhone)}
                    </div>
                </div>

                {/* Additional Contacts */}
                {accountData?.contacts && accountData.contacts.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900">Additional Contacts</h2>
                        </div>
                        <div className="p-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 font-medium text-gray-600">Name</th>
                                            <th className="text-left py-2 font-medium text-gray-600">Email</th>
                                            <th className="text-left py-2 font-medium text-gray-600">Phone</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accountData.contacts.map((contact, idx) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                                <td className="py-3">{contact.name || "-"}</td>
                                                <td className="py-3">{contact.email || "-"}</td>
                                                <td className="py-3">{contact.phone || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
