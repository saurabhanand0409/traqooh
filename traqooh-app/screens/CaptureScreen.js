import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { File } from "expo-file-system";
import { useLang } from "../utils/i18n";
import { addVisit, discardDraft, keepFile, newVisitId, saveDraft } from "../utils/outbox";

const BG = "#070C1A";
const CARD = "#0D1428";
const BLUE = "#2563EB";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const RED = "#DC143C";
const BORDER = "rgba(255,255,255,0.08)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

// The guided set of proof photos. Site visits need all three; a print check needs one.
const SITE_PLAN = [
  { label: "close-up", title: "shot_closeup", hint: "shot_closeup_hint" },
  { label: "wide", title: "shot_wide", hint: "shot_wide_hint" },
  { label: "landmark", title: "shot_landmark", hint: "shot_landmark_hint" },
];
const PRINT_PLAN = [{ label: "close-up", title: "shot_print", hint: "shot_print_hint" }];

const GPS_GOOD_M = 50;          // above this the GPS reading is shown as weak
const FIX_MAX_AGE_MS = 60000;   // a reading older than this is refreshed before it's attached to a photo

export default function CaptureScreen({ navigation, route }) {
  const { site, activityKey, user = {}, draft, retakeReason } = route.params;
  const { t } = useLang();
  const plan = activityKey === "PRINT" ? PRINT_PLAN : SITE_PLAN;

  const [visitId] = useState(() => draft?.clientVisitId || newVisitId());
  const [shots, setShots] = useState(draft?.shots || {});      // label -> shot
  const [video, setVideo] = useState(draft?.video || null);
  const [notes, setNotes] = useState(draft?.notes || "");
  const [busyLabel, setBusyLabel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [gps, setGps] = useState({ state: "waiting", accuracy: null });

  const fixRef = useRef(null);
  const stateRef = useRef({ shots: draft?.shots || {}, video: draft?.video || null, notes: draft?.notes || "", pendingLabel: null });
  const savedRef = useRef(false);

  // Keep the visit on the phone after every change, so nothing is lost if the app is closed or killed
  const persist = useCallback(async (patch) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (savedRef.current) return;
    const hasContent = Object.keys(next.shots).length > 0 || next.video || next.pendingLabel;
    if (!hasContent) {
      await discardDraft(visitId);
      return;
    }
    await saveDraft({
      clientVisitId: visitId,
      site, activityKey,
      workerName: user.workerName || null,
      retakeReason: retakeReason || null,
      shots: next.shots, video: next.video, notes: next.notes, pendingLabel: next.pendingLabel,
    });
  }, [visitId, site, activityKey, user.workerName, retakeReason]);

  // Follow the phone's location while this screen is open; each photo takes the latest reading
  useEffect(() => {
    let sub = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGps({ state: "off", accuracy: null }); return; }
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 2000, distanceInterval: 0 },
        (loc) => {
          fixRef.current = loc;
          setGps({ state: "on", accuracy: loc.coords.accuracy });
        },
      );
      if (cancelled) s.remove(); else sub = s;
    })().catch(() => setGps({ state: "off", accuracy: null }));
    return () => { cancelled = true; sub?.remove(); };
  }, []);

  const currentFix = async () => {
    const f = fixRef.current;
    if (f && Date.now() - f.timestamp < FIX_MAX_AGE_MS) return f;
    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise(resolve => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      return null;
    }
  };

  // Store a photo or video the camera returned, with its own time and GPS
  const accept = async (label, asset) => {
    const capturedAt = new Date().toISOString();
    const fix = await currentFix();
    const isVideo = label === "video";
    const ext = isVideo ? ((asset.uri.split(".").pop() || "mp4").toLowerCase()) : "jpg";
    const shot = {
      label,
      uri: keepFile(visitId, asset.uri, `${label}-${Date.now()}.${ext}`),
      mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
      isVideo,
      capturedAt,
      latitude: fix?.coords?.latitude ?? null,
      longitude: fix?.coords?.longitude ?? null,
      accuracy: fix?.coords?.accuracy != null ? Math.round(fix.coords.accuracy) : null,
    };
    const previous = isVideo ? stateRef.current.video : stateRef.current.shots[label];
    if (previous?.uri && previous.uri !== shot.uri) {
      try { new File(previous.uri).delete(); } catch { /* already gone */ }
    }
    if (isVideo) {
      setVideo(shot);
      await persist({ video: shot, pendingLabel: null });
    } else {
      const nextShots = { ...stateRef.current.shots, [label]: shot };
      setShots(nextShots);
      await persist({ shots: nextShots, pendingLabel: null });
    }
  };

  // Android can kill the app while the camera is open; the photo is then waiting for us here
  useEffect(() => {
    if (Platform.OS !== "android" || !draft?.pendingLabel) return;
    (async () => {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (pending && !pending.canceled && pending.assets?.[0]) {
          await accept(draft.pendingLabel, pending.assets[0]);
          Alert.alert("", t("recovered"));
          return;
        }
      } catch { /* nothing to recover */ }
      await persist({ pendingLabel: null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async (label) => {
    const isVideo = label === "video";
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("", t("camera_needed"));
      return;
    }
    setBusyLabel(label);
    try {
      await persist({ pendingLabel: label });
      // Live camera only: proof photos can't come from the gallery
      const result = await ImagePicker.launchCameraAsync(isVideo
        ? { mediaTypes: ["videos"], videoMaxDuration: 30, quality: 0.7 }
        : { mediaTypes: ["images"], quality: 0.7, allowsEditing: false, exif: false });
      if (result.canceled || !result.assets?.[0]) {
        await persist({ pendingLabel: null });
        return;
      }
      await accept(label, result.assets[0]);
    } catch (e) {
      await persist({ pendingLabel: null });
      Alert.alert("", t("camera_failed", { error: e?.message || "" }));
    } finally {
      setBusyLabel(null);
    }
  };

  const removeVideo = async () => {
    const v = stateRef.current.video;
    if (v?.uri) { try { new File(v.uri).delete(); } catch { /* already gone */ } }
    setVideo(null);
    await persist({ video: null });
  };

  const done = plan.filter(p => shots[p.label]).length;
  const complete = done === plan.length;

  const save = async () => {
    if (!complete || saving) return;
    setSaving(true);
    try {
      const ordered = plan.map(p => shots[p.label]);
      if (video) ordered.push(video);
      savedRef.current = true;
      await addVisit({
        clientVisitId: visitId,
        siteId: site.id,
        siteName: site.name,
        activityType: activityKey,
        campaignId: site.campaignId ?? null,
        assignmentId: site.assignmentId ?? null,
        performedBy: user.workerName || null,
        workerName: user.workerName || null,
        notes: notes.trim() || null,
        shots: ordered,
      });
      Alert.alert(t("saved_title"), t("saved_body"));
      navigation.goBack();
    } catch (e) {
      savedRef.current = false;
      Alert.alert("", e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const gpsPill = gps.state === "off"
    ? { color: RED, text: t("gps_off") }
    : gps.state === "waiting"
      ? { color: GRAY2, text: t("gps_waiting") }
      : gps.accuracy != null && gps.accuracy > GPS_GOOD_M
        ? { color: AMBER, text: t("gps_weak", { m: Math.round(gps.accuracy) }) }
        : { color: GREEN, text: t("gps_ok", { m: gps.accuracy != null ? Math.round(gps.accuracy) : "?" }) };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{t(`act_${activityKey}`)} · {site.name}</Text>
          <Text style={s.headerSub}>{t("shot_n_of", { i: Math.min(done + 1, plan.length), n: plan.length })}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {retakeReason ? (
          <View style={s.retakeBox}>
            <Text style={s.retakeText}>↺ {t("sent_back", { reason: retakeReason })}</Text>
          </View>
        ) : null}

        <View style={[s.gpsPill, { borderColor: gpsPill.color + "66" }]}>
          <View style={[s.gpsDot, { backgroundColor: gpsPill.color }]} />
          <Text style={[s.gpsText, { color: gpsPill.color }]}>{gpsPill.text}</Text>
        </View>

        {plan.map((p, i) => {
          const shot = shots[p.label];
          const busy = busyLabel === p.label;
          return (
            <View key={p.label} style={[s.shotCard, shot && s.shotCardDone]}>
              <View style={s.shotHead}>
                <Text style={s.shotNum}>{shot ? "✓" : i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.shotTitle}>{t(p.title)}</Text>
                  <Text style={s.shotHint}>{t(p.hint)}</Text>
                </View>
              </View>
              {shot ? (
                <View style={s.shotBody}>
                  <Image source={{ uri: shot.uri }} style={s.thumb} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.shotMeta}>
                      {shot.latitude != null ? `📍 ±${shot.accuracy ?? "?"} m` : "📍 —"}
                    </Text>
                    <TouchableOpacity onPress={() => capture(p.label)} disabled={!!busyLabel} style={s.linkBtn}>
                      <Text style={s.linkText}>{t("retake")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={[s.takeBtn, !!busyLabel && s.disabled]} onPress={() => capture(p.label)}
                  disabled={!!busyLabel} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.takeText}>{t("take_photo")}</Text>}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Optional short video */}
        {video ? (
          <View style={[s.videoRow, s.shotCardDone]}>
            <Text style={s.videoText}>🎥 {t("video_added")}</Text>
            <TouchableOpacity onPress={removeVideo}><Text style={[s.linkText, { color: RED }]}>{t("remove")}</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[s.videoRow, !!busyLabel && s.disabled]} onPress={() => capture("video")} disabled={!!busyLabel}>
            {busyLabel === "video" ? <ActivityIndicator color={BLUE} /> : <Text style={s.videoAdd}>{t("add_video")}</Text>}
          </TouchableOpacity>
        )}

        <TextInput
          style={s.notes}
          value={notes}
          onChangeText={v => { setNotes(v); stateRef.current.notes = v; }}
          onEndEditing={() => persist({})}
          placeholder={t("notes_ph")}
          placeholderTextColor={GRAY}
          multiline
        />

        <TouchableOpacity style={[s.saveBtn, (!complete || saving) && s.disabled]} onPress={save}
          disabled={!complete || saving} activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveText}>{complete ? t("save_visit") : t("save_need", { n: plan.length })}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 52, paddingBottom: 12,
    backgroundColor: "#0B1120", borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: BLUE, fontSize: 22, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  headerSub: { color: GRAY2, fontSize: 12, marginTop: 2 },

  content: { padding: 16, paddingBottom: 48 },

  retakeBox: {
    backgroundColor: "rgba(220,20,60,0.12)", borderWidth: 1, borderColor: "rgba(220,20,60,0.35)",
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  retakeText: { color: "#F87171", fontSize: 13, fontWeight: "700" },

  gpsPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  gpsText: { fontSize: 12, fontWeight: "700" },

  shotCard: {
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 12,
  },
  shotCardDone: { borderColor: "rgba(34,197,94,0.35)" },
  shotHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  shotNum: {
    width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28,
    backgroundColor: "rgba(37,99,235,0.18)", color: "#60A5FA", fontWeight: "800", marginRight: 10,
  },
  shotTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  shotHint: { color: GRAY2, fontSize: 12, marginTop: 3, lineHeight: 17 },
  shotBody: { flexDirection: "row", alignItems: "center" },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" },
  shotMeta: { color: GRAY2, fontSize: 12, marginBottom: 8 },

  takeBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  takeText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { color: BLUE, fontSize: 13, fontWeight: "700" },

  videoRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 12,
  },
  videoAdd: { color: "#60A5FA", fontSize: 14, fontWeight: "700" },
  videoText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  notes: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 12, color: "#fff", fontSize: 14, minHeight: 60,
    textAlignVertical: "top", marginBottom: 16,
  },

  saveBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
