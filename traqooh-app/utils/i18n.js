import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { getLang, saveLang } from "./storage";

// App text in English and Hindi. Keys missing in Hindi fall back to English.
const STRINGS = {
  en: {
    login_title: "Field Login",
    login_sub: "Enter the 4-digit PIN from your admin",
    login_need_pin: "Please enter your 4-digit PIN.",
    login_button: "Enter →",
    login_hint: "Don't have a PIN? Ask your site admin.",
    session_expired: "Your login has expired. Please enter your PIN again.",

    hi_name: "Hi, {name} 👋",
    sign_out: "Sign out",
    sign_out_q: "Sign out of TraqOOH?",
    sign_out_pending: "{n} visit(s) are not uploaded yet. If you sign out now they will be deleted.",
    cancel: "Cancel",
    mode_assigned: "📋 My Sites",
    mode_all: "🗺️ All Sites",
    search: "Search sites, areas…",
    sites_count: "{n} site(s)",
    loading_sites: "Loading sites…",
    no_assigned: "No sites assigned to you yet",
    no_assigned_sub: "Your admin will assign sites to you.",
    no_sites: "No sites found",
    no_sites_sub: "Try a different search",
    load_failed: "Couldn't load sites: {error}. Pull down to try again.",

    outbox_waiting: "{n} visit(s) waiting to upload",
    outbox_uploading: "Uploading {n} visit(s)…",
    outbox_retry: "Retry",
    outbox_error: "Last try: {error}",
    outbox_other_worker: "{n} visit(s) belong to {name} and will upload when they log in",
    draft_unfinished: "Unfinished visit: {activity} at {site}",
    draft_continue: "Continue",
    draft_discard: "Discard",
    draft_discard_q: "Delete the photos of this unfinished visit?",

    retake_needed: "Retake needed",
    retake_line: "{phase}: {reason}",
    retake_now: "Retake now",
    retake_no_reason: "sent back by the office",
    phase_START: "Install",
    phase_MID: "Audit",
    phase_END: "End",
    counts_line: "Install {start} · Audit {mid} · End {end}",

    log_visit: "Log a visit",
    act_MOUNTING: "Install",
    act_AUDIT: "Audit",
    act_END: "End",
    act_PRINT: "Print",
    site_details: "Site details",
    site_photos: "Site photos",
    photos_count: "{n} photo(s)",
    loading_photos: "Loading photos…",
    no_photos: "No photos yet",
    no_photos_sub: "Log a visit above to add the first photos",
    pending_here: "{n} visit(s) from this site waiting to upload",
    map: "Map →",
    monthly_rate: "Monthly rate",
    per_month: "/month",
    d_type: "Type",
    d_size: "Size",
    d_area: "Total area",
    d_lighting: "Lighting",
    d_facing: "Facing",
    d_city: "City",
    d_owner: "Owner",
    d_remarks: "Remarks",

    m_activity: "Activity",
    m_shot: "Shot",
    m_by: "Logged by",
    m_time: "Date & time",
    m_gps: "GPS",
    m_notes: "Notes",
    m_open_maps: "Open location in Google Maps →",

    shot_closeup: "Close-up",
    shot_closeup_hint: "The ad filling the frame, so the design can be read.",
    shot_wide: "Wide",
    shot_wide_hint: "The whole hoarding with its structure and surroundings.",
    shot_landmark: "Landmark",
    shot_landmark_hint: "A nearby shop sign, road or building that shows where this is.",
    shot_print: "Printed flex",
    shot_print_hint: "The printed flex, fully visible.",
    shot_video: "Video",
    shot_n_of: "Photo {i} of {n}",
    take_photo: "📷 Take photo",
    retake: "Retake",
    add_video: "🎥 Add a short video (optional)",
    video_added: "Video added",
    remove: "Remove",
    notes_ph: "Add a note (optional)…",
    gps_waiting: "Getting GPS…",
    gps_ok: "GPS ±{m} m",
    gps_weak: "GPS weak (±{m} m). Step into the open or wait a moment.",
    gps_off: "Location is off. Turn it on so photos show where they were taken.",
    camera_needed: "Camera permission is needed to take proof photos.",
    camera_failed: "Couldn't open the camera: {error}",
    save_visit: "Save visit →",
    save_need: "Take all {n} photos first",
    saved_title: "Saved",
    saved_body: "The visit will upload now, or as soon as you have internet.",
    sent_back: "Sent back: {reason}",
    recovered: "Recovered the photo you just took.",
  },
  hi: {
    login_title: "फ़ील्ड लॉगिन",
    login_sub: "अपने एडमिन से मिला 4 अंकों का PIN डालें",
    login_need_pin: "कृपया अपना 4 अंकों का PIN डालें।",
    login_button: "आगे बढ़ें →",
    login_hint: "PIN नहीं है? अपने साइट एडमिन से पूछें।",
    session_expired: "आपका लॉगिन खत्म हो गया है। कृपया PIN फिर से डालें।",

    hi_name: "नमस्ते, {name} 👋",
    sign_out: "साइन आउट",
    sign_out_q: "TraqOOH से साइन आउट करें?",
    sign_out_pending: "{n} विज़िट अभी अपलोड नहीं हुई हैं। अभी साइन आउट करने पर वे हट जाएँगी।",
    cancel: "रद्द करें",
    mode_assigned: "📋 मेरी साइटें",
    mode_all: "🗺️ सभी साइटें",
    search: "साइट या इलाका खोजें…",
    sites_count: "{n} साइटें",
    loading_sites: "साइटें लोड हो रही हैं…",
    no_assigned: "अभी आपको कोई साइट नहीं सौंपी गई है",
    no_assigned_sub: "आपके एडमिन आपको साइटें सौंपेंगे।",
    no_sites: "कोई साइट नहीं मिली",
    no_sites_sub: "कुछ और खोज कर देखें",
    load_failed: "साइटें लोड नहीं हुईं: {error}। फिर से कोशिश के लिए नीचे खींचें।",

    outbox_waiting: "{n} विज़िट अपलोड होने का इंतज़ार कर रही हैं",
    outbox_uploading: "{n} विज़िट अपलोड हो रही हैं…",
    outbox_retry: "फिर कोशिश करें",
    outbox_error: "पिछली कोशिश: {error}",
    outbox_other_worker: "{n} विज़िट {name} की हैं, उनके लॉगिन करने पर अपलोड होंगी",
    draft_unfinished: "अधूरी विज़िट: {site} पर {activity}",
    draft_continue: "जारी रखें",
    draft_discard: "हटाएँ",
    draft_discard_q: "इस अधूरी विज़िट की फ़ोटो हटा दें?",

    retake_needed: "फ़ोटो दोबारा लें",
    retake_line: "{phase}: {reason}",
    retake_now: "अभी दोबारा लें",
    retake_no_reason: "ऑफ़िस ने वापस भेजा",
    phase_START: "इंस्टॉल",
    phase_MID: "ऑडिट",
    phase_END: "समाप्ति",
    counts_line: "इंस्टॉल {start} · ऑडिट {mid} · समाप्ति {end}",

    log_visit: "विज़िट दर्ज करें",
    act_MOUNTING: "इंस्टॉल",
    act_AUDIT: "ऑडिट",
    act_END: "समाप्ति",
    act_PRINT: "प्रिंट",
    site_details: "साइट विवरण",
    site_photos: "साइट की फ़ोटो",
    photos_count: "{n} फ़ोटो",
    loading_photos: "फ़ोटो लोड हो रही हैं…",
    no_photos: "अभी कोई फ़ोटो नहीं",
    no_photos_sub: "पहली फ़ोटो जोड़ने के लिए ऊपर विज़िट दर्ज करें",
    pending_here: "इस साइट की {n} विज़िट अपलोड होने का इंतज़ार कर रही हैं",
    map: "नक्शा →",
    monthly_rate: "मासिक दर",
    per_month: "/माह",
    d_type: "प्रकार",
    d_size: "आकार",
    d_area: "कुल क्षेत्रफल",
    d_lighting: "लाइटिंग",
    d_facing: "दिशा",
    d_city: "शहर",
    d_owner: "मालिक",
    d_remarks: "टिप्पणी",

    m_activity: "काम",
    m_shot: "फ़ोटो",
    m_by: "किसने ली",
    m_time: "तारीख और समय",
    m_gps: "GPS",
    m_notes: "नोट",
    m_open_maps: "Google Maps में जगह देखें →",

    shot_closeup: "पास से",
    shot_closeup_hint: "विज्ञापन पूरे फ्रेम में, ताकि डिज़ाइन साफ़ पढ़ा जा सके।",
    shot_wide: "दूर से",
    shot_wide_hint: "पूरी होर्डिंग, ढांचे और आसपास के साथ।",
    shot_landmark: "पहचान",
    shot_landmark_hint: "पास की दुकान का बोर्ड, सड़क या इमारत, जिससे जगह पहचानी जा सके।",
    shot_print: "छपा हुआ फ्लेक्स",
    shot_print_hint: "छपा हुआ फ्लेक्स, पूरा दिखे।",
    shot_video: "वीडियो",
    shot_n_of: "फ़ोटो {i} / {n}",
    take_photo: "📷 फ़ोटो लें",
    retake: "दोबारा लें",
    add_video: "🎥 छोटा वीडियो जोड़ें (वैकल्पिक)",
    video_added: "वीडियो जुड़ गया",
    remove: "हटाएँ",
    notes_ph: "नोट लिखें (वैकल्पिक)…",
    gps_waiting: "GPS मिल रहा है…",
    gps_ok: "GPS ±{m} मी",
    gps_weak: "GPS कमज़ोर (±{m} मी)। खुले में जाएँ या थोड़ा रुकें।",
    gps_off: "लोकेशन बंद है। चालू करें ताकि फ़ोटो में जगह दर्ज हो।",
    camera_needed: "प्रूफ़ फ़ोटो लेने के लिए कैमरा की अनुमति चाहिए।",
    camera_failed: "कैमरा नहीं खुला: {error}",
    save_visit: "विज़िट सेव करें →",
    save_need: "पहले सभी {n} फ़ोटो लें",
    saved_title: "सेव हो गया",
    saved_body: "विज़िट अभी अपलोड होगी, या इंटरनेट मिलते ही।",
    sent_back: "वापस भेजी गई: {reason}",
    recovered: "अभी ली गई फ़ोटो वापस मिल गई।",
  },
};

export const LANGS = [
  { key: "en", label: "EN" },
  { key: "hi", label: "हिं" },
];

export function translate(lang, key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v ?? ""));
  }
  return s;
}

const LangContext = createContext({ lang: "en", setLang: () => {}, t: (key, vars) => translate("en", key, vars) });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    getLang().then(l => { if (l && STRINGS[l]) setLangState(l); });
  }, []);
  const setLang = useCallback((l) => {
    setLangState(l);
    saveLang(l).catch(() => {});
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

// EN | हिं switch shown on the login and home screens
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <View style={s.row}>
      {LANGS.map(l => (
        <TouchableOpacity key={l.key} onPress={() => setLang(l.key)} style={[s.chip, lang === l.key && s.chipOn]}>
          <Text style={[s.text, lang === l.key && s.textOn]}>{l.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  chipOn: { backgroundColor: "rgba(37,99,235,0.18)", borderColor: "rgba(37,99,235,0.5)" },
  text: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
  textOn: { color: "#60A5FA" },
});
