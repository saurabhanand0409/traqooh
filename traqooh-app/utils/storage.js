import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "tq_user";
const LANG_KEY = "tq_lang";

export async function saveUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  try {
    const val = await AsyncStorage.getItem(USER_KEY);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

// A saved field login stays usable until its PIN expires (30 days), so workers
// don't re-enter the PIN every time they open the app.
export function isSessionValid(user) {
  if (!user || !user.token || user.role !== "FIELD") return false;
  if (user.expiresAt) {
    const s = String(user.expiresAt);
    // Older logins sent the expiry without a time zone; it is UTC
    const exp = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
    if (!isNaN(exp) && exp <= Date.now()) return false;
  }
  return true;
}

export async function getLang() {
  try {
    return await AsyncStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export async function saveLang(lang) {
  await AsyncStorage.setItem(LANG_KEY, lang);
}
