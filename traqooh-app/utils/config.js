import Constants from "expo-constants";

// EXPO_PUBLIC_API_BASE=http://localhost:8000 points a dev build at a local test backend
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://traqooh-backend-python.onrender.com";

// Sent with every upload so the backend knows which app build took a photo
export const APP_VERSION = Constants.expoConfig?.version || "2.0.0";
export const EAS_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

// Push notifications need Firebase on Android. app.config.js switches this on
// when google-services.json is present, so builds without it never ask for permission.
export const PUSH_ENABLED = !!Constants.expoConfig?.extra?.pushEnabled;
