// Helpers for the proof photo uploader (components/ProofUploader.jsx):
// read where and when a photo was taken from the file itself, convert iPhone HEIC photos,
// shrink photos before upload, and upload with a progress callback.
import { API_BASE, getToken } from "./apiFetch";

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export const isHeic = (file) => /image\/hei[cf]/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
export const isVideoFile = (file) => (file.type || "").startsWith("video/") || /\.(mp4|mov|m4v|3gp|webm)$/i.test(file.name || "");
export const isImageFile = (file) => (file.type || "").startsWith("image/") || isHeic(file) || /\.(jpe?g|png|webp)$/i.test(file.name || "");

// Distance in metres between two GPS points (haversine), or null if either is missing.
export function distanceM(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || v === "" || isNaN(Number(v)))) return null;
  if (Number(lat2) === 0 && Number(lng2) === 0) return null;
  const rad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// When and where the photo was taken, from the EXIF data the camera saved in the file.
// Photos forwarded over WhatsApp (or edited in some apps) have this stripped: then both are null.
export async function readPhotoMeta(file) {
  const none = { takenAt: null, latitude: null, longitude: null };
  if (!isImageFile(file)) return none;
  try {
    const { default: exifr } = await import("exifr");
    const tags = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false });
    if (!tags) return none;
    const taken = tags.DateTimeOriginal || tags.CreateDate || tags.DateTimeDigitized || null;
    const lat = Number(tags.latitude), lng = Number(tags.longitude);
    const located = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    return {
      takenAt: taken instanceof Date && !isNaN(taken.getTime()) ? taken : null,
      latitude: located ? lat : null,
      longitude: located ? lng : null,
    };
  } catch {
    return none;
  }
}

// iPhone HEIC photos can't be shown by most browsers, so convert them to JPEG before upload.
// The converter is large, so it only loads when a HEIC file turns up.
export async function heicToJpeg(file) {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
}

// Shrink a photo so its longer side is at most maxEdge px (sharp enough to zoom into a hoarding,
// a fraction of the original size). Keeps the original when it is already smaller.
export function shrinkPhoto(file, maxEdge = 2048, quality = 0.82) {
  return new Promise((resolve) => {
    if (!(file.type || "").startsWith("image/") || file.type === "image/gif") { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// POST a FormData to the API with upload progress (fetch can't report upload progress).
// Resolves with the JSON body; rejects with the server's message.
export function postWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else if (xhr.status === 401) reject(new Error("Your login has expired. Log in again and retry."));
      else reject(new Error(typeof body?.detail === "string" ? body.detail : `Server error ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("No connection — check the internet and retry"));
    xhr.ontimeout = () => reject(new Error("Took too long — retry on a better connection"));
    xhr.send(formData);
  });
}

// Run async jobs with at most `limit` at a time.
export async function runLimited(items, limit, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}
