const API_BASE = "https://traqooh-backend-python.onrender.com";

export async function sendOtp(email) {
  const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
  return data;
}

export async function verifyOtp(email, otp) {
  const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Invalid OTP");
  return data;
}

export async function fetchNearbySites(city, state) {
  const params = new URLSearchParams();
  if (city) params.append("city", city);
  if (state) params.append("state", state);
  const res = await fetch(`${API_BASE}/api/sites/nearby?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch sites");
  return res.json();
}

export async function fetchAllSites() {
  const res = await fetch(`${API_BASE}/api/sites`);
  if (!res.ok) throw new Error("Failed to fetch sites");
  return res.json();
}

export async function fetchSiteGallery(siteId) {
  const res = await fetch(`${API_BASE}/api/sites/${siteId}/gallery`);
  if (!res.ok) throw new Error("Failed to fetch site gallery");
  return res.json();
}

// Sites a field worker has been assigned to monitor (by worker name)
export async function fetchMyAssignedSites(workerName) {
  if (!workerName) return [];
  const res = await fetch(`${API_BASE}/api/mobile/my-sites?worker=${encodeURIComponent(workerName)}`);
  if (!res.ok) return [];
  return res.json();
}

const VIDEO_MIME = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v", "3gp": "video/3gpp" };

export async function uploadActivity({ siteId, activityType, photoUri, performedBy, notes, latitude, longitude, campaignId, assignmentId, mimeType }) {
  const formData = new FormData();
  formData.append("siteId", String(siteId));
  formData.append("activityType", activityType);
  if (campaignId != null) formData.append("campaignId", String(campaignId));
  if (assignmentId != null) formData.append("assignmentId", String(assignmentId));
  if (performedBy) formData.append("performedBy", performedBy);
  if (notes) formData.append("notes", notes);
  if (latitude != null) formData.append("latitude", String(latitude));
  if (longitude != null) formData.append("longitude", String(longitude));
  formData.append("status", "DONE");

  if (photoUri) {
    const filename = photoUri.split("/").pop();
    const ext = (filename.split(".").pop() || "").toLowerCase();
    // Prefer the picker-supplied mimeType; otherwise infer from the file extension
    const type = mimeType || VIDEO_MIME[ext] || (ext === "png" ? "image/png" : "image/jpeg");
    formData.append("file", { uri: photoUri, name: filename, type });
  }

  const res = await fetch(`${API_BASE}/api/activities/mobile/log`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to upload activity");
  return data;
}

export async function fieldLogin(pin) {
  const res = await fetch(`${API_BASE}/api/auth/field-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Invalid PIN. Please check with your admin.");
  return data;
}
