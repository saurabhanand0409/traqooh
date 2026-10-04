import { Platform } from "react-native";
import { File } from "expo-file-system";
import { API_BASE, APP_VERSION } from "./config";
import { getUser } from "./storage";

// Every call except login sends the worker's login token; the API refuses field
// requests without it. A 401 means the PIN expired or was revoked: App.js then
// sends the worker back to the login screen.
let onAuthExpired = null;
export function setAuthExpiredHandler(fn) {
  onAuthExpired = fn;
}

export class ApiError extends Error {
  // status 0 = no connection / timed out: worth retrying later.
  // `detail` keeps the technical reason (shown in the outbox banner for support).
  constructor(message, status, detail) {
    super(detail ? `${message} (${detail})` : message);
    this.status = status;
  }
}

async function request(path, { method = "GET", json, body, auth = true, timeoutMs = 30000 } = {}) {
  const headers = { Accept: "application/json" };
  if (auth) {
    const user = await getUser();
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
  }
  let payload = body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(json);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal: controller.signal });
  } catch (e) {
    const timedOut = e?.name === "AbortError";
    throw new ApiError(timedOut ? "Timed out" : "No internet connection", 0, timedOut ? null : e?.message);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && auth) onAuthExpired?.();
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(detail, res.status);
  }
  return data;
}

export function fieldLogin(pin) {
  return request("/api/auth/field-login", { method: "POST", json: { pin }, auth: false });
}

// Sites this worker is assigned to monitor, with photo counts per phase and any retakes
export async function fetchMyAssignedSites() {
  const data = await request("/api/mobile/my-sites");
  return Array.isArray(data) ? data : [];
}

// All of the worker's vendor's sites ("All Sites" tab)
export async function fetchVendorSites(vendorId) {
  const data = await request(`/api/sites${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ""}`);
  return Array.isArray(data) ? data : [];
}

export function fetchSiteGallery(siteId) {
  return request(`/api/sites/${siteId}/gallery`);
}

// One site visit: its photos (and optional video) with each shot's own time and GPS.
// clientVisitId makes retries safe: the server never stores the same visit twice.
export function uploadVisit(visit) {
  const form = new FormData();
  form.append("siteId", String(visit.siteId));
  form.append("activityType", visit.activityType);
  if (visit.campaignId != null) form.append("campaignId", String(visit.campaignId));
  if (visit.assignmentId != null) form.append("assignmentId", String(visit.assignmentId));
  if (visit.performedBy) form.append("performedBy", visit.performedBy);
  if (visit.notes) form.append("notes", visit.notes);
  form.append("clientVisitId", visit.clientVisitId);
  form.append("captureSource", "CAMERA_INAPP");
  form.append("appVersion", APP_VERSION);

  // Visit-level time and GPS (the first shot's) for anything that reads one value per visit
  const first = visit.shots[0];
  if (first?.capturedAt) form.append("capturedAt", first.capturedAt);
  const located = visit.shots.find(s => s.latitude != null && s.longitude != null);
  if (located) {
    form.append("latitude", String(located.latitude));
    form.append("longitude", String(located.longitude));
    if (located.accuracy != null) form.append("gpsAccuracyM", String(located.accuracy));
  }

  form.append("labels", JSON.stringify(visit.shots.map(s => s.label)));
  form.append("shots", JSON.stringify(visit.shots.map(s => ({
    label: s.label,
    capturedAt: s.capturedAt,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracy: s.accuracy,
  }))));
  // Expo SDK 56's fetch only takes Blob-like files (expo-file-system's File), not
  // React Native's { uri, name, type } objects; the part's filename and type come from the file.
  for (const s of visit.shots) {
    form.append("files", new File(s.uri));
  }
  // Videos on mobile data can take a while
  return request("/api/activities/mobile/log", { method: "POST", body: form, timeoutMs: 10 * 60 * 1000 });
}

export function registerPushToken(token, language) {
  return request("/api/mobile/push-token", { method: "POST", json: { token, platform: Platform.OS, language } });
}

export function unregisterPushToken(token) {
  return request("/api/mobile/push-token", { method: "DELETE", json: { token } });
}
