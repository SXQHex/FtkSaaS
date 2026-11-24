import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "../features/auth/login-page";
import { calendarSessionSearch } from "../features/auth/calendar-session-return";
export const Route = createFileRoute("/login")({
  validateSearch: calendarSessionSearch,
  component: LoginPage,
});
