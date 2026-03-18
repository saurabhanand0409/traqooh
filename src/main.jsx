import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import App from "./App.jsx";
import GetStarted from "./pages/GetStarted.jsx";
import MediaOwnerLogin from "./pages/MediaOwnerLogin.jsx";
import MediaOwnerCreate from "./pages/MediaOwnerCreate.jsx";
import AdvertiserLogin from "./pages/AdvertiserLogin.jsx";
import AdvertiserCreate from "./pages/AdvertiserCreate.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import Payment from "./pages/Payment.jsx";
import Pricing from "./pages/Pricing.jsx";
import Vendors from "./pages/Vendors.jsx";
import Advertisers from "./pages/Advertisers.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
import AccessView from "./pages/AccessView.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/media-owner" element={<MediaOwnerLogin />} />
        <Route path="/media-owner/create" element={<MediaOwnerCreate />} />
        <Route path="/advertiser" element={<AdvertiserLogin />} />
        <Route path="/advertiser/create" element={<AdvertiserCreate />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/advertisers" element={<Advertisers />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/access/:token" element={<AccessView />} />
        <Route path="/account" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/pricing" element={<Pricing />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
