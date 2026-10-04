import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { EAS_PROJECT_ID, PUSH_ENABLED } from "./config";
import { registerPushToken, unregisterPushToken } from "./api";

// "New site assigned" and "Retake needed" alerts from the backend (notifications.py).
// Off until Firebase is set up (see PUSH_ENABLED in config.js); every step is
// best-effort so a phone without Play Services still works normally.

const TOKEN_KEY = "tq_push_token";

// Loaded only when push is on: the module starts push work as soon as it loads,
// which Expo Go reports as an error and builds without Firebase don't need.
const Notifications = PUSH_ENABLED ? require("expo-notifications") : null;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPush(language) {
  if (!Notifications) return null;
  try {
    if (Platform.OS === "android") {
      // The backend sends on the "default" channel; Android asks for permission once a channel exists
      await Notifications.setNotificationChannelAsync("default", {
        name: "TraqOOH",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    await registerPushToken(token, language);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterFromPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await unregisterPushToken(token);
  } catch { /* the token simply stays until it expires */ }
}
