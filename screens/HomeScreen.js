import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import SiteCard from "../components/SiteCard";
import { fetchNearbySites, fetchAllSites } from "../utils/api";
import { clearUser } from "../utils/storage";

const BG = "#070C1A";
const NAV = "#0B1120";
const BLUE = "#2563EB";
const RED = "#DC143C";
const BORDER = "rgba(255,255,255,0.08)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

export default function HomeScreen({ navigation, route }) {
  const user = route.params?.user || {};

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(null);
  const [state, setState] = useState(null);
  const [locStatus, setLocStatus] = useState("detecting"); // "detecting"|"found"|"denied"|"error"
  const [filterAvail, setFilterAvail] = useState("ALL"); // ALL|AVAILABLE|OCCUPIED

  const detectLocation = useCallback(async () => {
    setLocStatus("detecting");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocStatus("denied");
        loadSites(null, null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const detectedCity = geo?.city || geo?.subregion || null;
      const detectedState = geo?.region || null;
      setCity(detectedCity);
      setState(detectedState);
      setLocStatus("found");
      loadSites(detectedCity, detectedState);
    } catch (e) {
      setLocStatus("error");
      loadSites(null, null);
    }
  }, []);

  const loadSites = async (cityName, stateName) => {
    setLoading(true);
    try {
      let data;
      if (cityName) {
        data = await fetchNearbySites(cityName, stateName);
        // If no sites found in city, fall back to all
        if (data.length === 0) data = await fetchAllSites();
      } else {
        data = await fetchAllSites();
      }
      setSites(data);
    } catch (e) {
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSites(city, state);
    setRefreshing(false);
  };

  useEffect(() => { detectLocation(); }, [detectLocation]);

  const filtered = sites.filter(s => {
    const matchSearch = !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase()) ||
      s.areaLocality?.toLowerCase().includes(search.toLowerCase());
    const matchAvail = filterAvail === "ALL" || s.availabilityStatus === filterAvail;
    return matchSearch && matchAvail;
  });

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => { await clearUser(); navigation.replace("Login"); }
      },
    ]);
  };

  const renderHeader = () => (
    <View>
      {/* Location banner */}
      <View style={s.locBanner}>
        {locStatus === "detecting" && (
          <><ActivityIndicator size="small" color={BLUE} style={{ marginRight: 8 }} />
          <Text style={s.locText}>Detecting your location…</Text></>
        )}
        {locStatus === "found" && city && (
          <><Text style={s.locIcon}>📍</Text>
          <Text style={s.locText}>Showing sites near <Text style={{ color: BLUE, fontWeight: "700" }}>{city}</Text></Text></>
        )}
        {locStatus === "denied" && (
          <><Text style={s.locIcon}>⚠️</Text>
          <Text style={s.locText}>Location denied — showing all sites</Text>
          <TouchableOpacity onPress={detectLocation} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity></>
        )}
        {locStatus === "error" && (
          <><Text style={s.locIcon}>⚠️</Text>
          <Text style={s.locText}>Location unavailable — showing all sites</Text></>
        )}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search sites, areas…"
          placeholderTextColor={GRAY}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={s.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {["ALL", "AVAILABLE", "OCCUPIED"].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filterAvail === f && s.filterChipActive]}
            onPress={() => setFilterAvail(f)}
          >
            <Text style={[s.filterText, filterAvail === f && s.filterTextActive]}>
              {f === "ALL" ? `All (${sites.length})` : f === "AVAILABLE" ? `Available (${sites.filter(s => s.availabilityStatus === "AVAILABLE").length})` : `Occupied (${sites.filter(s => s.availabilityStatus === "OCCUPIED").length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results count */}
      <Text style={s.resultsText}>
        {filtered.length} site{filtered.length !== 1 ? "s" : ""} found
      </Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerBrand}>
            <Text style={{ color: BLUE }}>traq</Text><Text style={{ color: RED }}>OOH</Text>
          </Text>
          <Text style={s.headerSub}>Hi, {user.displayName || user.email?.split("@")[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={s.loadingText}>Loading sites…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <SiteCard
              site={item}
              onPress={() => navigation.navigate("SiteDetail", { site: item })}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏙️</Text>
              <Text style={s.emptyText}>No sites found{city ? ` in ${city}` : ""}</Text>
              <Text style={s.emptySubText}>Try changing your search or filters</Text>
            </View>
          }
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
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

  locBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(37,99,235,0.07)",
    borderRadius: 12, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(37,99,235,0.15)",
  },
  locIcon: { marginRight: 6, fontSize: 14 },
  locText: { fontSize: 12, color: GRAY2, flex: 1 },
  retryBtn: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: BLUE, borderRadius: 6 },
  retryText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 11 },
  clearBtn: { color: GRAY, fontSize: 14, padding: 4 },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: BORDER,
  },
  filterChipActive: {
    backgroundColor: "rgba(37,99,235,0.15)",
    borderColor: "rgba(37,99,235,0.4)",
  },
  filterText: { fontSize: 12, color: GRAY, fontWeight: "600" },
  filterTextActive: { color: BLUE },

  resultsText: { fontSize: 12, color: GRAY, marginBottom: 8 },

  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: GRAY2, marginTop: 12, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySubText: { color: GRAY, fontSize: 13, marginTop: 4 },
});
