import React from "react";
import { Link } from "react-router-dom";
import LoginForm from "../components/LoginForm";

export default function EmployeeLogin() {
  return (
    <LoginForm
      title="Employee Login"
      subtitle="Sign in to your employee account"
      accentColor="bg-[#2f6bff]"
      hoverColor="hover:bg-[#2759d6]"
      shadowColor="shadow-[#2f6bff55]"
      allowedRoles={["EMPLOYEE", "MEDIA_OWNER", "TEAM_MEMBER"]}
      iconSvg={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.6" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      }
      bottomLinks={
        <div className="mt-4">
          <Link to="/" className="text-white/70 hover:text-white text-sm">← Back to Home</Link>
        </div>
      }
    />
  );
}
