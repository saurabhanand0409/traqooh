import React, { useState, useEffect } from "react";
import Chatbot from "./components/Chatbot";

const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";

export default function App() {
  const [showDemo, setShowDemo] = useState(false);
  const demoUrl = "https://www.youtube.com/embed/xvJNxZY4IrQ";

  // Wake up the backend (Render free tier sleeps after 15 mins)
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  return (
    <main className="bg-white text-[#111827]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white px-6 min-h-screen flex items-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute w-[540px] h-[540px] -left-32 -top-24 rounded-full bg-[#0f2a7a] opacity-40 blur-[140px]" />
          <div className="absolute w-[540px] h-[540px] -right-28 top-0 rounded-full bg-[#2b0c8f] opacity-40 blur-[140px]" />
        </div>

        <div className="relative max-w-4xl mx-auto w-full text-center space-y-8 py-20 md:py-28">
          {/* Icon */}
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 grid place-items-center border border-white/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">traqOOH</h1>
            <p className="text-xl md:text-2xl font-medium text-white/90">India's Premier Out-of-Home Advertising Platform</p>
          </div>

          {/* Description */}
          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/75 leading-relaxed">
            Connect media owners with advertisers. Discover premium locations, create powerful campaigns, and maximize your advertising ROI with our intelligent platform.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <a
              href="/get-started"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1f3c8f] px-7 py-3 text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              Get Started
              <span aria-hidden>→</span>
            </a>
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3 text-sm font-semibold hover:bg-white hover:text-[#1f3c8f] hover:border-white transition-all duration-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
              </svg>
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#f7f8fb] text-[#1f3c8f] py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "10,000+", label: "Media Sites" },
            { value: "500+", label: "Active Campaigns" },
            { value: "50+", label: "Cities Covered" },
            { value: "₹100Cr+", label: "Transactions" },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="text-4xl font-bold">{item.value}</div>
              <div className="text-base text-[#334155]">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features heading */}
      <section className="bg-white text-[#111827] py-14 px-6 text-center">
        <div className="max-w-5xl mx-auto space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            Powerful Features for Modern Advertising
          </h2>
          <p className="text-lg text-[#4b5563] leading-relaxed">
            Everything you need to plan, execute, and optimize your out-of-home advertising campaigns.
          </p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-white text-[#111827] pb-16 px-6">
        <div className="max-w-6xl mx-auto grid gap-12 md:grid-cols-2">
          {[
            {
              title: "Smart Location Discovery",
              desc: "Find premium advertising locations with advanced geo-filtering and real-time availability.",
              icon: (
                <svg className="h-8 w-8 text-[#2f6bff]" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s7-7.167 7-11.2A7 7 0 0 0 5 9.8C5 13.833 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              ),
              iconBg: "bg-[#e8f0ff]",
            },
            {
              title: "Campaign Management",
              desc: "Create, manage, and track your advertising campaigns with powerful analytics and insights.",
              icon: (
                <svg className="h-8 w-8 text-[#14b86e]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              ),
              iconBg: "bg-[#e7f7ef]",
            },
            {
              title: "Dynamic Pricing",
              desc: "Intelligent pricing engine with volume discounts, seasonal rates, and negotiation tools.",
              icon: (
                <svg className="h-8 w-8 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none">
                  <path d="M5 15l4-6 4 6 4-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ),
              iconBg: "bg-[#f2eaff]",
            },
            {
              title: "Secure Transactions",
              desc: "End-to-end encrypted transactions with automated invoicing and payment processing.",
              icon: (
                <svg className="h-8 w-8 text-[#f97316]" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9 9V7a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              ),
              iconBg: "bg-[#fff4e8]",
            },
          ].map((feat) => (
            <div key={feat.title} className="flex items-start gap-4">
              <div className={`h-14 w-14 rounded-2xl grid place-items-center ${feat.iconBg}`}>
                {feat.icon}
              </div>
              <div className="space-y-2 text-left">
                <h3 className="text-xl font-semibold">{feat.title}</h3>
                <p className="text-[#4b5563] leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f4f6fb] text-[#111827] py-16 px-6 text-center">
        <div className="max-w-5xl mx-auto space-y-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">How It Works</h2>
          <p className="text-lg text-[#4b5563]">
            Simple, streamlined process from discovery to campaign execution
          </p>
        </div>
        <div className="max-w-5xl mx-auto grid gap-10 md:gap-12 md:grid-cols-3 mt-12">
          {[
            {
              step: 1,
              title: "Discover & Filter",
              desc: "Browse thousands of premium media locations with advanced geo-filtering and real-time availability.",
              color: "bg-[#2f6bff]",
            },
            {
              step: 2,
              title: "Plan & Quote",
              desc: "Create campaigns, get instant quotes, and negotiate pricing with our intelligent pricing engine.",
              color: "bg-[#14b86e]",
            },
            {
              step: 3,
              title: "Book & Track",
              desc: "Secure your bookings, track campaign performance, and manage payments seamlessly.",
              color: "bg-[#8b5cf6]",
            },
          ].map((item) => (
            <div key={item.step} className="space-y-4 px-3">
              <div className={`mx-auto h-20 w-20 rounded-full ${item.color} text-white grid place-items-center text-2xl font-bold shadow-lg`}>
                {item.step}
              </div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="text-[#4b5563] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white text-[#111827] py-16 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">Trusted by Industry Leaders</h2>
          <p className="text-lg text-[#4b5563]">
            See what our clients say about transforming their advertising strategies
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2 mt-12">
          {[
            {
              quote:
                "OOH Marketplace transformed how we plan and execute our outdoor campaigns. The platform's geo-targeting and real-time availability made our last campaign 40% more effective.",
              name: "Rajesh Kumar",
              role: "Marketing Director, BrandForce",
              avatar: "https://i.pravatar.cc/80?img=12",
            },
            {
              quote:
                "As a media owner, this platform streamlined our inventory management and increased our booking rates by 60%. The automated pricing and availability features are game-changers.",
              name: "Priya Sharma",
              role: "CEO, Metro Media Solutions",
              avatar: "https://i.pravatar.cc/80?img=32",
            },
          ].map((t) => (
            <div key={t.name} className="rounded-3xl bg-[#f7f8fb] border border-[#eef1f6] p-8 shadow-sm">
              <p className="text-lg text-[#1f2937] italic leading-relaxed">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-4">
                <img src={t.avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="text-base font-semibold">{t.name}</div>
                  <div className="text-sm text-[#4b5563]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#173a8a] via-[#2b288f] to-[#561f8f] text-white px-6 py-16">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight">Ready to Transform Your Advertising?</h2>
          <p className="text-lg text-white/85">
            Join thousands of advertisers and media owners who trust OOH Marketplace for their outdoor advertising needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <a
              href="/get-started"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-[#1f3c8f] px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition"
            >
              Start Your Campaign Today
            </a>
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/5 px-8 py-3 text-base font-semibold hover:bg-white/10 transition"
            >
              Schedule a Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-white px-6 py-14">
        <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-500/40 grid place-items-center text-blue-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M7 3h10a2 2 0 0 1 2 2v14l-7-3-7 3V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>
              <span className="text-lg font-semibold">traqOOH</span>
            </div>
            <p className="text-[#e5e7ebcc] leading-relaxed">
              India&apos;s premier platform connecting media owners with advertisers for seamless out-of-home advertising campaigns.
            </p>
            <div className="flex items-center gap-4 text-xl text-[#9ca3af]">
              <span>🌐</span>
              <span>👥</span>
              <span>⚡</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Platform</h3>
            <ul className="space-y-2 text-[#e5e7ebcc]">
              <li><a href="/get-started" className="hover:text-white">For Advertisers</a></li>
              <li><a href="/get-started" className="hover:text-white">For Media Owners</a></li>
              <li><a href="/pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#api" className="hover:text-white">API</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-[#e5e7ebcc]">
              <li><a href="#help" className="hover:text-white">Help Center</a></li>
              <li><a href="/contact" className="hover:text-white">Contact Us</a></li>
              <li><a href="#privacy" className="hover:text-white">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-white">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 border-t border-white/10 pt-6 text-sm text-[#9ca3af] text-center">
          © 2025 traqOOH. All rights reserved.
        </div>
      </footer>

      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#111827]">Watch Demo</h3>
              <button
                type="button"
                onClick={() => setShowDemo(false)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                aria-label="Close demo"
              >
                ×
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                title="Demo video"
                src={`${demoUrl}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      <Chatbot />
    </main>
  );
}
