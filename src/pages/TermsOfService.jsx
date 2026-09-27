import React from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "23 June 2026";
const COMPANY = "BrandSculpt Media Solutions Private Limited";
const SUPPORT_EMAIL = "saurabh@brandsculpt.com";
const JURISDICTION_CITY = "Patna, Bihar";

export default function TermsOfService() {
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
            <Link to="/privacy" style={{ color: "#9CA3AF" }} className="hover:text-white">Privacy Policy</Link>
            <Link to="/login" style={{ color: "#9CA3AF" }} className="hover:text-white">Login</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold mb-2" style={{ fontFamily: "Syne, sans-serif" }}>Terms of Service</h1>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="rounded-2xl p-5 mb-8" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "#D1D5DB" }}>
            These Terms of Service (&quot;<strong>Terms</strong>&quot;) govern your access to and use of the TraqOOH platform
            (the &quot;<strong>Service</strong>&quot;) provided by {COMPANY} (&quot;<strong>BrandSculpt</strong>&quot;,
            &quot;<strong>we</strong>&quot;, &quot;<strong>us</strong>&quot;, &quot;<strong>our</strong>&quot;). By creating an account,
            accessing, or using any part of the Service, you (&quot;<strong>you</strong>&quot;, &quot;<strong>your</strong>&quot;,
            or &quot;<strong>User</strong>&quot;) agree to be bound by these Terms.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: "#D1D5DB" }}>
            <strong>If you do not agree, do not use the Service.</strong> These Terms constitute a legally binding agreement between you and BrandSculpt.
          </p>
        </div>

        <Section title="1. Service Description">
          <p>TraqOOH is a software-as-a-service platform for the planning, execution, and tracking of Out-of-Home (OOH) advertising campaigns in India. The Service connects:</p>
          <ul>
            <li><strong>Media Owners / Vendors</strong> who own or operate billboard inventory.</li>
            <li><strong>Advertisers</strong> who wish to book that inventory.</li>
            <li><strong>Field Workers</strong> who execute on-ground installation, monitoring, and takedown of campaign materials.</li>
            <li><strong>Administrators &amp; Employees</strong> who manage these relationships, inventory, and campaign workflows.</li>
          </ul>
          <p>Features include inventory management, campaign creation and lifecycle management, advertiser proposal and approval flows, field-worker photographic execution logs with GPS verification, secure document sharing, and cost-sheet generation.</p>
        </Section>

        <Section title="2. Eligibility">
          <ul>
            <li>You must be at least 18 years old to use the Service.</li>
            <li>You must use the Service in a professional or business capacity. The Service is not intended for personal, household, or consumer use.</li>
            <li>If you accept these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity to these Terms.</li>
            <li>You must not be barred from receiving services under the laws of India or any other applicable jurisdiction.</li>
          </ul>
        </Section>

        <Section title="3. Account Registration &amp; Security">
          <ul>
            <li>Accounts are typically provisioned by an administrator of a media-owner organization. Direct self-signup is available where enabled.</li>
            <li>You agree to provide accurate, current, and complete information during registration and to keep that information up to date.</li>
            <li>You are responsible for safeguarding your password, JWT authentication tokens, and any 4-digit field-worker PINs assigned to you.</li>
            <li>You agree to notify us immediately of any unauthorized use of your account or any other breach of security.</li>
            <li>We will not be liable for any loss or damage arising from your failure to comply with the above.</li>
            <li>One account per person. You may not share login credentials or transfer your account to another person without our written consent.</li>
          </ul>
        </Section>

        <Section title="4. User Roles &amp; Permissions">
          <p>The Service supports the following roles, each with different permissions:</p>
          <ul>
            <li><strong>Super Admin:</strong> platform-wide oversight (BrandSculpt operations team only).</li>
            <li><strong>Admin:</strong> full control over their media-owner company&apos;s data, employees, vendors, advertisers, sites, and campaigns.</li>
            <li><strong>Employee:</strong> create and manage campaigns, share inventory globally, but limited to viewing their own and shared campaigns.</li>
            <li><strong>Advertiser:</strong> view proposed campaigns, shortlist sites, approve cost sheets, and access live execution photographs.</li>
            <li><strong>Field Worker:</strong> log on-ground execution activity (photos, videos, GPS) via the mobile application using a 4-digit PIN.</li>
          </ul>
          <p>You may use the Service only in the capacity for which your account has been provisioned.</p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree NOT to:</p>
          <ul>
            <li>Use the Service in any way that violates applicable laws or regulations of India or any other jurisdiction.</li>
            <li>Upload, post, or share content that is unlawful, infringing, defamatory, obscene, fraudulent, threatening, harassing, or harmful to minors.</li>
            <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or entity.</li>
            <li>Attempt to gain unauthorized access to the Service, other users&apos; accounts, computer systems, or networks connected to the Service.</li>
            <li>Use any automated means (bots, scrapers, crawlers, etc.) to access, monitor, or copy any portion of the Service without our prior written consent.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service, including by overloading, &quot;flooding&quot;, &quot;spamming&quot;, &quot;mail bombing&quot;, or otherwise compromising the Service.</li>
            <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service except to the extent expressly permitted by law.</li>
            <li>Submit knowingly false data, fake GPS coordinates, doctored execution photographs, or fraudulent campaign records.</li>
            <li>Resell, sublicense, or commercially exploit the Service or any of its components without our prior written consent.</li>
            <li>Upload viruses, worms, malware, or any other malicious code.</li>
            <li>Use the Service for any unsolicited bulk communication, spam, or other unauthorized advertising.</li>
          </ul>
        </Section>

        <Section title="6. Content &amp; Intellectual Property">
          <Subsection title="6.1 Your Content">
            <p>You retain ownership of the content you upload to the Service, including site photographs, campaign creatives, execution proof photos and videos, GPS data, notes, and any company information (&quot;<strong>User Content</strong>&quot;).</p>
            <p>By uploading User Content, you grant BrandSculpt a worldwide, non-exclusive, royalty-free, sublicensable, transferable license to host, store, reproduce, modify (for the purpose of compression and format conversion), display, and distribute that content solely as necessary to:</p>
            <ul>
              <li>Provide the Service to you and other authorized users (e.g., showing site photographs to advertisers reviewing proposals).</li>
              <li>Generate cost sheets, invoices, and reports.</li>
              <li>Comply with legal obligations or respond to legal process.</li>
              <li>Maintain backups and ensure service continuity.</li>
            </ul>
            <p>You represent and warrant that you have all necessary rights to grant this license, and that your User Content does not violate any third party&apos;s rights, including intellectual property and privacy rights.</p>
          </Subsection>

          <Subsection title="6.2 Our Intellectual Property">
            <p>The Service, including its design, source code, logos, brand names (&quot;TraqOOH&quot;, &quot;BrandSculpt&quot;), and all associated trademarks, are owned by BrandSculpt or our licensors and protected by Indian and international intellectual property laws. You may not use any of our marks without our prior written consent.</p>
          </Subsection>

          <Subsection title="6.3 Feedback">
            <p>If you provide us with any suggestions, feedback, or improvements about the Service, you grant us a perpetual, irrevocable, royalty-free license to use that feedback for any purpose without obligation to you.</p>
          </Subsection>
        </Section>

        <Section title="7. Campaign Execution &amp; Data Accuracy">
          <p>You acknowledge and agree that:</p>
          <ul>
            <li>The Service is a tool to facilitate campaign management — final commercial decisions, contracts, and payments are between the relevant media-owner and advertiser parties.</li>
            <li>BrandSculpt is not a party to the underlying advertising contracts between media owners and advertisers unless expressly agreed otherwise in writing.</li>
            <li>Execution photographs are timestamped and geo-tagged at the point of capture to support verification. You agree not to upload doctored, edited, or geographically falsified content.</li>
            <li>Cost sheets and quotes generated by the Service are not legally binding offers unless followed up by an executed contract or invoice between the parties.</li>
            <li>You are responsible for verifying the accuracy of all inventory data, rates, dates, and other campaign details before finalizing any commitment.</li>
          </ul>
        </Section>

        <Section title="8. Fees &amp; Payment">
          <p>BrandSculpt may charge fees for access to certain features of the Service. As of the &quot;Last updated&quot; date above:</p>
          <ul>
            <li>Access to the Service is currently provided on terms separately agreed between BrandSculpt and the engaging media-owner organization.</li>
            <li>Field workers, advertisers, and individual users are not separately charged for access — fees, if any, are paid by the engaging media-owner.</li>
            <li>Fees, billing cycles, and refund terms (if any) will be communicated to the engaging organization in writing. If we introduce in-app billing in the future, those terms will be presented for your acceptance prior to any charge.</li>
            <li>All fees, if any, are exclusive of applicable taxes (including GST). You are responsible for any taxes applicable to your use of the Service.</li>
          </ul>
        </Section>

        <Section title="9. Third-Party Services">
          <p>The Service depends on third-party infrastructure providers (Render, Neon, Cloudflare, Resend, Expo, UptimeRobot) listed in our Privacy Policy. We are not responsible for the availability or performance of these third parties, but we will use commercially reasonable efforts to maintain the Service even in the event of partial outages.</p>
          <p>The Service may also link to or integrate with third-party websites or services (e.g., Google Maps for location links). Such third parties have their own terms and privacy policies; we are not responsible for them.</p>
        </Section>

        <Section title="10. Service Availability &amp; Modifications">
          <p>We strive to keep the Service available 24/7, but do not guarantee uninterrupted operation. The Service may be temporarily unavailable due to maintenance, upgrades, third-party outages, or other factors beyond our reasonable control.</p>
          <p>We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. We will not be liable to you or any third party for any modification, suspension, or discontinuance, except where required by law.</p>
          <p>We will give reasonable advance notice (typically 30 days by email) before discontinuing the Service entirely.</p>
        </Section>

        <Section title="11. Termination">
          <Subsection title="11.1 By You">
            <p>You may terminate your account at any time by contacting our support email below. Termination does not entitle you to a refund of any fees already paid (subject to Section 8).</p>
          </Subsection>
          <Subsection title="11.2 By Us">
            <p>We may suspend or terminate your access to the Service at any time, with or without notice, if we reasonably believe that:</p>
            <ul>
              <li>You have violated these Terms.</li>
              <li>Your conduct creates a security risk, legal exposure, or operational disruption for us or other users.</li>
              <li>You have engaged in fraud, identity theft, or other unlawful activity.</li>
              <li>Required by law, court order, or competent authority.</li>
            </ul>
          </Subsection>
          <Subsection title="11.3 Effect of Termination">
            <p>Upon termination, your right to access and use the Service ceases immediately. We will retain your data in accordance with our Privacy Policy (Section 5 thereof). Provisions of these Terms that by their nature should survive termination (intellectual property, indemnification, limitation of liability, dispute resolution, etc.) will so survive.</p>
          </Subsection>
        </Section>

        <Section title="12. Disclaimer of Warranties">
          <p>To the maximum extent permitted by applicable law, the Service is provided on an &quot;<strong>AS IS</strong>&quot; and &quot;<strong>AS AVAILABLE</strong>&quot; basis, without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, or uninterrupted operation.</p>
          <p>We do not warrant that:</p>
          <ul>
            <li>The Service will meet your specific requirements.</li>
            <li>The Service will be uninterrupted, timely, secure, or error-free.</li>
            <li>Any defects in the Service will be corrected.</li>
            <li>The Service or the servers that make it available are free of viruses or other harmful components.</li>
          </ul>
        </Section>

        <Section title="13. Limitation of Liability">
          <p>To the maximum extent permitted by applicable law:</p>
          <ul>
            <li>BrandSculpt and its directors, officers, employees, and agents shall not be liable to you for any indirect, incidental, special, consequential, punitive, or exemplary damages, including loss of profits, revenue, goodwill, data, or business opportunity, arising out of or in connection with your use of the Service.</li>
            <li>In no event shall BrandSculpt&apos;s total aggregate liability to you for all claims arising out of or relating to the Service exceed the greater of (a) the amounts paid by your organization to BrandSculpt under the relevant contract during the twelve (12) months preceding the event giving rise to the claim, or (b) ₹10,000 (Indian Rupees ten thousand).</li>
            <li>This limitation applies regardless of the legal theory on which the claim is based, whether contract, tort (including negligence), strict liability, or any other theory, even if BrandSculpt has been advised of the possibility of such damages.</li>
          </ul>
        </Section>

        <Section title="14. Indemnification">
          <p>You agree to indemnify, defend, and hold harmless BrandSculpt and its directors, officers, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from:</p>
          <ul>
            <li>Your use of and access to the Service.</li>
            <li>Your violation of any term of these Terms.</li>
            <li>Your violation of any third-party right, including any intellectual property, privacy, or other proprietary right.</li>
            <li>Any User Content you submit to the Service.</li>
          </ul>
        </Section>

        <Section title="15. Governing Law &amp; Dispute Resolution">
          <p>These Terms are governed by and construed in accordance with the laws of <strong>India</strong>, without regard to its conflict of law provisions.</p>
          <p>Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be submitted to the exclusive jurisdiction of the competent courts located in <strong>{JURISDICTION_CITY}</strong>, India.</p>
          <p>Before initiating any formal legal proceeding, the parties agree to attempt in good faith to resolve any dispute through informal negotiation, by contacting <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{SUPPORT_EMAIL}</a> with a written notice describing the dispute. The parties shall negotiate in good faith for at least thirty (30) days before pursuing other remedies.</p>
        </Section>

        <Section title="16. Modifications to These Terms">
          <p>We reserve the right to modify these Terms at any time. When we make material changes, we will:</p>
          <ul>
            <li>Update the &quot;Last updated&quot; date at the top of these Terms.</li>
            <li>Notify you by email (using the address on file) and/or by a prominent notice within the Service.</li>
            <li>Provide reasonable notice (typically 30 days) before the change takes effect, except where immediate change is required by law or to address security risks.</li>
          </ul>
          <p>Your continued use of the Service after the effective date of the revised Terms constitutes your acceptance of those changes. If you do not agree, you must stop using the Service before the effective date.</p>
        </Section>

        <Section title="17. Miscellaneous">
          <ul>
            <li><strong>Entire agreement:</strong> these Terms (together with the Privacy Policy and any separately negotiated commercial agreements) constitute the entire agreement between you and BrandSculpt regarding the Service and supersede any prior understandings.</li>
            <li><strong>Severability:</strong> if any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.</li>
            <li><strong>Waiver:</strong> our failure to enforce any right or provision of these Terms is not a waiver of such right or provision.</li>
            <li><strong>Assignment:</strong> you may not assign or transfer these Terms without our prior written consent. We may assign these Terms freely.</li>
            <li><strong>No agency:</strong> nothing in these Terms creates any agency, partnership, joint venture, or employment relationship between you and BrandSculpt.</li>
            <li><strong>Notices:</strong> we may give notices by email to the address on file or by posting them on the Service. Notices to us should be sent to <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{SUPPORT_EMAIL}</a>.</li>
            <li><strong>Force majeure:</strong> we will not be liable for any failure or delay in performance caused by events beyond our reasonable control, including acts of God, war, terrorism, riots, pandemics, government action, network outages, or third-party service disruptions.</li>
          </ul>
        </Section>

        <Section title="18. Contact Us">
          <p>If you have any questions about these Terms, please contact us at:</p>
          <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="mb-1"><strong>{COMPANY}</strong></p>
            <p className="mb-1"><strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "#60A5FA" }}>{SUPPORT_EMAIL}</a></p>
            <p><strong>Website:</strong> <a href="https://app.brandsculpt.com" className="underline" style={{ color: "#60A5FA" }}>app.brandsculpt.com</a></p>
          </div>
        </Section>

        <footer className="mt-16 pt-6 text-center text-sm" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#6B7280" }}>
          © {new Date().getFullYear()} {COMPANY}. All rights reserved.
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
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
