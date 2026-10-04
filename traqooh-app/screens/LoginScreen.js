import React, { useState, useRef } from "react";
import { useFonts, Syne_800ExtraBold, Syne_700Bold } from "@expo-google-fonts/syne";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { fieldLogin } from "../utils/api";
import { saveUser } from "../utils/storage";
import { LangToggle, useLang } from "../utils/i18n";
import { flush } from "../utils/outbox";
import { registerForPush } from "../utils/push";

const BG = "#070C1A";
const CARD = "#0D1428";
const BLUE = "#2563EB";
const RED = "#DC143C";
const BORDER = "rgba(255,255,255,0.10)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

export default function LoginScreen({ navigation, route }) {
  const { t, lang } = useLang();
  const [fontsLoaded] = useFonts({
    Syne_800ExtraBold, Syne_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(route?.params?.expired ? "session_expired" : "");
  const pinRefs = useRef([]);

  if (!fontsLoaded) return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  );

  const handlePinChange = (val, idx) => {
    const digit = val.replace(/[^0-9]/g, "");
    const newPin = [...pin];

    // Handle paste of full 4-digit code
    if (digit.length === 4) {
      const arr = digit.split("");
      setPin(arr);
      pinRefs.current[3]?.focus();
      return;
    }

    newPin[idx] = digit.slice(-1);
    setPin(newPin);
    if (digit && idx < 3) pinRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) pinRefs.current[idx - 1]?.focus();
  };

  const handleLogin = async () => {
    const code = pin.join("");
    if (code.length !== 4) return setError("login_need_pin");
    setError("");
    setLoading(true);
    try {
      const user = await fieldLogin(code);
      await saveUser(user);
      registerForPush(lang);   // best-effort, in the background
      flush();                 // send any visits saved while logged out
      navigation.replace("Home", { user });
    } catch (e) {
      setError(e.message);
      setPin(["", "", "", ""]);
      pinRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <LinearGradient
            colors={["#2563EB", "#DC143C"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.logoBox}
          >
            <Text style={s.logoText}>tq</Text>
          </LinearGradient>
          <View style={{ alignItems: "center" }}>
            {/* traqOOH */}
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={[s.brandWord, { color: BLUE }]}>traq</Text>
              <Text style={[s.brandWord, { color: RED }]}>OOH</Text>
            </View>
            {/* by BRANDSCULPT */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
              <Text style={s.brandBy}>by </Text>
              <Text style={[s.brandSculptWord, { color: BLUE }]}>BRAND</Text>
              <Text style={[s.brandSculptWord, { color: RED }]}>SCULPT</Text>
            </View>
          </View>
        </View>

        {/* Card */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>{t("login_title")}</Text>
            <LangToggle />
          </View>
          <Text style={s.cardSub}>{t("login_sub")}</Text>

          {error ? (
            <View style={s.errBox}>
              {/* Our own messages are keys; server messages are shown as they are */}
              <Text style={s.errText}>{t(error)}</Text>
            </View>
          ) : null}

          {/* PIN boxes */}
          <View style={s.pinRow}>
            {pin.map((digit, i) => (
              <TextInput
                key={i}
                ref={r => pinRefs.current[i] = r}
                style={[s.pinBox, digit ? s.pinBoxFilled : null]}
                value={digit}
                onChangeText={v => handlePinChange(v, i)}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
                textAlign="center"
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace" && !digit && i > 0) {
                    pinRefs.current[i - 1]?.focus();
                  }
                }}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>{t("login_button")}</Text>
            }
          </TouchableOpacity>

          <Text style={s.hint}>{t("login_hint")}</Text>
        </View>

        <Text style={s.footer}>TraqOOH · Outdoor Intelligence Platform</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },

  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#8B2FC9", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16,
    elevation: 12,
  },
  logoText: { fontSize: 30, fontFamily: "Syne_800ExtraBold", color: "#fff", letterSpacing: 2 },
  brandWord: { fontSize: 22, fontFamily: "Syne_800ExtraBold", letterSpacing: 1 },
  brandBy: { fontSize: 9, color: GRAY, fontFamily: "Inter_400Regular", letterSpacing: 0.5 },
  brandSculptWord: { fontSize: 9, fontFamily: "Inter_400Regular", letterSpacing: 2 },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  cardSub: { fontSize: 13, color: GRAY2, marginBottom: 28, lineHeight: 20 },

  errBox: {
    backgroundColor: "rgba(220,20,60,0.12)",
    borderWidth: 1, borderColor: "rgba(220,20,60,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 20,
  },
  errText: { color: "#F87171", fontSize: 13 },

  pinRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28, gap: 12 },
  pinBox: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2, borderColor: BORDER,
    color: "#fff", fontSize: 32, fontWeight: "800",
    textAlign: "center",
  },
  pinBoxFilled: {
    borderColor: BLUE,
    backgroundColor: "rgba(37,99,235,0.15)",
  },

  btn: {
    borderRadius: 14, padding: 16, alignItems: "center",
    backgroundColor: BLUE,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  hint: { textAlign: "center", color: GRAY, fontSize: 12, marginTop: 16 },

  footer: { textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: 11, marginTop: 32 },
});
