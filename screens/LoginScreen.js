import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { sendOtp, verifyOtp } from "../utils/api";
import { saveUser } from "../utils/storage";

const BG = "#070C1A";
const CARD = "#0D1428";
const BLUE = "#2563EB";
const RED = "#DC143C";
const BORDER = "rgba(255,255,255,0.10)";
const GRAY = "#6B7280";
const GRAY2 = "#9CA3AF";

export default function LoginScreen({ navigation }) {
  const [step, setStep] = useState("email"); // "email" | "otp"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  const startResendTimer = () => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return setError("Please enter a valid email address.");
    setError(""); setLoading(true);
    try {
      await sendOtp(trimmed);
      setStep("otp");
      startResendTimer();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, idx) => {
    const digits = val.replace(/[^0-9]/g, "");
    const newOtp = [...otp];

    // Handle paste of full 6-digit code
    if (digits.length === 6) {
      const arr = digits.split("");
      setOtp(arr);
      otpRefs.current[5]?.focus();
      return;
    }

    newOtp[idx] = digits.slice(-1);
    setOtp(newOtp);
    if (digits && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digits && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) return setError("Please enter the 6-digit code.");
    setError(""); setLoading(true);
    try {
      const user = await verifyOtp(email.trim().toLowerCase(), code);
      await saveUser(user);
      navigation.replace("Home", { user });
    } catch (e) {
      setError(e.message);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(""); setOtp(["", "", "", "", "", ""]); setLoading(true);
    try {
      await sendOtp(email.trim().toLowerCase());
      startResendTimer();
    } catch (e) {
      setError(e.message);
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
          <View style={s.logoBox}>
            <Text style={s.logoText}>tq</Text>
          </View>
          <Text style={s.brandName}>
            <Text style={{ color: BLUE }}>traq</Text>
            <Text style={{ color: RED }}>OOH</Text>
          </Text>
          <Text style={s.brandSub}>BY BRANDSCULPT</Text>
        </View>

        {/* Card */}
        <View style={s.card}>

          {step === "email" ? (
            <>
              <Text style={s.cardTitle}>Sign In</Text>
              <Text style={s.cardSub}>Enter your registered email to receive a login code</Text>

              {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}

              <Text style={s.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={t => { setEmail(t); setError(""); }}
                placeholder="your@email.com"
                placeholderTextColor={GRAY}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSendOtp}
                returnKeyType="send"
              />

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Send OTP →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.cardTitle}>Enter OTP</Text>
              <Text style={s.cardSub}>
                6-digit code sent to{"\n"}
                <Text style={{ color: BLUE }}>{email}</Text>
              </Text>

              {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}

              {/* OTP boxes */}
              <View style={s.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={r => otpRefs.current[i] = r}
                    style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={v => handleOtpChange(v, i)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    textAlign="center"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Verify & Sign In</Text>
                }
              </TouchableOpacity>

              {/* Resend */}
              <View style={s.resendRow}>
                <Text style={s.resendText}>Didn't receive it? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                  <Text style={[s.resendLink, resendTimer > 0 && { color: GRAY }]}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Change email */}
              <TouchableOpacity onPress={() => { setStep("email"); setError(""); setOtp(["","","","","",""]); }} style={s.changeEmail}>
                <Text style={s.changeEmailText}>← Change email</Text>
              </TouchableOpacity>
            </>
          )}
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
    width: 64, height: 64, borderRadius: 18,
    background: undefined,
    backgroundColor: BLUE,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16,
  },
  logoText: { fontSize: 22, fontWeight: "900", color: "#fff" },
  brandName: { fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  brandSub: { fontSize: 10, color: GRAY, letterSpacing: 3, marginTop: 2, fontWeight: "600" },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6 },
  cardSub: { fontSize: 13, color: GRAY2, marginBottom: 24, lineHeight: 20 },

  errBox: {
    backgroundColor: "rgba(220,20,60,0.12)",
    borderWidth: 1, borderColor: "rgba(220,20,60,0.3)",
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errText: { color: "#F87171", fontSize: 13 },

  label: { fontSize: 10, fontWeight: "700", color: GRAY, letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14,
    color: "#fff", fontSize: 15,
    marginBottom: 20,
  },

  btn: {
    borderRadius: 14, padding: 16, alignItems: "center",
    backgroundColor: BLUE,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  otpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  otpBox: {
    width: 46, height: 56, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
    color: "#fff", fontSize: 22, fontWeight: "800",
    textAlign: "center",
  },
  otpBoxFilled: {
    borderColor: BLUE,
    backgroundColor: "rgba(37,99,235,0.12)",
  },

  resendRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  resendText: { color: GRAY, fontSize: 13 },
  resendLink: { color: BLUE, fontSize: 13, fontWeight: "700" },

  changeEmail: { alignItems: "center", marginTop: 12 },
  changeEmailText: { color: GRAY, fontSize: 13 },

  footer: { textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: 11, marginTop: 32 },
});
