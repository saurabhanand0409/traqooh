export function signOut(navigate) {
  localStorage.removeItem("tq_user");
  navigate("/login");
}

export function requireAuth(navigate, allowedRoles = []) {
  try {
    const user = JSON.parse(localStorage.getItem("tq_user") || "{}");
    if (!user.token) { navigate("/login"); return false; }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      if (user.role === "ADVERTISER") navigate("/dashboard/advertiser");
      else navigate("/dashboard/employee");
      return false;
    }
    return true;
  } catch {
    navigate("/login");
    return false;
  }
}
