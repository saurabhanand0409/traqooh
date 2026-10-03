import React from "react";
import LoginForm from "../components/LoginForm";

export default function EmployeeLogin() {
  return <LoginForm defaultTab="employee" allowedRoles={["EMPLOYEE"]} />;
}
