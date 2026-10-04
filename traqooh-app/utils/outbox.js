import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { uploadVisit, ApiError } from "./api";
import { getUser } from "./storage";

// Offline-first visits.
// - While a visit is being captured it is a *draft*: every photo is copied into the
//   app's own storage at once, so it survives the phone killing the app mid-visit.
// - A saved visit goes into the *outbox* and is uploaded now, or later when there is
//   internet (app start, app back in front, every minute, pull to refresh).
// Each visit carries a clientVisitId, so a retry after a dropped connection never
// creates a duplicate on the server.

const OUTBOX_KEY = "tq_outbox";
const DRAFTS_KEY = "tq_drafts";

let outbox = null;
let drafts = null;
let flushing = null;
const listeners = new Set();

export function newVisitId() {
  return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadOutbox() {
  if (outbox) return outbox;
  try { outbox = JSON.parse(await AsyncStorage.getItem(OUTBOX_KEY)) || []; } catch { outbox = []; }
  return outbox;
}

async function loadDrafts() {
  if (drafts) return drafts;
  try { drafts = JSON.parse(await AsyncStorage.getItem(DRAFTS_KEY)) || {}; } catch { drafts = {}; }
  return drafts;
}

function emit() {
  const state = { outbox: [...(outbox || [])], drafts: Object.values(drafts || {}), uploading: !!flushing };
  listeners.forEach(fn => fn(state));
}

async function saveOutbox() {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  emit();
}

async function saveDrafts() {
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  emit();
}

// listener({ outbox, drafts, uploading }) is called now and on every change
export function subscribe(fn) {
  listeners.add(fn);
  Promise.all([loadOutbox(), loadDrafts()]).then(emit);
  return () => listeners.delete(fn);
}

function visitDir(visitId) {
  return new Directory(Paths.document, "visits", visitId);
}

// Copy a camera file into the visit's folder; returns the new file's uri
export function keepFile(visitId, uri, name) {
  try {
    const dir = visitDir(visitId);
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, name);
    if (dest.exists) dest.delete();
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri; // keep using the camera's own file
  }
}

function removeVisitFiles(visitId) {
  try {
    const dir = visitDir(visitId);
    if (dir.exists) dir.delete();
  } catch { /* nothing to clean up */ }
}

// ---- drafts ----
export async function getDrafts() {
  return Object.values(await loadDrafts());
}

export async function saveDraft(draft) {
  await loadDrafts();
  drafts[draft.clientVisitId] = { ...draft, updatedAt: new Date().toISOString() };
  await saveDrafts();
}

export async function discardDraft(visitId, { keepFiles = false } = {}) {
  await loadDrafts();
  delete drafts[visitId];
  if (!keepFiles) removeVisitFiles(visitId);
  await saveDrafts();
}

// ---- outbox ----
export async function getOutbox() {
  return [...(await loadOutbox())];
}

export async function addVisit(visit) {
  await loadOutbox();
  outbox.push({ ...visit, queuedAt: new Date().toISOString(), attempts: 0, error: null, failed: false });
  await saveOutbox();
  await discardDraft(visit.clientVisitId, { keepFiles: true });
  flush();
}

export async function discardVisit(visitId) {
  await loadOutbox();
  outbox = outbox.filter(v => v.clientVisitId !== visitId);
  removeVisitFiles(visitId);
  await saveOutbox();
}

// Sign-out on a shared phone: the next worker must not upload this worker's visits
export async function clearAll() {
  await Promise.all([loadOutbox(), loadDrafts()]);
  [...outbox.map(v => v.clientVisitId), ...Object.keys(drafts)].forEach(removeVisitFiles);
  outbox = [];
  drafts = {};
  await AsyncStorage.multiRemove([OUTBOX_KEY, DRAFTS_KEY]);
  emit();
}

// Upload whatever is waiting. Stops at the first connection problem; visits the
// server refused (e.g. site deleted) are marked failed and skipped until `force`.
export function flush({ force = false } = {}) {
  if (flushing) return flushing;
  flushing = uploadWaiting(force).finally(() => {
    flushing = null;
    emit();
  });
  emit();
  return flushing;
}

async function uploadWaiting(force) {
  await loadOutbox();
  const user = await getUser();
  if (!user?.token || outbox.length === 0) return;
  for (const v of [...outbox]) {
    if (v.workerName && user.workerName && v.workerName !== user.workerName) continue;
    if (v.failed && !force) continue;
    try {
      await uploadVisit(v);
      outbox = outbox.filter(x => x.clientVisitId !== v.clientVisitId);
      removeVisitFiles(v.clientVisitId);
      await saveOutbox();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      console.warn(`Visit ${v.clientVisitId} not uploaded: ${e.message}`);
      Object.assign(v, {
        attempts: (v.attempts || 0) + 1,
        error: e.message,
        lastTriedAt: new Date().toISOString(),
        failed: status >= 400 && status < 500 && ![401, 408, 429].includes(status),
      });
      await saveOutbox();
      if (!v.failed) break; // offline, logged out or server trouble: try again later
    }
  }
}
