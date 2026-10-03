import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysOnErrorSampleRate: 1.0,
  });
}

import App from "./App.jsx";
// Login pages
import EmployeeLogin from "./pages/EmployeeLogin.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import MasterLogin from "./pages/MasterLogin.jsx";
import AdvertiserLogin from "./pages/AdvertiserLogin.jsx";
// Legacy / registration pages (kept for backward compat)
import MediaOwnerCreate from "./pages/MediaOwnerCreate.jsx";
import AdvertiserCreate from "./pages/AdvertiserCreate.jsx";
import GetStarted from "./pages/GetStarted.jsx";
// Registration pages
import Register from "./pages/Register.jsx";
import RegisterAdvertiser from "./pages/RegisterAdvertiser.jsx";
import RegisterAdmin from "./pages/RegisterAdmin.jsx";
import RegisterEmployee from "./pages/RegisterEmployee.jsx";
// Dashboards
import Dashboard from "./pages/Dashboard.jsx";          // Employee dashboard
import AdminDashboard from "./pages/AdminDashboard.jsx";  // Admin dashboard
import MasterDashboard from "./pages/MasterDashboard.jsx"; // Master (SUPER_ADMIN) dashboard
import AdvertiserDashboard from "./pages/AdvertiserDashboard.jsx"; // Advertiser portal
// Internal pages (employee + admin)
import Inventory from "./pages/Inventory.jsx";
import Vendors from "./pages/Vendors.jsx";
import Advertisers from "./pages/Advertisers.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
// Execution pages
import Activities from "./pages/Activities.jsx";
import Reports from "./pages/Reports.jsx";
// Other pages
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import Payment from "./pages/Payment.jsx";
import Pricing from "./pages/Pricing.jsx";
import AccessView from "./pages/AccessView.jsx";
// Legal pages
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import TermsOfService from "./pages/TermsOfService.jsx";

function RedirectExternal({ to }) {
  React.useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{color:"#fff",padding:"2rem"}}>Something went wrong. Please reload the page.</div>}>
    <BrowserRouter>
      <Routes>
        {/* Root — redirect to marketing site */}
        <Route path="/" element={<RedirectExternal to="https://traqooh.brandsculpt.com" />} />

        {/* Login routes */}
        <Route path="/login" element={<AdvertiserLogin />} />
        <Route path="/employeelogin" element={<EmployeeLogin />} />
        <Route path="/adminlogin" element={<AdminLogin />} />
        <Route path="/masterlogin" element={<MasterLogin />} />

        {/* Registration routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/register/advertiser" element={<RegisterAdvertiser />} />
        <Route path="/register/admin" element={<RegisterAdmin />} />
        <Route path="/register/employee" element={<RegisterEmployee />} />

        {/* Legacy routes — redirect to correct login */}
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/media-owner" element={<Navigate to="/employeelogin" replace />} />
        <Route path="/advertiser" element={<Navigate to="/login" replace />} />
        <Route path="/media-owner/create" element={<MediaOwnerCreate />} />
        <Route path="/advertiser/create" element={<AdvertiserCreate />} />

        {/* Aliases for the /login/<role> path style used by the marketing site at brandsculpt.com */}
        <Route path="/login/employee" element={<Navigate to="/employeelogin" replace />} />
        <Route path="/login/admin" element={<Navigate to="/adminlogin" replace />} />
        <Route path="/login/master" element={<Navigate to="/masterlogin" replace />} />
        <Route path="/login/advertiser" element={<Navigate to="/login" replace />} />
        <Route path="/login/field" element={<Navigate to="/employeelogin" replace />} />

        {/* Role-based dashboard routes */}
        <Route path="/dashboard/employee" element={<Dashboard />} />
        <Route path="/dashboard/master" element={<MasterDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
        <Route path="/dashboard/advertiser" element={<AdvertiserDashboard />} />
        {/* Legacy dashboard redirect — detect role and route */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Internal pages */}
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/advertisers" element={<Advertisers />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />

        {/* Execution pages */}
        <Route path="/activities" element={<Activities />} />
        <Route path="/reports" element={<Reports />} />

        {/* Secure advertiser access link */}
        <Route path="/access/:token" element={<AccessView />} />

        {/* Other pages */}
        <Route path="/account" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/pricing" element={<Pricing />} />

        {/* Legal (publicly accessible) */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* Catch-all: any unmatched URL → marketing site (better than a blank dark page) */}
        <Route path="*" element={<RedirectExternal to="https://traqooh.brandsculpt.com" />} />
      </Routes>
    </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
