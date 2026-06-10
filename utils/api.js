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
