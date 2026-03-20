import React from "react";
import { Link } from "react-router-dom";
import LoginForm from "../components/LoginForm";

export default function AdminLogin() {
  return (
    <LoginForm
      title="Admin Login"
      subtitle="Sign in to the admin control panel"
      accentColor="bg-[#7c3aed]"
      hoverColor="hover:bg-[#6d28d9]"
      shadowColor="shadow-[#7c3aed55]"
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      iconSvg={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.1 22 12 17.7 5.9 22l2.3-8.1L2 9.4h7.6z" stroke="white" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
        </svg>
      }
      bottomLinks={
        <>
          <div className="mt-4">
            <Link to="/" className="text-white/70 hover:text-white text-sm">← Back to Home</Link>
          </div>
          <div className="mt-3">
            <Link to="/employeelogin" className="text-white/50 hover:text-white/80 text-xs">Employee? Login here</Link>
          </div>
        </>
      }
    />
  );
}
