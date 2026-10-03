import React from "react";
import LoginForm from "../components/LoginForm";

export default function MasterLogin() {
  return <LoginForm defaultTab="admin" allowedRoles={["SUPER_ADMIN"]} />;
}
