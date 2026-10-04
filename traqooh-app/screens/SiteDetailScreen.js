import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Linking, ActivityIndicator, Modal,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { fetchSiteGallery, fetchMyAssignedSites } from "../utils/api";
import { useLang } from "../utils/i18n";
import { subscribe } from "../utils/outbox";

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

const ACTIVITY_TYPES = [
  { key: "MOUNTING", icon: "🔧", color: BLUE },
  { key: "AUDIT", icon: "📸", color: "#8B5CF6" },
  { key: "END", icon: "✅", color: GREEN },
  { key: "PRINT", icon: "🖨️", color: AMBER },
];

// Which button a retake belongs to (the backend reports retakes by phase)
const PHASE_ACTIVITY = { START: "MOUNTING", MID: "AUDIT", END: "END" };

const isVideoUrl = (url) => /\.(mp4|mov|m4v|3gp|webm)(\?|$)/i.test(url || "");

export default function SiteDetailScreen({ navigation, route }) {
  const { user = {} } = route.params;
  const { t } = useLang();
  const [site, setSite] = useState(route.params.site);
  const availColor = AVAIL_COLOR[site.availabilityStatus] || GRAY;
  const sizeStr = site.width && site.length ? `${site.width} × ${site.length} ft` : site.size || "N/A";
  const totalArea = site.total_area ? `${site.total_area} sq ft` : null;

  const [gallery, setGallery] = useState({});
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [viewImage, setViewImage] = useState(null);
  const [queue, setQueue] = useState({ outbox: [], drafts: [] });

  const loadGallery = useCallback(async () => {
    try {
      const data = await fetchSiteGallery(site.id);
      setGallery(data?.grouped || {});
    } catch {
      /* keep what we had; shown again on the next visit to this screen */
    } finally {
      setGalleryLoading(false);
    }
  }, [site.id]);

  // Fresh photos, retakes and counts each time the worker comes back here (e.g. after a visit)
  useFocusEffect(useCallback(() => {
    loadGallery();
    if (site.assignmentId) {
      fetchMyAssignedSites()
        .then(list => {
          const fresh = list.find(x => x.assignmentId === site.assignmentId);
          if (fresh) setSite(fresh);
        })
        .catch(() => {});
    }
  }, [loadGallery, site.assignmentId]));

  useEffect(() => subscribe(setQueue), []);

  const pendingHere = queue.outbox.filter(v => v.siteId === site.id).length;
  const draftFor = (key) => queue.drafts.find(d => d.site?.id === site.id && d.activityKey === key);

  const startVisit = (activityKey, retakeReason) => {
    navigation.navigate("Capture", {
      site, activityKey, user,
      draft: draftFor(activityKey) || null,
      retakeReason: retakeReason || null,
    });
  };

  const openMaps = () => {
    if (site.latitude && site.longitude) {
      Linking.openURL(`https://www.google.com/maps?q=${site.latitude},${site.longitude}`);
    } else if (site.city) {
      Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(site.name + " " + site.city)}`);
    }
  };

  const totalPhotos = Object.values(gallery).reduce((n, a) => n + a.length, 0);
  const retakes = site.retakes || [];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{site.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {site.imageUrl ? (
          <TouchableOpacity onPress={() => setViewImage({ url: site.imageUrl })}>
            <Image source={{ uri: site.imageUrl }} style={s.image} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={{ fontSize: 48 }}>🏙️</Text>
          </View>
        )}

        <View style={s.titleRow}>
          <Text style={s.title}>{site.name}</Text>
          <View style={[s.availBadge, { backgroundColor: `${availColor}18`, borderColor: `${availColor}40` }]}>
            <View style={[s.dot, { backgroundColor: availColor }]} />
            <Text style={[s.availText, { color: availColor }]}>{site.availabilityStatus || "AVAILABLE"}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={openMaps} style={s.locationRow}>
          <Text style={s.locationIcon}>📍</Text>
          <Text style={s.locationText}>
            {[site.areaLocality, site.address, site.city, site.state].filter(Boolean).join(", ")}
          </Text>
          <Text style={s.mapsLink}>{t("map")}</Text>
        </TouchableOpacity>

        {/* Visits the office sent back */}
        {retakes.map(r => (
          <View key={r.activityId} style={s.retakeBox}>
            <Text style={s.retakeTitle}>↺ {t("retake_needed")}</Text>
            <Text style={s.retakeText}>
              {t("retake_line", { phase: t(`phase_${r.phase}`), reason: r.reason || t("retake_no_reason") })}
            </Text>
            <TouchableOpacity style={s.retakeBtn} onPress={() => startVisit(PHASE_ACTIVITY[r.phase] || "AUDIT", r.reason)}>
              <Text style={s.retakeBtnText}>{t("retake_now")}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {pendingHere > 0 && (
          <View style={s.pendingBox}>
            <Text style={s.pendingText}>⏫ {t("pending_here", { n: pendingHere })}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>{t("log_visit")}</Text>
        <View style={s.activityRow}>
          {ACTIVITY_TYPES.map(a => {
            const hasDraft = !!draftFor(a.key);
            return (
              <TouchableOpacity
                key={a.key}
                style={[s.actBtn, { borderColor: a.color + "50" }, hasDraft && { borderColor: AMBER }]}
                onPress={() => startVisit(a.key)}
                activeOpacity={0.7}
              >
                <Text style={s.actIcon}>{a.icon}</Text>
                <Text style={[s.actLabel, { color: a.color }]}>{t(`act_${a.key}`)}</Text>
                {hasDraft && <Text style={s.actDraft}>●</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {site.potentialMonthly ? (
          <View style={s.rateCard}>
            <Text style={s.rateLabel}>{t("monthly_rate")}</Text>
            <Text style={s.rateValue}>₹{Number(site.potentialMonthly).toLocaleString("en-IN")}</Text>
          </View>
        ) : null}

        <Text style={s.sectionTitle}>{t("site_details")}</Text>
        <View style={s.grid}>
          <DetailCell label={t("d_type")} value={site.type || "—"} />
          <DetailCell label={t("d_size")} value={sizeStr} />
          {totalArea && <DetailCell label={t("d_area")} value={totalArea} />}
          <DetailCell label={t("d_lighting")} value={site.lightingType || "—"} />
          <DetailCell label={t("d_facing")} value={site.facing || "—"} />
          <DetailCell label={t("d_city")} value={site.city || "—"} />
          {site.owner?.name && <DetailCell label={t("d_owner")} value={site.owner.name} fullWidth />}
          {site.remarks && <DetailCell label={t("d_remarks")} value={site.remarks} fullWidth />}
        </View>

        <View style={s.galleryHeader}>
          <Text style={s.sectionTitle}>{t("site_photos")}</Text>
          {totalPhotos > 0 && <Text style={s.galleryCount}>{t("photos_count", { n: totalPhotos })}</Text>}
        </View>

        {galleryLoading ? (
          <View style={s.galleryLoading}>
            <ActivityIndicator size="small" color={BLUE} />
            <Text style={{ color: GRAY2, fontSize: 12, marginLeft: 8 }}>{t("loading_photos")}</Text>
          </View>
        ) : totalPhotos === 0 ? (
          <View style={s.emptyGallery}>
            <Text style={s.emptyGalleryIcon}>📷</Text>
            <Text style={s.emptyGalleryText}>{t("no_photos")}</Text>
            <Text style={s.emptyGallerySubText}>{t("no_photos_sub")}</Text>
          </View>
        ) : (
          Object.entries(gallery).map(([label, photos]) => (
            <View key={label} style={s.galleryGroup}>
              <Text style={s.galleryGroupLabel}>{label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.galleryRow}>
                  {photos.map((p, i) => (
                    <TouchableOpacity key={i} onPress={() => (isVideoUrl(p.url) ? Linking.openURL(p.url) : setViewImage(p))}>
                      {isVideoUrl(p.url) ? (
                        <View style={[s.thumb, s.videoThumb]}><Text style={{ fontSize: 28 }}>🎥</Text></View>
                      ) : (
                        <Image source={{ uri: p.url }} style={s.thumb} />
                      )}
                      {p.performedBy && <Text style={s.thumbBy} numberOfLines={1}>{p.performedBy}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen photo with its time and GPS */}
      <Modal visible={!!viewImage} animationType="fade" transparent onRequestClose={() => setViewImage(null)}>
        <View style={s.imageViewerOverlay}>
          <TouchableOpacity style={s.imageViewerClose} onPress={() => setViewImage(null)}>
            <Text style={{ color: "#fff", fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
          {viewImage && (
            <>
              <Image source={{ uri: viewImage.url }} style={s.imageViewerImg} resizeMode="contain" />
              {(viewImage.capturedAt || viewImage.latitude != null || viewImage.performedBy || viewImage.activityType) && (
                <View style={s.metaPanel}>
                  {viewImage.activityType && <MetaRow icon="🏷️" label={t("m_activity")} value={viewImage.label || viewImage.activityType} />}
                  {viewImage.shot && <MetaRow icon="📷" label={t("m_shot")} value={viewImage.shot} />}
                  {viewImage.performedBy && <MetaRow icon="👷" label={t("m_by")} value={viewImage.performedBy} />}
                  {(viewImage.capturedAt || viewImage.createdAt) && (
                    <MetaRow icon="🕒" label={t("m_time")} value={fmtDateTime(viewImage.capturedAt || viewImage.createdAt)} />
                  )}
                  {viewImage.latitude != null && viewImage.longitude != null && (
                    <>
                      <MetaRow icon="📍" label={t("m_gps")}
                        value={`${Number(viewImage.latitude).toFixed(6)}, ${Number(viewImage.longitude).toFixed(6)}`} />
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`https://www.google.com/maps?q=${viewImage.latitude},${viewImage.longitude}`)}
                        style={s.metaMapBtn}>
                        <Text style={s.metaMapText}>{t("m_open_maps")}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {viewImage.notes ? <MetaRow icon="📝" label={t("m_notes")} value={viewImage.notes} /> : null}
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
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

function MetaRow({ icon, label, value }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaIcon}>{icon}</Text>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
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

  retakeBox: {
    marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14,
    backgroundColor: "rgba(220,20,60,0.12)", borderWidth: 1, borderColor: "rgba(220,20,60,0.35)",
  },
  retakeTitle: { color: "#F87171", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  retakeText: { color: "#FCA5A5", fontSize: 13, marginBottom: 10 },
  retakeBtn: { backgroundColor: RED, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  retakeBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  pendingBox: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
  },
  pendingText: { color: "#FBBF24", fontSize: 13, fontWeight: "700" },

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
    marginBottom: 10, marginTop: 8,
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

  activityRow: {
    flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 20,
  },
  actBtn: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1,
  },
  actIcon: { fontSize: 22, marginBottom: 4 },
  actLabel: { fontSize: 12, fontWeight: "700" },
  actDraft: { position: "absolute", top: 4, right: 8, color: AMBER, fontSize: 12 },

  galleryHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingRight: 16,
  },
  galleryCount: { color: GRAY2, fontSize: 12 },
  galleryLoading: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 16 },
  emptyGallery: {
    alignItems: "center", paddingVertical: 28,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
  },
  emptyGalleryIcon: { fontSize: 32, marginBottom: 8 },
  emptyGalleryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  emptyGallerySubText: { color: GRAY2, fontSize: 12, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  galleryGroup: { marginBottom: 16, paddingLeft: 16 },
  galleryGroupLabel: {
    color: GRAY2, fontSize: 10, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8,
  },
  galleryRow: { flexDirection: "row", gap: 8, paddingRight: 16 },
  thumb: { width: 100, height: 100, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" },
  videoThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  thumbBy: { color: GRAY, fontSize: 9, marginTop: 3, width: 100, textAlign: "center" },

  imageViewerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  imageViewerClose: {
    position: "absolute", top: 56, right: 24, zIndex: 10,
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
  },
  imageViewerImg: { width: "100%", height: "62%" },

  metaPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0D1428",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderTopWidth: 1, borderColor: BORDER,
  },
  metaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  metaIcon: { fontSize: 14, width: 24 },
  metaLabel: { color: GRAY2, fontSize: 12, width: 90 },
  metaValue: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  metaMapBtn: {
    marginTop: 8, backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1, borderColor: "rgba(37,99,235,0.4)",
    borderRadius: 12, paddingVertical: 11, alignItems: "center",
  },
  metaMapText: { color: BLUE, fontSize: 13, fontWeight: "700" },
});
