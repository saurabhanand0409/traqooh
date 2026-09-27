// Proof of Display report + printable-window helper, shared by the Monitoring tab
// (Campaigns.jsx) and the advertiser portal (AccessView.jsx).
//
// Callers normalise their data to:
//   { campaign: { name, advertiserName, startDate, endDate, preparedBy },
//     sites: [{ name, city, state, type, size, latitude, longitude, worker,
//               photos: { START: [photo], MID: [photo], END: [photo] } }] }
//   photo = { url, label, status, when, latitude, longitude, distanceM, performedBy, notes }
// Rejected photos must be filtered out by the caller.

export const OFFSITE_LIMIT_M = 250;
const PHASES = [["START", "Installation"], ["MID", "Audit"], ["END", "Takedown"]];
const SHOT_LABEL = { "close-up": "Close-up", wide: "Wide", landmark: "Landmark", video: "Video" };

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isVideo = (url) => /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(url || "");

export function fmtDistance(m) {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso).includes("T") ? iso : String(iso).replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const shotLabel = (label) => SHOT_LABEL[label] || (label ? label[0].toUpperCase() + label.slice(1) : "");

// Open generated HTML in a new tab to print / save as PDF. If the browser blocks the
// popup, download it as an .html file instead and say how to print it.
export function openPrintable(html, filenameBase, what = "document") {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    return;
  }
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(filenameBase || "document").replace(/[^a-z0-9]+/gi, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  alert(`Your browser blocked the print preview, so the ${what} was downloaded as an HTML file instead. Open it from your Downloads folder and press Ctrl+P to print or save as PDF.`);
}

export function buildProofReportHtml({ campaign, sites }) {
  let totalProofs = 0, verified = 0, offSite = 0, installed = 0;
  sites.forEach(s => {
    PHASES.forEach(([key]) => (s.photos[key] || []).forEach(p => {
      totalProofs++;
      if (p.status === "VERIFIED") verified++;
      if (p.distanceM != null && p.distanceM > OFFSITE_LIMIT_M) offSite++;
    }));
    if ((s.photos.START || []).length) installed++;
  });

  const tile = (p) => {
    const gps = p.latitude != null && p.longitude != null
      ? `<a href="https://www.google.com/maps?q=${p.latitude},${p.longitude}">${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}</a>`
      : "No GPS (uploaded from web)";
    const far = p.distanceM != null && p.distanceM > OFFSITE_LIMIT_M;
    const dist = p.distanceM != null
      ? `<div class="${far ? "warn" : "ok"}">${fmtDistance(p.distanceM)} from site${far ? ` · outside ${OFFSITE_LIMIT_M} m limit` : ""}</div>` : "";
    const media = isVideo(p.url)
      ? `<a class="vid" href="${esc(p.url)}">▶ Video<br><span>open to play</span></a>`
      : `<img src="${esc(p.url)}" alt="">`;
    return `<figure>${media}<figcaption>
      ${p.label ? `<div class="shot">${esc(shotLabel(p.label))}</div>` : ""}
      <div class="when">${esc(fmtWhen(p.when))}</div>
      <div>${gps}</div>${dist}
      <div>By ${esc(p.performedBy || "—")} · <span class="${p.status === "VERIFIED" ? "ok" : "muted"}">${p.status === "VERIFIED" ? "✓ Verified" : "Not yet verified"}</span></div>
      ${p.notes ? `<div class="muted">${esc(p.notes)}</div>` : ""}
    </figcaption></figure>`;
  };

  const sections = sites.map((s, i) => {
    const blocks = PHASES.map(([key, label]) => {
      const items = s.photos[key] || [];
      return `<div class="phase"><h3>${label} <span>${items.length} proof${items.length === 1 ? "" : "s"}</span></h3>
        ${items.length ? `<div class="grid">${items.map(tile).join("")}</div>` : `<div class="empty">No ${label.toLowerCase()} proof yet</div>`}</div>`;
    }).join("");
    const siteGps = s.latitude != null && s.longitude != null ? `${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}` : "Not recorded";
    return `<section class="site">
      <div class="site-hdr"><div class="num">${i + 1}</div><div>
        <h2>${esc(s.name || "—")}</h2>
        <div class="muted">${esc([s.city, s.state].filter(Boolean).join(", ") || "—")} · ${esc(s.type || "—")}${s.size ? ` · ${esc(s.size)}` : ""}</div>
        <div class="muted">Site location: ${siteGps}${s.worker !== undefined ? ` · Field worker: ${esc(s.worker || "Not assigned")}` : ""}</div>
      </div></div>${blocks}</section>`;
  }).join("");

  const c = campaign || {};
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Proof of Display – ${esc(c.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;padding:28px 32px;color:#111;font-size:11.5px}
    a{color:#1d4ed8;text-decoration:none}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
    .brand-text{font-family:'Syne',Arial,sans-serif;font-size:24px;font-weight:800;line-height:1;margin-bottom:8px}
    .brand-text .b{color:#2563EB}.brand-text .r{color:#DC143C}
    h1{font-family:'Syne',Arial,sans-serif;font-size:18px;font-weight:800;color:#0f172a;margin-bottom:3px}
    .meta{text-align:right;color:#555;font-size:11px;line-height:1.7}
    .chips{display:flex;flex-wrap:wrap;gap:18px;background:#f0f4ff;border:1px solid #dbe4ff;border-radius:10px;padding:12px 16px;margin-bottom:18px}
    .chip-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
    .chip-val{font-size:14px;font-weight:700;margin-top:2px}
    .site{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
    .site-hdr{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
    .num{flex:none;width:26px;height:26px;border-radius:7px;background:#1e293b;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}
    h2{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px}
    .phase{margin-top:10px}
    h3{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#334155;margin-bottom:6px}
    h3 span{font-weight:500;color:#94a3b8;text-transform:none;letter-spacing:0;margin-left:4px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    figure{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid}
    figure img{display:block;width:100%;height:150px;object-fit:cover;background:#f1f5f9}
    .vid{display:flex;flex-direction:column;align-items:center;justify-content:center;height:150px;background:#0f172a;color:#fff;font-weight:700;font-size:13px;text-align:center}
    .vid span{font-weight:400;font-size:10px;color:#94a3b8}
    figcaption{padding:7px 8px;font-size:10px;line-height:1.5;color:#334155}
    .shot{font-weight:700;color:#1d4ed8;text-transform:uppercase;font-size:9px;letter-spacing:.05em}
    .when{font-weight:600;color:#0f172a}
    .muted{color:#64748b}.ok{color:#15803d}.warn{color:#b45309;font-weight:600}
    .empty{padding:10px;border:1px dashed #cbd5e1;border-radius:8px;color:#94a3b8;font-size:10.5px}
    .foot{margin-top:18px;text-align:center;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:12px}
    @media print{@page{size:A4 portrait;margin:10mm}body{padding:0}}
  </style></head><body>
  <div class="hdr">
    <div>
      <div class="brand-text"><span class="b">traq</span><span class="r">OOH</span></div>
      <h1>${esc(c.name)}</h1>
      <div class="muted">${esc(c.advertiserName || "")} · ${esc(c.startDate || "TBD")} → ${esc(c.endDate || "TBD")}</div>
    </div>
    <div class="meta">
      <div style="font-weight:700;font-size:13px;color:#0f172a">Proof of Display Report</div>
      <div>${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
      ${c.preparedBy ? `<div>Prepared by: ${esc(c.preparedBy)}</div>` : ""}
    </div>
  </div>
  <div class="chips">
    <div><div class="chip-label">Sites</div><div class="chip-val">${sites.length}</div></div>
    <div><div class="chip-label">Installed with proof</div><div class="chip-val">${installed} of ${sites.length}</div></div>
    <div><div class="chip-label">Photos &amp; videos</div><div class="chip-val">${totalProofs}</div></div>
    <div><div class="chip-label">Verified</div><div class="chip-val">${verified} of ${totalProofs}</div></div>
    <div><div class="chip-label">Outside ${OFFSITE_LIMIT_M} m</div><div class="chip-val" style="color:${offSite ? "#b45309" : "#15803d"}">${offSite}</div></div>
  </div>
  ${sections}
  <div class="foot">Generated by TraqOOH · Photos are geo-tagged and time-stamped at capture · Confidential</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),600)</script>
  </body></html>`;
}

export function openProofReport(data) {
  openPrintable(buildProofReportHtml(data), `proof-of-display-${data.campaign?.name || "campaign"}`, "report");
}
