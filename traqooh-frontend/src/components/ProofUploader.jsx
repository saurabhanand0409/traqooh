// Proof photo uploader for one site and one phase (Install / Audit / Takedown).
// Drag & drop, paste or browse; previews; reads each photo's own location and time from the file
// and shows how far from the site it was taken; converts iPhone HEIC; uploads 3 at a time with
// progress; failed files can be retried without re-uploading the rest.
import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import {
  MAX_VIDEO_BYTES, isHeic, isVideoFile, isImageFile, distanceM, readPhotoMeta,
  heicToJpeg, shrinkPhoto, postWithProgress, runLimited,
} from "../utils/photoUpload";
import { fmtDistance, OFFSITE_LIMIT_M } from "../utils/proofReport";
import {
  X, UploadCloud, Clock, MapPin, AlertTriangle, CheckCircle2, RotateCcw, Film, Image as ImageIcon, Info,
} from "lucide-react";

export const UPLOAD_PHASES = [
  { key: "START", activityType: "START", label: "Start / Install", color: "#2563EB" },
  { key: "MID", activityType: "AUDIT", label: "Audit", color: "#F59E0B" },
  { key: "END", activityType: "END", label: "End / Takedown", color: "#22C55E" },
];

const SHOT_OPTIONS = [
  { value: "", label: "No label" },
  { value: "close-up", label: "Close-up" },
  { value: "wide", label: "Wide" },
  { value: "landmark", label: "Landmark" },
  { value: "other", label: "Other" },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fmtTaken = (d) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtSize = (b) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
let seq = 0;
// Phones and tablets: there's nothing to drag, so the drop zone asks for a tap instead
const touchScreen = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function ProofUploader({ site, campaignId, user, initialPhase = "START", initialFiles, onClose, onUploaded }) {
  const [phase, setPhase] = useState(initialPhase);
  const [items, setItems] = useState([]);
  const [skipped, setSkipped] = useState([]);       // files we couldn't take, with the reason
  const [visitDate, setVisitDate] = useState(today());
  const [dateTouched, setDateTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const activityId = useRef(null);                  // one visit holds every photo from this upload
  const doneCount = useRef(0);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const seeded = useRef(false);                     // files dropped on the board are added once

  const patch = (key, changes) => setItems(list => list.map(it => it.key === key ? { ...it, ...changes } : it));

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const fresh = [], rejected = [];
    for (const file of files) {
      const video = isVideoFile(file);
      if (!video && !isImageFile(file)) { rejected.push(`${file.name}: only photos and videos`); continue; }
      if (video && file.size > MAX_VIDEO_BYTES) { rejected.push(`${file.name}: videos must be under 80 MB`); continue; }
      const same = (it) => it.file.name === file.name && it.file.size === file.size && it.file.lastModified === file.lastModified;
      if (itemsRef.current.some(same) || fresh.some(same)) { rejected.push(`${file.name}: already added`); continue; }
      const heic = isHeic(file);
      fresh.push({
        key: ++seq, file, video, heic,
        preview: !heic ? URL.createObjectURL(file) : null,
        converted: null, meta: video ? { takenAt: null, latitude: null, longitude: null } : null,
        label: video ? "video" : "", status: heic ? "converting" : "ready", progress: 0, error: "",
      });
    }
    setSkipped(rejected);
    if (!fresh.length) return;
    itemsRef.current = [...itemsRef.current, ...fresh];   // so a second add in the same tick sees these
    setItems(list => [...list, ...fresh]);
    for (const it of fresh) {
      if (it.video) continue;
      readPhotoMeta(it.file).then(meta => patch(it.key, { meta }));
      if (it.heic) {
        heicToJpeg(it.file)
          .then(jpg => patch(it.key, { converted: jpg, preview: URL.createObjectURL(jpg), status: "ready" }))
          .catch(() => patch(it.key, { status: "ready", error: "Couldn't convert this iPhone photo; it will upload as HEIC and may not show in some browsers" }));
      }
    }
  };

  useEffect(() => {
    if (seeded.current || !initialFiles?.length) return;
    seeded.current = true;
    addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paste photos straight from the clipboard (e.g. copied from WhatsApp Web)
  useEffect(() => {
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length && !running) { e.preventDefault(); addFiles(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // The visit date follows the photos' own date until someone changes it by hand
  useEffect(() => {
    if (dateTouched) return;
    const dates = items.map(it => it.meta?.takenAt).filter(Boolean).sort((a, b) => a - b);
    setVisitDate(dates.length ? dayOf(dates[0]) : today());
  }, [items, dateTouched]);

  const removeItem = (key) => setItems(list => {
    const it = list.find(x => x.key === key);
    if (it?.preview) URL.revokeObjectURL(it.preview);
    return list.filter(x => x.key !== key);
  });

  const hasSiteGps = site.latitude != null && site.longitude != null && !(Number(site.latitude) === 0 && Number(site.longitude) === 0);
  const distOf = (it) => it.meta?.latitude != null && hasSiteGps
    ? distanceM(it.meta.latitude, it.meta.longitude, site.latitude, site.longitude) : null;

  const phaseInfo = UPLOAD_PHASES.find(p => p.key === phase) || UPLOAD_PHASES[0];
  const pending = items.filter(it => it.status === "ready" || it.status === "failed");
  const failed = items.filter(it => it.status === "failed");
  const done = items.filter(it => it.status === "done");
  const busyConverting = items.some(it => it.status === "converting");
  const photos = items.filter(it => !it.video);
  const located = photos.filter(it => it.meta?.latitude != null);
  const far = photos.filter(it => { const d = distOf(it); return d != null && d > OFFSITE_LIMIT_M; });
  const noLocation = photos.filter(it => it.meta && it.meta.latitude == null);
  const overall = items.length ? items.reduce((s, it) => s + (it.status === "done" ? 1 : it.status === "uploading" ? it.progress : 0), 0) / items.length : 0;

  const ensureVisit = async () => {
    if (activityId.current) return activityId.current;
    const firstLocated = located[0]?.meta;
    const res = await apiFetch(`/api/activities`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId, siteId: site.siteId, assignmentId: site.assignmentId,
        activityType: phaseInfo.activityType, status: "DONE", source: "web",
        performedBy: user?.displayName || user?.email || "Team",
        activityDate: visitDate, notes: notes.trim() || null,
        latitude: firstLocated?.latitude ?? null, longitude: firstLocated?.longitude ?? null,
        createdByUserId: user?.userId || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.detail === "string" ? body.detail : `Server error ${res.status}`);
    }
    activityId.current = (await res.json()).id;
    return activityId.current;
  };

  const uploadOne = async (it) => {
    try {
      patch(it.key, { status: "uploading", progress: 0, error: "" });
      const source = it.converted || it.file;
      const payload = it.video ? source : await shrinkPhoto(source);
      const fd = new FormData();
      fd.append("file", payload, payload.name || source.name);
      if (it.label) fd.append("label", it.label);
      if (it.meta?.takenAt) fd.append("capturedAt", it.meta.takenAt.toISOString());
      if (it.meta?.latitude != null) {
        fd.append("latitude", String(it.meta.latitude));
        fd.append("longitude", String(it.meta.longitude));
      }
      await postWithProgress(`/api/activities/${activityId.current}/upload-image`, fd, p => patch(it.key, { progress: p }));
      doneCount.current += 1;
      patch(it.key, { status: "done", progress: 1 });
      return true;
    } catch (e) {
      patch(it.key, { status: "failed", error: e.message || "Upload failed" });
      return false;
    }
  };

  const startUpload = async () => {
    if (!pending.length || running) return;
    setRunning(true);
    setError("");
    try {
      await ensureVisit();
    } catch (e) {
      setError(`Couldn't start the upload: ${e.message}. Check the connection and try again.`);
      setRunning(false);
      return;
    }
    const batch = itemsRef.current.filter(it => it.status === "ready" || it.status === "failed");
    // Count outcomes here: the item list on screen may not have re-rendered yet when the last upload ends
    let failures = 0;
    await runLimited(batch, 3, async (it) => { if (!(await uploadOne(it))) failures += 1; });
    setRunning(false);
    if (failures === 0) finish({ ask: false });
  };

  // Retry one failed file from its tile
  const retryOne = async (it) => {
    setRunning(true);
    setError("");
    try {
      await ensureVisit();
      await uploadOne(it);
    } catch (e) {
      setError(`Couldn't start the upload: ${e.message}. Check the connection and try again.`);
    } finally {
      setRunning(false);
    }
  };

  // Close: report what was saved; a visit with nothing in it is removed again
  const finish = async ({ ask = true } = {}) => {
    if (running) return;
    const notSent = itemsRef.current.filter(it => it.status !== "done").length;
    if (ask && notSent && !window.confirm(`${notSent} file${notSent !== 1 ? "s haven't" : " hasn't"} been uploaded. Close anyway?`)) return;
    if (activityId.current && doneCount.current === 0) {
      apiFetch(`/api/activities/${activityId.current}`, { method: "DELETE" }).catch(() => {});
    }
    if (doneCount.current > 0) onUploaded?.({ count: doneCount.current, phase: phaseInfo });
    itemsRef.current.forEach(it => it.preview && URL.revokeObjectURL(it.preview));   // free the previews
    onClose();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!running && e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const locked = running || activityId.current != null;   // the phase and date belong to the visit once it exists

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={() => finish()}>
      <div className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col sm:rounded-2xl overflow-hidden"
        style={{ background: "#0D1428", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
        onDragOver={e => { e.preventDefault(); if (!running) setDragOver(true); }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={onDrop}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <h3 className="font-syne font-bold text-lg text-white">Add proof photos</h3>
            <p className="text-xs truncate" style={{ color: "var(--gray2)" }}>
              {site.siteName || "Site"}{site.siteCity ? ` · ${site.siteCity}` : ""}
            </p>
          </div>
          <button onClick={() => finish()} disabled={running} title={running ? "Wait for the upload to finish" : "Close"}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Phase */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--gray2)" }}>Stage</div>
            <div className="flex flex-wrap gap-1.5">
              {UPLOAD_PHASES.map(p => (
                <button key={p.key} disabled={locked} onClick={() => setPhase(p.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:cursor-not-allowed"
                  style={phase === p.key
                    ? { background: `${p.color}26`, color: "#fff", border: `1px solid ${p.color}` }
                    : { background: "rgba(255,255,255,0.04)", color: "var(--gray)", border: "1px solid var(--border)", opacity: locked ? 0.5 : 1 }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div onClick={() => !running && inputRef.current?.click()}
            className="rounded-xl px-4 py-6 text-center cursor-pointer transition"
            style={{
              border: `2px dashed ${dragOver ? "#3B82F6" : "rgba(255,255,255,0.14)"}`,
              background: dragOver ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.02)",
            }}>
            <UploadCloud className="w-8 h-8 mx-auto mb-2" style={{ color: dragOver ? "#60A5FA" : "var(--gray2)" }} />
            <div className="text-sm font-semibold text-white">{touchScreen ? "Tap to choose photos or take new ones" : "Drop photos or videos here"}</div>
            <div className="text-xs mt-1" style={{ color: "var(--gray2)" }}>
              {touchScreen ? "JPG, PNG, HEIC, MP4 · videos up to 80 MB"
                : <>or <span className="font-bold" style={{ color: "#60A5FA" }}>browse</span> · paste with Ctrl+V · JPG, PNG, HEIC, MP4 · videos up to 80 MB</>}
            </div>
            <input ref={inputRef} type="file" accept="image/*,video/*,.heic,.heif" multiple className="hidden"
              onChange={e => {
                // Copy the FileList before clearing the input: clearing empties it
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                addFiles(files);
              }} />
          </div>

          {skipped.length > 0 && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(245,158,11,0.08)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.25)" }}>
              Skipped: {skipped.join(" · ")}
            </div>
          )}

          {/* Files */}
          {items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map(it => {
                const d = distOf(it);
                const isFar = d != null && d > OFFSITE_LIMIT_M;
                return (
                  <div key={it.key} className="rounded-xl overflow-hidden flex flex-col"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${it.status === "failed" ? "rgba(220,20,60,0.5)" : it.status === "done" ? "rgba(34,197,94,0.45)" : "var(--border)"}` }}>
                    <div className="relative aspect-square bg-black">
                      {it.video ? (
                        <video src={it.preview} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      ) : it.preview ? (
                        <img src={it.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px]" style={{ color: "var(--gray2)" }}>
                          <ImageIcon className="w-6 h-6 mb-1" />{it.status === "converting" ? "Converting iPhone photo…" : "No preview"}
                        </div>
                      )}
                      {it.video && <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}><Film className="w-3 h-3" /> Video</span>}
                      {!running && it.status !== "done" && (
                        <button onClick={() => removeItem(it.key)} title="Remove"
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {it.status === "uploading" && (
                        <div className="absolute inset-x-0 bottom-0 p-1.5" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(it.progress * 100)}%`, background: "#3B82F6" }} />
                          </div>
                        </div>
                      )}
                      {it.status === "done" && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
                          <CheckCircle2 className="w-9 h-9" style={{ color: "#4ADE80" }} />
                        </div>
                      )}
                      {it.status === "failed" && (
                        <button onClick={() => !running && retryOne(it)} disabled={running}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-bold text-white"
                          style={{ background: "rgba(127,29,29,0.6)" }}>
                          <RotateCcw className="w-6 h-6" /> Retry
                        </button>
                      )}
                    </div>
                    <div className="p-2 space-y-1 text-[10.5px] leading-snug">
                      <div className="truncate font-semibold text-white" title={it.file.name}>{it.file.name}</div>
                      {!it.video && (
                        <select value={it.label} disabled={running || it.status === "done"}
                          onChange={e => patch(it.key, { label: e.target.value })}
                          className="tq-input w-full py-1 text-[11px]">
                          {SHOT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                      {it.video ? (
                        <div style={{ color: "var(--gray2)" }}>{fmtSize(it.file.size)} · no location in videos</div>
                      ) : !it.meta ? (
                        <div style={{ color: "var(--gray2)" }}>Reading photo details…</div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1" style={{ color: it.meta.takenAt ? "var(--gray)" : "var(--gray2)" }}>
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            {it.meta.takenAt ? fmtTaken(it.meta.takenAt) : "No time in file"}
                          </div>
                          <div className="flex items-center gap-1 font-semibold"
                            style={{ color: it.meta.latitude == null ? "var(--gray2)" : isFar ? "#FBBF24" : d != null ? "#4ADE80" : "var(--gray)" }}>
                            {isFar ? <AlertTriangle className="w-3 h-3 flex-shrink-0" /> : <MapPin className="w-3 h-3 flex-shrink-0" />}
                            {it.meta.latitude == null ? "No location in file"
                              : d == null ? "Location found (site has no GPS)"
                              : isFar ? `${fmtDistance(d)} from the site` : `${fmtDistance(d)} from the site ✓`}
                          </div>
                        </>
                      )}
                      {it.error && <div style={{ color: it.status === "failed" ? "#F87171" : "#FBBF24" }}>{it.error}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* What the files tell us */}
          {photos.length > 0 && (
            <div className="text-xs px-3 py-2.5 rounded-lg space-y-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--gray)" }}>
              <div>
                <b className="text-white">{located.length} of {photos.length}</b> photo{photos.length !== 1 ? "s have" : " has"} a location saved in the file
                {far.length > 0 && <> · <b style={{ color: "#FBBF24" }}>{far.length} taken more than {OFFSITE_LIMIT_M} m from the site</b></>}
                {!hasSiteGps && " · this site has no GPS saved, so distance can't be checked"}
              </div>
              {noLocation.length > 0 && (
                <div className="flex gap-1.5" style={{ color: "var(--gray2)" }}>
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span>Photos sent over WhatsApp lose their location and time. Ask the crew to send them as a <b>Document</b> in WhatsApp, or to use the TraqOOH field app, which records GPS for every shot.</span>
                </div>
              )}
              {far.length > 0 && (
                <div style={{ color: "var(--gray2)" }}>Far-away photos will upload, but the board marks them "Check this" until someone verifies them.</div>
              )}
            </div>
          )}

          {/* Visit details */}
          <div className="grid sm:grid-cols-[160px_1fr] gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Visit date</label>
              <input type="date" value={visitDate} max={today()} disabled={locked}
                onChange={e => { setVisitDate(e.target.value); setDateTouched(true); }}
                className="tq-input w-full py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--gray2)" }}>Note (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} maxLength={300}
                placeholder="e.g. Flex replaced after storm" className="tq-input w-full py-1.5 text-xs" />
            </div>
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,20,60,0.12)", border: "1px solid rgba(220,20,60,0.3)", color: "#F87171" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex-1 min-w-[160px] text-xs" style={{ color: "var(--gray2)" }}>
            {running ? (
              <div>
                <div className="mb-1 text-white font-semibold">Uploading {done.length} of {items.length}… keep this window open</div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(overall * 100)}%`, background: "linear-gradient(90deg,#2563EB,#DC143C)" }} />
                </div>
              </div>
            ) : failed.length ? (
              <span style={{ color: "#F87171" }}>{done.length} uploaded, {failed.length} failed. Retry the failed ones, or close to keep what's uploaded.</span>
            ) : items.length ? (
              `${items.length} file${items.length !== 1 ? "s" : ""} → ${phaseInfo.label}`
            ) : "Nothing added yet"}
          </div>
          <button onClick={() => finish()} disabled={running}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--gray)" }}>
            {done.length ? "Close" : "Cancel"}
          </button>
          <button onClick={startUpload} disabled={running || !pending.length || busyConverting}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#2563EB,#DC143C)" }}>
            {busyConverting ? "Preparing…" : failed.length && !running ? `Retry ${failed.length} failed` : running ? "Uploading…" : `Upload ${pending.length || ""} file${pending.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );

}
