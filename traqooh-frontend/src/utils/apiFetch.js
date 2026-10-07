/**
 * Authenticated fetch wrapper.
 * Reads the JWT from localStorage (stored as tq_user.token by login pages),
 * and attaches it as an Authorization: Bearer header on every request.
 */

export const API_BASE = import.meta.env.VITE_API_BASE || "https://traqooh-backend-python.onrender.com";
const API = API_BASE;

export function getToken() {
  try {
    const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
    return user.token || null;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch — path must start with "/" and be relative to the API base.
 * Example: apiFetch("/api/sites") or apiFetch("/api/sites", { method: "POST", body: ... })
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Only set Content-Type for requests with a body (skip for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API}${path}`, { ...options, headers });
}
