import React from "react";
import { Link } from "react-router-dom";
import LoginForm from "../components/LoginForm";

export default function AdvertiserLogin() {
  return (
    <LoginForm
      title="Advertiser Login"
      subtitle="Sign in to view your campaigns and media"
      accentColor="bg-[#14b86e]"
      hoverColor="hover:bg-[#11965e]"
      shadowColor="shadow-[#14b86e55]"
      allowedRoles={["ADVERTISER"]}
      iconSvg={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="4" fill="white" />
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
