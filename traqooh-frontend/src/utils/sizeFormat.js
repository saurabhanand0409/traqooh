// Shared size-description helpers used across Inventory, AccessView,
// MasterDashboard, and any PDF/cost-sheet output.
// Storage shape: site.size is either:
//   1) a JSON-encoded array of rows: [{qty, width, length, unit, note}, ...]
//   2) a legacy free-text string (older inventory)
//   3) empty — in which case fall back to numeric width/length on the site row.

export const parseSizeRows = (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null; // signals "legacy free-text"
};

// Single-character unit symbol: ' for feet, " for inches.
const unitSym = (unit) => {
  const u = (unit || "ft").toLowerCase();
  if (u.startsWith("in")) return "\"";
  return "'";
};

// Render one row as plain text — e.g. `25× 55"` or `1'×15'` or `20× 42" screens`.
// Returns "" if the row has no usable data.
export const formatSizeRow = (r) => {
  const qty = Number(r.qty) || 1;
  const w = (r.width ?? "").toString().trim();
  const l = (r.length ?? "").toString().trim();
  const u = unitSym(r.unit);
  const note = (r.note || "").trim();

  let dim = "";
  if (w && l) dim = `${w}${u}×${l}${u}`;
  else if (w) dim = `${w}${u}`;

  const qtyPrefix = qty > 1 ? `${qty}× ` : "";
  const parts = [qtyPrefix + dim, note].filter(Boolean);
  return parts.join(" ").trim();
};

// Render the whole site.size for plain-text contexts (lists, PDFs).
// Falls back to legacy free-text and then numeric width/length.
export const formatSize = (site) => {
  if (site?.size) {
    const rows = parseSizeRows(site.size);
    if (Array.isArray(rows) && rows.length > 0) {
      const txt = rows.map(formatSizeRow).filter(Boolean).join(" + ");
      if (txt) return txt;
    } else if (rows === null) {
      return site.size; // legacy free-text
    }
  }
  if (site?.width && site?.length) return `${site.width}'×${site.length}'`;
  return "—";
};

// Structured rows for callers that want to render their own UI (e.g. SizeBadge).
// Always returns an array of { qty, dim, unitLabel, note, raw } where dim is
// already formatted with the unit symbol (or "" if no dimensions on this row).
export const sizeRowsFor = (site) => {
  if (!site?.size) {
    if (site?.width && site?.length) {
      return [{ qty: 1, dim: `${site.width}'×${site.length}'`, unitLabel: "ft", note: "", raw: { qty: 1, width: site.width, length: site.length, unit: "ft", note: "" } }];
    }
    return [];
  }
  const rows = parseSizeRows(site.size);
  if (!Array.isArray(rows) || rows.length === 0) {
    // legacy free-text: present as a single note-only row
    return [{ qty: 1, dim: "", unitLabel: "", note: site.size, raw: { qty: 1, width: "", length: "", unit: "ft", note: site.size } }];
  }
  return rows.map(r => {
    const qty = Number(r.qty) || 1;
    const w = (r.width ?? "").toString().trim();
    const l = (r.length ?? "").toString().trim();
    const u = unitSym(r.unit);
    const dim = w && l ? `${w}${u}×${l}${u}` : (w ? `${w}${u}` : "");
    return { qty, dim, unitLabel: (r.unit || "ft"), note: (r.note || "").trim(), raw: r };
  });
};
