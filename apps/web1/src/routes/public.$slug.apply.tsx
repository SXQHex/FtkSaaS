import { createFileRoute } from "@tanstack/react-router";
import { PublicApplicationRoutePage } from "../features/public-program/public-application-page";

export const Route = createFileRoute("/public/$slug/apply")({
  component: PublicApplicationRoutePage,
});
