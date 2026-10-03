import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Layers, Target, Users } from "lucide-react";

export default function EmployeeNav() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard/employee", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "My Inventory", path: "/inventory", icon: <Layers className="w-4 h-4" /> },
    { label: "Campaign Requests", path: "/campaigns", icon: <Target className="w-4 h-4" /> },
    { label: "Collaborate", path: "/collaborate", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-16 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center gap-6 overflow-x-auto hide-scrollbar whitespace-nowrap">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === "/dashboard/employee" && location.pathname === "/dashboard");
            
            return (
              <li key={item.label}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-2 py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors
                    ${isActive 
                      ? "border-blue-600 text-blue-700" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                    }`}
                >
                  <span className={isActive ? "text-blue-600" : "text-gray-400"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
}
