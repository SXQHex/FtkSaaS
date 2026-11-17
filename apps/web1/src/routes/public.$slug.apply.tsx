import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { PublicApplicationRoutePage } from "../features/public-program/public-application-page";

export const Route = createFileRoute("/public/$slug/apply")({
  validateSearch: z.object({ center_id: z.uuid().optional() }),
  component: PublicApplicationRoutePage,
});
