import React from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, Linking,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const BG = "#070C1A";
const CARD = "#0D1428";
const BLUE = "#2563EB";
const RED = "#DC143C";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const BORDER = "rgba(255,255,255,0.08)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

const AVAIL_COLOR = { AVAILABLE: GREEN, OCCUPIED: RED, MAINTENANCE: AMBER };

export default function SiteDetailScreen({ navigation, route }) {
  const { site } = route.params;
  const availColor = AVAIL_COLOR[site.availabilityStatus] || GRAY;
  const sizeStr = site.width && site.length ? `${site.width} × ${site.length} ft` : site.size || "N/A";
  const totalArea = site.total_area ? `${site.total_area} sq ft` : null;

  const openMaps = () => {
    if (site.latitude && site.longitude) {
      Linking.openURL(`https://www.google.com/maps?q=${site.latitude},${site.longitude}`);
    } else if (site.city) {
      Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(site.name + " " + site.city)}`);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Back header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{site.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Image */}
        {site.imageUrl ? (
          <Image source={{ uri: site.imageUrl }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={{ fontSize: 48 }}>🏙️</Text>
          </View>
        )}

        {/* Title + availability */}
        <View style={s.titleRow}>
          <Text style={s.title}>{site.name}</Text>
          <View style={[s.availBadge, { backgroundColor: `${availColor}18`, borderColor: `${availColor}40` }]}>
            <View style={[s.dot, { backgroundColor: availColor }]} />
            <Text style={[s.availText, { color: availColor }]}>{site.availabilityStatus || "AVAILABLE"}</Text>
          </View>
        </View>

        {/* Location */}
        <TouchableOpacity onPress={openMaps} style={s.locationRow}>
          <Text style={s.locationIcon}>📍</Text>
          <Text style={s.locationText}>
            {[site.areaLocality, site.address, site.city, site.state].filter(Boolean).join(", ")}
          </Text>
          <Text style={s.mapsLink}>View map →</Text>
        </TouchableOpacity>

        {/* Rate */}
        {site.potentialMonthly ? (
          <View style={s.rateCard}>
            <Text style={s.rateLabel}>Monthly Rate</Text>
            <Text style={s.rateValue}>₹{Number(site.potentialMonthly).toLocaleString("en-IN")}</Text>
          </View>
        ) : null}

        {/* Details grid */}
        <Text style={s.sectionTitle}>Site Details</Text>
        <View style={s.grid}>
          <DetailCell label="Type" value={site.type || "—"} />
          <DetailCell label="Size" value={sizeStr} />
          {totalArea && <DetailCell label="Total Area" value={totalArea} />}
          <DetailCell label="Lighting" value={site.lightingType || "—"} />
          <DetailCell label="Facing" value={site.facing || "—"} />
          <DetailCell label="City" value={site.city || "—"} />
          <DetailCell label="State" value={site.state || "—"} />
          {site.owner?.name && <DetailCell label="Owner" value={site.owner.name} fullWidth />}
          {site.remarks && <DetailCell label="Remarks" value={site.remarks} fullWidth />}
        </View>

        {/* Availability dates */}
        {(site.availableFrom || site.availableTill || site.occupiedFrom || site.occupiedTill) && (
          <>
            <Text style={s.sectionTitle}>Dates</Text>
            <View style={s.grid}>
              {site.availableFrom && <DetailCell label="Available From" value={site.availableFrom} />}
              {site.availableTill && <DetailCell label="Available Till" value={site.availableTill} />}
              {site.occupiedFrom && <DetailCell label="Occupied From" value={site.occupiedFrom} />}
              {site.occupiedTill && <DetailCell label="Occupied Till" value={site.occupiedTill} />}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailCell({ label, value, fullWidth }) {
  return (
    <View style={[s.cell, fullWidth && { width: "100%" }]}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={s.cellValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: "#0B1120",
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: BLUE, fontSize: 22, fontWeight: "700" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" },

  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  image: { width: "100%", height: 220 },
  imagePlaceholder: {
    width: "100%", height: 160,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center", justifyContent: "center",
  },

  titleRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 16, marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "900", color: "#fff", flex: 1, marginRight: 12 },
  availBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontWeight: "700" },

  locationRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, marginBottom: 16,
  },
  locationIcon: { fontSize: 14, marginRight: 6 },
  locationText: { fontSize: 13, color: GRAY2, flex: 1 },
  mapsLink: { color: BLUE, fontSize: 12, fontWeight: "700" },

  rateCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: "rgba(37,99,235,0.08)",
    borderWidth: 1, borderColor: "rgba(37,99,235,0.2)",
    borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  rateLabel: { color: GRAY2, fontSize: 13 },
  rateValue: { color: BLUE, fontSize: 24, fontWeight: "900" },

  sectionTitle: {
    color: GRAY, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, paddingHorizontal: 16,
    marginBottom: 10, marginTop: 4,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, gap: 8, marginBottom: 16,
  },
  cell: {
    width: "47%",
    backgroundColor: CARD,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  cellLabel: { color: GRAY, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  cellValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
