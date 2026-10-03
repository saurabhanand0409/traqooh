import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Linking, Alert, ActivityIndicator, Modal,
  TextInput, FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { uploadActivity, fetchSiteGallery } from "../utils/api";

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
  { key: "MOUNTING", label: "Install",  icon: "🔧", color: BLUE },
  { key: "AUDIT",    label: "Monitor",  icon: "📸", color: "#8B5CF6" },
  { key: "END",      label: "End",      icon: "✅", color: GREEN },
  { key: "PRINT",    label: "Print",    icon: "🖨️", color: AMBER },
];

const GALLERY_GROUP_LABEL = {
  MOUNTING: "Install", START: "Install",
  AUDIT: "Monitor", MAINTENANCE: "Monitor",
  END: "End", TAKEDOWN: "End",
  PRINT: "Print", REPRINT: "Print",
};

export default function SiteDetailScreen({ navigation, route }) {
  const { site, user: routeUser } = route.params;
  const user = routeUser || {};
  const availColor = AVAIL_COLOR[site.availabilityStatus] || GRAY;
  const sizeStr = site.width && site.length ? `${site.width} × ${site.length} ft` : site.size || "N/A";
  const totalArea = site.total_area ? `${site.total_area} sq ft` : null;

  // Gallery state
  const [gallery, setGallery] = useState({});
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Activity log modal state
  const [logModal, setLogModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [pickedPhoto, setPickedPhoto] = useState(null);
  const [pickedIsVideo, setPickedIsVideo] = useState(false);
  const [pickedMime, setPickedMime] = useState(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  // Full-screen image viewer
  const [viewImage, setViewImage] = useState(null);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const data = await fetchSiteGallery(site.id);
      setGallery(data.grouped || {});
    } catch {
      setGallery({});
    } finally {
      setGalleryLoading(false);
    }
  }, [site.id]);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  const openMaps = () => {
    if (site.latitude && site.longitude) {
      Linking.openURL(`https://www.google.com/maps?q=${site.latitude},${site.longitude}`);
    } else if (site.city) {
      Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(site.name + " " + site.city)}`);
    }
  };

  const openLogModal = (type) => {
    setSelectedType(type);
    setPickedPhoto(null);
    setPickedIsVideo(false);
    setPickedMime(null);
    setNotes("");
    setLogModal(true);
  };

  const applyPicked = (asset) => {
    if (!asset) return;
    const isVid = asset.type === "video" || asset.duration != null;
    setPickedPhoto(asset.uri);
    setPickedIsVideo(isVid);
    setPickedMime(asset.mimeType || null);
  };

  const pickPhoto = () => {
    Alert.alert("Add Photo / Video", "Choose source", [
      {
        text: "Take Photo / Video",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Camera access is required.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.7,
            videoMaxDuration: 60,
            allowsEditing: false,
          });
          if (!result.canceled && result.assets?.[0]) applyPicked(result.assets[0]);
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          // The system photo picker needs no storage permission, so there's no
          // permission prompt here (Play Store restricts broad photo access).
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.7,
            videoMaxDuration: 60,
            allowsEditing: false,
          });
          if (!result.canceled && result.assets?.[0]) applyPicked(result.assets[0]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submitActivity = async () => {
    if (!pickedPhoto) {
      Alert.alert("Media required", "Please take or pick a photo or video first.");
      return;
    }
    setUploading(true);
    try {
      let lat = null, lng = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {}

      await uploadActivity({
        siteId: site.id,
        activityType: selectedType.key,
        photoUri: pickedPhoto,
        mimeType: pickedMime,
        performedBy: user.workerName || user.displayName || "Field Worker",
        notes: notes.trim() || null,
        latitude: lat,
        longitude: lng,
        // Present on assigned sites — pins the media to the right campaign's monitoring board
        campaignId: site.campaignId ?? null,
        assignmentId: site.assignmentId ?? null,
      });

      setLogModal(false);
      Alert.alert("Done!", `${selectedType.label} ${pickedIsVideo ? "video" : "photo"} logged successfully.`);
      loadGallery();
    } catch (e) {
      Alert.alert("Upload failed", e.message || "Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const totalPhotos = Object.values(gallery).reduce((s, a) => s + a.length, 0);

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
          <TouchableOpacity onPress={() => setViewImage({ url: site.imageUrl })}>
            <Image source={{ uri: site.imageUrl }} style={s.image} resizeMode="cover" />
          </TouchableOpacity>
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
          <Text style={s.mapsLink}>Map →</Text>
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
          {site.owner?.name && <DetailCell label="Owner" value={site.owner.name} fullWidth />}
          {site.remarks && <DetailCell label="Remarks" value={site.remarks} fullWidth />}
        </View>

        {/* ─── LOG ACTIVITY ─── */}
        <Text style={s.sectionTitle}>Log Activity</Text>
        <View style={s.activityRow}>
          {ACTIVITY_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.actBtn, { borderColor: t.color + "50" }]}
              onPress={() => openLogModal(t)}
              activeOpacity={0.7}
            >
              <Text style={s.actIcon}>{t.icon}</Text>
              <Text style={[s.actLabel, { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── PHOTO GALLERY ─── */}
        <View style={s.galleryHeader}>
          <Text style={s.sectionTitle}>Site Photos</Text>
          {totalPhotos > 0 && (
            <Text style={s.galleryCount}>{totalPhotos} photo{totalPhotos !== 1 ? "s" : ""}</Text>
          )}
        </View>

        {galleryLoading ? (
          <View style={s.galleryLoading}>
            <ActivityIndicator size="small" color={BLUE} />
            <Text style={{ color: GRAY2, fontSize: 12, marginLeft: 8 }}>Loading photos…</Text>
          </View>
        ) : totalPhotos === 0 ? (
          <View style={s.emptyGallery}>
            <Text style={s.emptyGalleryIcon}>📷</Text>
            <Text style={s.emptyGalleryText}>No photos yet</Text>
            <Text style={s.emptyGallerySubText}>Log an activity above to add the first photo</Text>
          </View>
        ) : (
          Object.entries(gallery).map(([label, photos]) => (
            <View key={label} style={s.galleryGroup}>
              <Text style={s.galleryGroupLabel}>{label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.galleryRow}>
                  {photos.map((p, i) => (
                    <TouchableOpacity key={i} onPress={() => setViewImage(p)}>
                      <Image source={{ uri: p.url }} style={s.thumb} />
                      {p.performedBy && (
                        <Text style={s.thumbBy} numberOfLines={1}>{p.performedBy}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── LOG ACTIVITY MODAL ─── */}
      <Modal visible={logModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {selectedType?.icon} {selectedType?.label} — {site.name}
              </Text>
              <TouchableOpacity onPress={() => setLogModal(false)}>
                <Text style={{ color: GRAY2, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Photo / video picker */}
            <TouchableOpacity style={s.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
              {pickedPhoto ? (
                pickedIsVideo ? (
                  <View style={[s.photoPreview, { alignItems: "center", justifyContent: "center", backgroundColor: "#000" }]}>
                    <Text style={{ fontSize: 40 }}>🎥</Text>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 6 }}>Video ready to upload</Text>
                  </View>
                ) : (
                  <Image source={{ uri: pickedPhoto }} style={s.photoPreview} resizeMode="cover" />
                )
              ) : (
                <View style={s.photoPickerInner}>
                  <Text style={{ fontSize: 36 }}>📷</Text>
                  <Text style={s.photoPickerText}>Tap to take or pick a photo / video</Text>
                </View>
              )}
            </TouchableOpacity>
            {pickedPhoto && (
              <TouchableOpacity onPress={pickPhoto} style={s.retakeBtn}>
                <Text style={s.retakeText}>{pickedIsVideo ? "Choose different media" : "Retake photo"}</Text>
              </TouchableOpacity>
            )}

            {/* Notes */}
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note (optional)…"
              placeholderTextColor={GRAY}
              multiline
              numberOfLines={2}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, uploading && s.submitBtnDisabled]}
              onPress={submitActivity}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitText}>Submit Photo →</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── FULL SCREEN IMAGE VIEWER (with GPS + timestamp) ─── */}
      <Modal visible={!!viewImage} animationType="fade" transparent>
        <View style={s.imageViewerOverlay}>
          <TouchableOpacity style={s.imageViewerClose} onPress={() => setViewImage(null)}>
            <Text style={{ color: "#fff", fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
          {viewImage && (
            <>
              <Image source={{ uri: viewImage.url }} style={s.imageViewerImg} resizeMode="contain" />
              {(viewImage.createdAt || viewImage.latitude != null || viewImage.performedBy || viewImage.activityType) && (
                <View style={s.metaPanel}>
                  {viewImage.activityType && (
                    <MetaRow icon="🏷️" label="Activity" value={viewImage.label || viewImage.activityType} />
                  )}
                  {viewImage.performedBy && (
                    <MetaRow icon="👷" label="Logged by" value={viewImage.performedBy} />
                  )}
                  {viewImage.createdAt && (
                    <MetaRow icon="🕒" label="Date & Time" value={fmtDateTime(viewImage.createdAt)} />
                  )}
                  {viewImage.latitude != null && viewImage.longitude != null && (
                    <>
                      <MetaRow
                        icon="📍" label="GPS"
                        value={`${Number(viewImage.latitude).toFixed(6)}, ${Number(viewImage.longitude).toFixed(6)}`}
                      />
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`https://www.google.com/maps?q=${viewImage.latitude},${viewImage.longitude}`)}
                        style={s.metaMapBtn}>
                        <Text style={s.metaMapText}>Open location in Google Maps →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {viewImage.notes ? <MetaRow icon="📝" label="Notes" value={viewImage.notes} /> : null}
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

  // Activity buttons
  activityRow: {
    flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 20,
  },
  actBtn: {
    flex: 1, alignItems: "center", paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1,
  },
  actIcon: { fontSize: 20, marginBottom: 4 },
  actLabel: { fontSize: 11, fontWeight: "700" },

  // Gallery
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
  thumbBy: { color: GRAY, fontSize: 9, marginTop: 3, width: 100, textAlign: "center" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0D1428",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },

  photoPicker: {
    height: 180, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 2, borderColor: BORDER, borderStyle: "dashed",
    overflow: "hidden", marginBottom: 8,
    alignItems: "center", justifyContent: "center",
  },
  photoPickerInner: { alignItems: "center" },
  photoPickerText: { color: GRAY2, fontSize: 13, marginTop: 8 },
  photoPreview: { width: "100%", height: "100%" },
  retakeBtn: { alignItems: "center", marginBottom: 12 },
  retakeText: { color: BLUE, fontSize: 13, fontWeight: "600" },

  notesInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 12,
    color: "#fff", fontSize: 14,
    marginBottom: 16, textAlignVertical: "top",
  },

  submitBtn: {
    backgroundColor: BLUE, borderRadius: 14, padding: 16, alignItems: "center",
    shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Full-screen image viewer
  imageViewerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  imageViewerClose: {
    position: "absolute", top: 56, right: 24, zIndex: 10,
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
  },
  imageViewerImg: { width: "100%", height: "62%" },

  // Photo metadata panel (GPS + timestamp)
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
