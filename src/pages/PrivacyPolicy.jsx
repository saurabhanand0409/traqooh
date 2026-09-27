import React from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "23 June 2026";
const COMPANY = "BrandSculpt Media Solutions Private Limited";
const SUPPORT_EMAIL = "saurabh@brandsculpt.com";
const GRIEVANCE_EMAIL = "saurabh@brandsculpt.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: "rgba(7,12,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg grid place-items-center font-bold text-lg text-white"
              style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>t</div>
            <span className="font-bold tracking-tight">
              <span style={{ color: "#60A5FA" }}>traq</span>
              <span style={{ color: "#F87171" }}>OOH</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/terms" style={{ color: "#9CA3AF" }} className="hover:text-white">Terms of Service</Link>
            <Link to="/login" style={{ color: "#9CA3AF" }} className="hover:text-white">Login</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold mb-2" style={{ fontFamily: "Syne, sans-serif" }}>Privacy Policy</h1>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="rounded-2xl p-5 mb-8" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "#D1D5DB" }}>
            This Privacy Policy explains how {COMPANY} (&quot;<strong>BrandSculpt</strong>&quot;, &quot;<strong>we</strong>&quot;, &quot;<strong>us</strong>&quot;,
            or &quot;<strong>our</strong>&quot;) collects, uses, shares, and protects your personal information when you use the TraqOOH platform
            (the &quot;<strong>Service</strong>&quot;) — including the web application at <a href="https://app.brandsculpt.com" className="underline" style={{ color: "#60A5FA" }}>app.brandsculpt.com</a>,
            our Android mobile application, and any related services.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: "#D1D5DB" }}>
            By using the Service, you agree to the collection and use of information in accordance with this policy. We comply with the
            applicable provisions of the <strong>Information Technology Act, 2000</strong>, the <strong>Digital Personal Data Protection
            Act, 2023</strong>, and other relevant Indian laws.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <Subsection title="1.1 Information You Provide Directly">
            <ul>
              <li><strong>Account information:</strong> name, email address, phone number, role (admin / employee / advertiser / field worker), display name, hashed password.</li>
              <li><strong>Company &amp; tax information:</strong> company name, billing address, GST registration number, GST certificate, director name, primary contact details.</li>
              <li><strong>Advertiser profile data:</strong> contact person, phone, billing address, GST number, notes.</li>
              <li><strong>Site inventory data:</strong> billboard names, locations, addresses, dimensions, type, lighting, base rates, photographs, GPS coordinates.</li>
              <li><strong>Campaign data:</strong> campaign name, dates, budget, notes, site selections, shortlist preferences, agreed rates.</li>
            </ul>
          </Subsection>

          <Subsection title="1.2 Information Collected Automatically">
            <ul>
              <li><strong>Device &amp; usage data:</strong> IP address, browser type, operating system, device identifiers, pages visited, time spent, referring URLs.</li>
              <li><strong>Location data:</strong> with your explicit permission, the mobile application accesses your device&apos;s GPS to (a) discover nearby billboards, (b) geo-tag execution photographs at the moment of capture for verification purposes.</li>
              <li><strong>Photographs &amp; videos:</strong> when you upload site photos, execution proof photos, or campaign videos through the web app or mobile app, we store them along with timestamps, GPS coordinates (if available), and the identity of the uploader.</li>
              <li><strong>Authentication tokens:</strong> JSON Web Tokens (JWTs) and field-worker PINs used to keep you logged in.</li>
              <li><strong>One-time passwords (OTPs):</strong> six-digit codes sent to your registered email for mobile application login; stored hashed with a 10-minute expiry.</li>
            </ul>
          </Subsection>

          <Subsection title="1.3 Information from Third Parties">
            <p>We may receive limited information about you from our service providers (Resend for email delivery confirmation, Cloudflare for content delivery, Render and Neon for infrastructure-level logs).</p>
          </Subsection>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and maintain the Service.</li>
            <li>Authenticate users and protect accounts against unauthorized access.</li>
            <li>Send OTP codes for mobile application login.</li>
            <li>Send advertiser proposal links, live-tracking notifications, and approval requests to the email address on file.</li>
            <li>Enable field workers to log execution activities, capture proof photographs with GPS coordinates, and report on campaign progress.</li>
            <li>Allow advertisers to view campaign progress, browse proposed sites, shortlist preferred locations, and approve cost sheets.</li>
            <li>Generate invoices, cost sheets, and reports for campaign execution.</li>
            <li>Improve the Service through analytics, bug detection, and performance monitoring.</li>
            <li>Comply with applicable legal obligations, respond to legal process, and enforce our Terms of Service.</li>
            <li>Detect, prevent, and respond to fraud, abuse, security incidents, or other harmful activity.</li>
          </ul>
        </Section>

        <Section title="3. How We Share Your Information">
          <p>We do not sell your personal information. We share information only as described below:</p>

          <Subsection title="3.1 Service Providers">
            <p>We share information with vetted third-party service providers who perform services on our behalf:</p>
            <ul>
              <li><strong>Render (USA):</strong> backend application hosting.</li>
              <li><strong>Neon Postgres (USA):</strong> primary database storing your account, campaign, and inventory data.</li>
              <li><strong>Cloudflare R2 (USA / global):</strong> storage of uploaded photographs and videos.</li>
              <li><strong>Cloudflare Pages (global CDN):</strong> hosting of the web application.</li>
              <li><strong>Resend (USA):</strong> transactional email delivery (OTPs, advertiser links).</li>
              <li><strong>Expo / EAS (USA):</strong> Android application build infrastructure.</li>
              <li><strong>UptimeRobot:</strong> uptime monitoring (no personal data accessed).</li>
            </ul>
            <p>These providers are contractually obligated to handle your data in accordance with applicable law and only for the purpose of providing services to us.</p>
          </Subsection>

          <Subsection title="3.2 Between Platform Participants">
            <ul>
              <li>Information you submit as part of a campaign (advertiser company, campaign name, agreed costs, finalized site list) is shared with the corresponding media-owner team operating that campaign, and vice versa.</li>
              <li>Execution photographs, GPS coordinates, and timestamps captured by field workers are made visible to the campaign&apos;s assigned admin/employee and the relevant advertiser through their respective dashboards or secure access links.</li>
              <li>Site cover photographs and rate cards may be visible to advertisers browsing the media-owner&apos;s inventory.</li>
            </ul>
          </Subsection>

          <Subsection title="3.3 Legal Requirements">
            <p>We may disclose your information when required by law, by a competent regulatory authority, or by a court of competent jurisdiction in India, or where we believe in good faith that disclosure is necessary to (a) comply with a legal obligation, (b) protect our rights, property, or safety, or (c) prevent or investigate possible wrongdoing.</p>
          </Subsection>

          <Subsection title="3.4 Business Transfers">
            <p>If we are involved in a merger, acquisition, restructuring, or sale of all or part of our assets, your information may be transferred as part of that transaction. We will notify you (by email and a prominent notice on the Service) of any change in ownership or use of your information.</p>
          </Subsection>
        </Section>

        <Section title="4. Where Your Data Is Stored">
          <p>The Service is operated from India but uses cloud infrastructure with data centers primarily located in the United States. By using the Service, you consent to the transfer, storage, and processing of your information outside of India, including in the United States and other countries where our service providers operate. We rely on industry-standard safeguards (encryption in transit, encryption at rest, access controls, vendor agreements) to protect data wherever it resides.</p>
        </Section>

        <Section title="5. Data Retention">
          <ul>
            <li><strong>Account data:</strong> retained for as long as your account is active. You may request deletion at any time (see Section 7).</li>
            <li><strong>Campaign and activity records:</strong> retained for a minimum of seven (7) years after campaign completion to support audit, tax, and regulatory requirements under Indian law.</li>
            <li><strong>Photographs and videos:</strong> retained for the duration of the campaign and seven (7) years thereafter. May be retained longer if required for an ongoing dispute or legal hold.</li>
            <li><strong>OTP codes:</strong> stored hashed; expire and are invalidated after 10 minutes.</li>
            <li><strong>Access link tokens:</strong> stored hashed (SHA-256); expire after 7 days by default.</li>
            <li><strong>Field-worker PINs:</strong> auto-expire 72 hours after creation.</li>
            <li><strong>Access logs:</strong> retained for 90 days for security audit purposes.</li>
          </ul>
        </Section>

        <Section title="6. Security">
          <p>We employ a range of technical and organizational measures to protect your information, including:</p>
          <ul>
            <li>HTTPS / TLS encryption for all data in transit.</li>
            <li>Encryption at rest for cloud storage of media files and the database.</li>
            <li>Industry-standard password hashing (bcrypt).</li>
            <li>JWT-based authentication with signed, expiring tokens (7-day expiry).</li>
            <li>Rate limiting on authentication endpoints (5 OTP requests/minute, 10 login attempts/minute) to prevent brute-force attacks.</li>
            <li>Role-based access controls at the API level.</li>
            <li>SHA-256 hashing of access-link tokens (plaintext never persisted).</li>
            <li>Regular security updates and dependency patching.</li>
          </ul>
          <p>No method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee its absolute security.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Subject to applicable law (including the Digital Personal Data Protection Act, 2023), you have the following rights regarding your personal information:</p>
          <ul>
            <li><strong>Right to access:</strong> obtain a copy of the personal information we hold about you.</li>
            <li><strong>Right to correction:</strong> request that we correct any inaccurate or incomplete information.</li>
            <li><strong>Right to erasure:</strong> request that we delete your personal information, subject to retention obligations imposed by law (e.g., tax records).</li>
            <li><strong>Right to data portability:</strong> receive your personal information in a structured, commonly used, machine-readable format.</li>
            <li><strong>Right to withdraw consent:</strong> withdraw any consent you have previously given for processing of your personal information.</li>
            <li><strong>Right to nominate:</strong> nominate another person to exercise your rights in the event of your death or incapacity.</li>
            <li><strong>Right to grievance redressal:</strong> raise complaints with our Grievance Officer (see Section 12).</li>
            <li><strong>Right to lodge a complaint:</strong> file a complaint with the Data Protection Board of India if you believe your rights have been violated.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{SUPPORT_EMAIL}</a>. We will respond within thirty (30) days.</p>
        </Section>

        <Section title="8. Cookies &amp; Similar Technologies">
          <p>We use minimal browser storage (localStorage) to keep you logged in (storing your JWT authentication token). We do not currently use third-party advertising cookies or cross-site tracking technologies. We do not currently integrate third-party analytics platforms that track individual users.</p>
        </Section>

        <Section title="9. Children&apos;s Privacy">
          <p>The Service is intended for use by businesses and adult professionals. We do not knowingly collect personal information from children under the age of 18. If you are a parent or guardian and you believe that your child has provided us with personal information, please contact us so we can take appropriate action.</p>
        </Section>

        <Section title="10. Communications">
          <p>We send transactional communications relating to your use of the Service (OTP codes, advertiser proposal links, live-tracking notifications, approval requests). These are essential to the Service and cannot be opted out of while you maintain an active account.</p>
          <p>We do not currently send marketing emails. If we introduce marketing communications in the future, you will be given a clear opt-in choice and a one-click unsubscribe option in every such email.</p>
        </Section>

        <Section title="11. Changes to This Privacy Policy">
          <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other reasons. When we make material changes, we will notify you by email (using the address on file) and post a prominent notice on the Service. The &quot;Last updated&quot; date at the top of this policy indicates when it was last revised.</p>
          <p>Your continued use of the Service after the effective date of the revised policy constitutes your acceptance of the changes.</p>
        </Section>

        <Section title="12. Grievance Officer">
          <p>In accordance with the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023, the contact details of the Grievance Officer are provided below:</p>
          <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="mb-1"><strong>Grievance Officer:</strong> Saurabh Anand</p>
            <p className="mb-1"><strong>Entity:</strong> {COMPANY}</p>
            <p className="mb-1"><strong>Email:</strong> <a href={`mailto:${GRIEVANCE_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{GRIEVANCE_EMAIL}</a></p>
            <p><strong>Response time:</strong> we acknowledge complaints within 24 hours and resolve them within 15 days.</p>
          </div>
        </Section>

        <Section title="13. Contact Us">
          <p>If you have any questions, concerns, or comments about this Privacy Policy or our data practices, please contact us at:</p>
          <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="mb-1"><strong>{COMPANY}</strong></p>
            <p className="mb-1"><strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{SUPPORT_EMAIL}</a></p>
            <p><strong>Website:</strong> <a href="https://app.brandsculpt.com" className="underline" style={{ color: "#60A5FA" }}>app.brandsculpt.com</a></p>
          </div>
        </Section>

        <footer className="mt-16 pt-6 text-center text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#6B7280" }}>
          © {new Date().getFullYear()} {COMPANY}. All rights reserved.
          <span className="mx-2">·</span>
          <Link to="/terms" className="hover:text-white">Terms of Service</Link>
          <span className="mx-2">·</span>
          <Link to="/" className="hover:text-white">Home</Link>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3" style={{ fontFamily: "Syne, sans-serif", color: "#fff" }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed legal-prose" style={{ color: "#D1D5DB" }}>
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-bold mb-2 text-white">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
