import React from "react";
import { Link } from "react-router-dom";

export default function GetStarted() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute w-[520px] h-[520px] -left-32 -top-20 rounded-full bg-[#0f2a7a] opacity-40 blur-[140px]" />
        <div className="absolute w-[520px] h-[520px] -right-24 top-10 rounded-full bg-[#2b0c8f] opacity-40 blur-[140px]" />
      </div>

      <div className="relative max-w-6xl mx-auto text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-white/10 grid place-items-center border border-white/15">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.6" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" />
            <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Welcome to traqOOH Marketplace</h1>
        <p className="text-lg text-white/85">Choose your account type to get started</p>
      </div>

      <div className="relative mt-12 max-w-5xl mx-auto grid gap-8 md:grid-cols-2">
        {/* Media Owner */}
        <div className="rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:scale-[1.04] hover:-translate-y-2 hover:shadow-[0_30px_100px_rgba(47,107,255,0.35)] hover:border-white/25 cursor-pointer flex flex-col items-center text-center min-h-[420px]">
          {/* Icon centered at top */}
          <div className="h-16 w-16 rounded-2xl bg-[#2f6bff] grid place-items-center shadow-lg shadow-[#2f6bff55] mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              {/* Billboard rectangle at top */}
              <rect x="4" y="3" width="16" height="10" rx="1.5" stroke="white" strokeWidth="1.5" />
              {/* Pole */}
              <line x1="12" y1="13" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
              {/* Base */}
              <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold mb-4">Media Owner</h3>

          {/* Description */}
          <p className="text-white/85 leading-relaxed mb-6">
            List your advertising inventory, manage bookings, and maximize revenue from your media assets.
          </p>

          {/* Features list */}
          <ul className="space-y-3 text-white text-sm font-medium mb-8 flex-grow text-left w-full">
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Inventory Management</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Campaign Bookings &amp; Cost Sheets</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Geo-tagged Proof from the Field App</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Proof Reports for Advertisers</li>
          </ul>

          {/* CTA Button */}
          <Link
            to="/media-owner"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
          >
            Continue as Media Owner
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Advertiser */}
        <div className="rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:scale-[1.04] hover:-translate-y-2 hover:shadow-[0_30px_100px_rgba(20,184,110,0.35)] hover:border-white/25 cursor-pointer flex flex-col items-center text-center min-h-[420px]">
          {/* Icon centered at top */}
          <div className="h-16 w-16 rounded-2xl bg-[#14b86e] grid place-items-center shadow-lg shadow-[#14b86e55] mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="5.5" stroke="white" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2" fill="white" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold mb-4">Advertiser</h3>

          {/* Description */}
          <p className="text-white/85 leading-relaxed mb-6">
            Discover premium locations, create powerful campaigns, and track your advertising performance.
          </p>

          {/* Features list */}
          <ul className="space-y-3 text-white text-sm font-medium mb-8 flex-grow text-left w-full">
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Browse &amp; Shortlist Sites</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Live Proof Photos with GPS</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Cost Sheet Downloads</li>
            <li className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#5ad4ff] flex-shrink-0" />Campaign Status at a Glance</li>
          </ul>

          {/* CTA Button */}
          <Link
            to="/advertiser"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
          >
            Continue as Advertiser
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto mt-10 text-center">
        <Link to="/" className="text-white/80 hover:text-white text-sm font-medium">
          ← Back to Homepage
        </Link>
      </div>

    </main>
  );
}
