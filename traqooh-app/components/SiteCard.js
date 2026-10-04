import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useLang } from "../utils/i18n";

const BLUE = "#2563EB";
const RED = "#DC143C";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const CARD = "#0D1428";
const BORDER = "rgba(255,255,255,0.08)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

const AVAIL_COLOR = {
  AVAILABLE: GREEN,
  OCCUPIED: RED,
  MAINTENANCE: AMBER,
};

// `assigned`: shown in "My Sites", with the campaign, photo counts per phase and any retakes
export default function SiteCard({ site, onPress, assigned = false }) {
  const { t } = useLang();
  const retakes = assigned ? site.retakes || [] : [];
  const counts = site.photoCounts;
  const availColor = AVAIL_COLOR[site.availabilityStatus] || GRAY;
  const sizeStr = site.width && site.length
    ? `${site.width}×${site.length} ft`
    : site.size || null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      {site.imageUrl ? (
        <Image source={{ uri: site.imageUrl }} style={s.image} resizeMode="cover" />
      ) : (
        <View style={s.imagePlaceholder}>
          <Text style={s.imagePlaceholderText}>📍</Text>
        </View>
      )}

      <View style={s.body}>
        {/* Header row */}
        <View style={s.row}>
          <Text style={s.name} numberOfLines={1}>{site.name}</Text>
          <View style={[s.badge, { backgroundColor: `${availColor}20`, borderColor: `${availColor}40` }]}>
            <View style={[s.dot, { backgroundColor: availColor }]} />
            <Text style={[s.badgeText, { color: availColor }]}>
              {site.availabilityStatus || "AVAILABLE"}
            </Text>
          </View>
        </View>

        {assigned && site.campaignName ? <Text style={s.campaign} numberOfLines={1}>🎯 {site.campaignName}</Text> : null}

        {retakes.map(r => (
          <Text key={r.activityId} style={s.retake} numberOfLines={2}>
            ↺ {t("retake_needed")} · {t("retake_line", { phase: t(`phase_${r.phase}`), reason: r.reason || t("retake_no_reason") })}
          </Text>
        ))}

        {/* Location */}
        <Text style={s.location}>
          📍 {[site.areaLocality, site.city, site.state].filter(Boolean).join(", ")}
        </Text>

        {/* Details row */}
        <View style={s.detailRow}>
          {site.type && <Chip icon="🏗️" label={site.type} />}
          {sizeStr && <Chip icon="📐" label={sizeStr} />}
          {site.lightingType && <Chip icon="💡" label={site.lightingType} />}
        </View>

        {assigned && counts ? (
          <Text style={s.counts}>📷 {t("counts_line", { start: counts.START ?? 0, mid: counts.MID ?? 0, end: counts.END ?? 0 })}</Text>
        ) : null}

        {/* Rate */}
        {!assigned && site.potentialMonthly ? (
          <Text style={s.rate}>
            ₹{Number(site.potentialMonthly).toLocaleString("en-IN")}
            <Text style={s.rateSub}> {t("per_month")}</Text>
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ icon, label }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipText}>{icon} {label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  image: { width: "100%", height: 160 },
  imagePlaceholder: {
    width: "100%", height: 100,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center", justifyContent: "center",
  },
  imagePlaceholderText: { fontSize: 32 },
  body: { padding: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "800", color: "#fff", flex: 1, marginRight: 8 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  location: { fontSize: 12, color: GRAY2, marginBottom: 10 },
  campaign: { fontSize: 12, color: "#93C5FD", fontWeight: "700", marginBottom: 6 },
  retake: {
    fontSize: 12, color: "#FCA5A5", fontWeight: "700", marginBottom: 6,
    backgroundColor: "rgba(220,20,60,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, overflow: "hidden",
  },
  counts: { fontSize: 12, color: GRAY2 },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipText: { fontSize: 11, color: GRAY2 },
  rate: { fontSize: 16, fontWeight: "900", color: BLUE },
  rateSub: { fontSize: 12, fontWeight: "400", color: GRAY },
});
