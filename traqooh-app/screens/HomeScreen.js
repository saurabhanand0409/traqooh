import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import SiteCard from "../components/SiteCard";
import { fetchMyAssignedSites, fetchVendorSites } from "../utils/api";
import { clearUser } from "../utils/storage";
import { LangToggle, useLang } from "../utils/i18n";
import { clearAll, discardDraft, flush, subscribe } from "../utils/outbox";
import { unregisterFromPush } from "../utils/push";

const BG = "#070C1A";
const NAV = "#0B1120";
const BLUE = "#2563EB";
const RED = "#DC143C";
const AMBER = "#F59E0B";
const BORDER = "rgba(255,255,255,0.08)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

export default function HomeScreen({ navigation, route }) {
  const user = route.params?.user || {};
  const { t } = useLang();

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("assigned"); // "assigned" | "all"
  const [queue, setQueue] = useState({ outbox: [], drafts: [], uploading: false });

  useEffect(() => subscribe(setQueue), []);

  const loadSites = useCallback(async (m) => {
    try {
      const data = m === "assigned" ? await fetchMyAssignedSites() : await fetchVendorSites(user.vendorId);
      setSites(data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user.vendorId]);

  // Reload when coming back from a site, so retakes and photo counts are current
  useFocusEffect(useCallback(() => { loadSites(mode); }, [loadSites, mode]));

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setLoading(true);
    setSites([]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    flush({ force: true });
    await loadSites(mode);
    setRefreshing(false);
  };

  const mine = queue.outbox.filter(v => !v.workerName || v.workerName === user.workerName);
  const others = queue.outbox.filter(v => v.workerName && v.workerName !== user.workerName);
  const lastError = mine.find(v => v.error)?.error;

  const handleSignOut = () => {
    const pending = queue.outbox.length + queue.drafts.length;
    Alert.alert(t("sign_out_q"), pending ? t("sign_out_pending", { n: pending }) : undefined, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("sign_out"), style: "destructive",
        onPress: async () => {
          await unregisterFromPush();
          await clearAll();
          await clearUser();
          navigation.replace("Login");
        },
      },
    ]);
  };

  const continueDraft = (d) => {
    navigation.navigate("Capture", { site: d.site, activityKey: d.activityKey, user, draft: d, retakeReason: d.retakeReason });
  };

  const askDiscardDraft = (d) => {
    Alert.alert(t("draft_discard_q"), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("draft_discard"), style: "destructive", onPress: () => discardDraft(d.clientVisitId) },
    ]);
  };

  const filtered = sites.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q)
      || s.areaLocality?.toLowerCase().includes(q) || s.campaignName?.toLowerCase().includes(q);
  });

  const renderHeader = () => (
    <View>
      {/* Visits saved on the phone, not yet on the server */}
      {mine.length > 0 && (
        <View style={s.outbox}>
          <View style={{ flex: 1 }}>
            <Text style={s.outboxText}>
              ⏫ {queue.uploading ? t("outbox_uploading", { n: mine.length }) : t("outbox_waiting", { n: mine.length })}
            </Text>
            {lastError && !queue.uploading ? <Text style={s.outboxErr}>{t("outbox_error", { error: lastError })}</Text> : null}
          </View>
          {queue.uploading
            ? <ActivityIndicator size="small" color={AMBER} />
            : <TouchableOpacity onPress={() => flush({ force: true })} style={s.outboxBtn}>
                <Text style={s.outboxBtnText}>{t("outbox_retry")}</Text>
              </TouchableOpacity>}
        </View>
      )}
      {others.length > 0 && (
        <Text style={s.othersText}>{t("outbox_other_worker", { n: others.length, name: others[0].workerName })}</Text>
      )}

      {/* Visits started but not saved (e.g. the app was closed mid-visit) */}
      {queue.drafts.filter(d => !d.workerName || d.workerName === user.workerName).map(d => (
        <View key={d.clientVisitId} style={s.draft}>
          <Text style={s.draftText}>
            📝 {t("draft_unfinished", { activity: t(`act_${d.activityKey}`), site: d.site?.name || "" })}
          </Text>
          <View style={s.draftBtns}>
            <TouchableOpacity onPress={() => continueDraft(d)} style={s.draftBtn}>
              <Text style={s.draftBtnText}>{t("draft_continue")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => askDiscardDraft(d)} style={[s.draftBtn, s.draftBtnGhost]}>
              <Text style={[s.draftBtnText, { color: GRAY2 }]}>{t("draft_discard")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={s.modeRow}>
        {[{ k: "assigned", label: t("mode_assigned") }, { k: "all", label: t("mode_all") }].map(m => (
          <TouchableOpacity key={m.k} style={[s.modeChip, mode === m.k && s.modeChipActive]} onPress={() => switchMode(m.k)}>
            <Text style={[s.modeText, mode === m.k && s.modeTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t("search")}
          placeholderTextColor={GRAY}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={s.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={s.errorText}>{t("load_failed", { error })}</Text> : null}
      <Text style={s.resultsText}>{t("sites_count", { n: filtered.length })}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={[s.headerBrand, { color: BLUE }]}>traq</Text>
            <Text style={[s.headerBrand, { color: RED }]}>OOH</Text>
          </View>
          <Text style={s.headerSub} numberOfLines={1}>{t("hi_name", { name: user.workerName || "" })}</Text>
        </View>
        <LangToggle />
        <TouchableOpacity onPress={handleSignOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>{t("sign_out")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={s.loadingText}>{t("loading_sites")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.assignmentId ?? item.id)}
          renderItem={({ item }) => (
            <SiteCard
              site={item}
              assigned={mode === "assigned"}
              onPress={() => navigation.navigate("SiteDetail", { site: item, user })}
            />
          )}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            error ? null : (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>{mode === "assigned" ? "📋" : "🏙️"}</Text>
                <Text style={s.emptyText}>{mode === "assigned" ? t("no_assigned") : t("no_sites")}</Text>
                <Text style={s.emptySubText}>{mode === "assigned" ? t("no_assigned_sub") : t("no_sites_sub")}</Text>
              </View>
            )
          }
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    backgroundColor: NAV,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerBrand: { fontSize: 22, fontWeight: "900" },
  headerSub: { fontSize: 12, color: GRAY2, marginTop: 1 },
  signOutBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
  },
  signOutText: { color: GRAY, fontSize: 12 },

  outbox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  outboxText: { color: "#FBBF24", fontSize: 13, fontWeight: "700" },
  outboxErr: { color: GRAY2, fontSize: 11, marginTop: 3 },
  outboxBtn: { backgroundColor: AMBER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  outboxBtnText: { color: "#1A1200", fontSize: 12, fontWeight: "800" },
  othersText: { color: GRAY2, fontSize: 12, marginBottom: 12 },

  draft: {
    backgroundColor: "rgba(37,99,235,0.08)", borderWidth: 1, borderColor: "rgba(37,99,235,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  draftText: { color: "#93C5FD", fontSize: 13, fontWeight: "700", marginBottom: 10 },
  draftBtns: { flexDirection: "row", gap: 8 },
  draftBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  draftBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: BORDER },
  draftBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  modeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  modeChip: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: BORDER,
  },
  modeChipActive: { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.45)" },
  modeText: { fontSize: 13, color: GRAY, fontWeight: "700" },
  modeTextActive: { color: BLUE },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 11 },
  clearBtn: { color: GRAY, fontSize: 14, padding: 4 },

  errorText: { color: "#F87171", fontSize: 12, marginBottom: 8 },
  resultsText: { fontSize: 12, color: GRAY, marginBottom: 8 },

  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: GRAY2, marginTop: 12, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySubText: { color: GRAY, fontSize: 13, marginTop: 4 },
});
