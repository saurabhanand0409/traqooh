/**
 * Auth utility for TraqOOH.
 * Roles: ADMIN, EMPLOYEE, ADVERTISER (also legacy: MEDIA_OWNER → treated as EMPLOYEE)
 */

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("tq_user") || "{}");
  } catch {
    return {};
  }
}

export function isLoggedIn() {
  const u = getUser();
  return !!(u && u.email);
}

export function getRole() {
  const u = getUser();
  const r = (u.role || "").toUpperCase();
  // Normalize legacy roles
  if (r === "MEDIA_OWNER" || r === "TEAM_MEMBER" || r === "EMPLOYEE") return "EMPLOYEE";
  if (r === "SUPER_ADMIN" || r === "ADMIN") return "ADMIN";
  if (r === "ADVERTISER") return "ADVERTISER";
  return r;
}

export function dashboardRoute() {
  const role = getRole();
  if (role === "ADMIN") return "/dashboard/admin";
  if (role === "ADVERTISER") return "/dashboard/advertiser";
  return "/dashboard/employee"; // EMPLOYEE + default
}

export function requireAuth(navigate, allowedRoles = []) {
  const u = getUser();
  if (!u || !u.email) {
    navigate("/");
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(getRole())) {
    navigate(dashboardRoute());
    return false;
  }
  return true;
}

export function signOut(navigate) {
  localStorage.removeItem("tq_user");
  navigate("/");
}
