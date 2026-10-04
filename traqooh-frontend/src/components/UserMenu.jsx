import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function UserMenu({ user }) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    const displayName = (user?.email && user.email.split("@")[0]) || "User";
    const displayLabel = user?.displayName || displayName;
    const roleMap = { ADMIN: "Admin", EMPLOYEE: "Employee", ADVERTISER: "Advertiser", "media-owner": "Employee", advertiser: "Advertiser" };
    const roleLabel = roleMap[user?.role] || "User";

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("tq_user");
        navigate("/");
    };

    return (
        <div className="relative" ref={menuRef}>
            <div className="flex items-center gap-3">
                {/* User Avatar and Info */}
                <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-blue-600 text-white grid place-items-center font-semibold">
                        {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="leading-4 hidden sm:block">
                        <div className="text-sm font-semibold text-gray-800">{displayName}</div>
                        <div className="text-xs text-gray-500">{roleLabel}</div>
                    </div>
                </div>

                {/* Three-dot Menu Button */}
                <button
                    onClick={() => setOpen(!open)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="User menu"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
                        <circle cx="12" cy="5" r="2" fill="currentColor" />
                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                        <circle cx="12" cy="19" r="2" fill="currentColor" />
                    </svg>
                </button>
            </div>

            {/* Dropdown Menu */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-lg py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-semibold text-gray-900">{displayName}</div>
                        <div className="text-sm text-gray-500">{user?.email}</div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        <button
                            onClick={() => {
                                setOpen(false);
                                navigate("/account");
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                            </svg>
                            Account Details
                        </button>

                        <button
                            onClick={() => {
                                setOpen(false);
                                navigate("/change-password");
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M8 11V7a4 4 0 118 0v4" />
                            </svg>
                            Change Password
                        </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 pt-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                <polyline points="16,17 21,12 16,7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
