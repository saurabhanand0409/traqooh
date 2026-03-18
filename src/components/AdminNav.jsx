import React from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/inventory", label: "Inventory", icon: "🏗️" },
  { path: "/vendors", label: "Vendors", icon: "🏢" },
  { path: "/advertisers", label: "Advertisers", icon: "📢" },
  { path: "/campaigns", label: "Campaigns", icon: "🎯" },
];

export default function AdminNav({ user }) {
  const location = useLocation();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              active
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
