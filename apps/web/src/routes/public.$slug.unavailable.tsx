import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicPublicationRoutePage } from "../features/public-program/public-publication-page";
export const Route = createFileRoute("/public/$slug/unavailable")({
  validateSearch: z.object({ center_id: z.uuid().optional() }),
  component: PublicPublicationRoutePage,
});
