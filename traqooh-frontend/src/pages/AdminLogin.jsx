import React from "react";
import LoginForm from "../components/LoginForm";

export default function AdminLogin() {
  return <LoginForm defaultTab="admin" allowedRoles={["ADMIN"]} />;
}
