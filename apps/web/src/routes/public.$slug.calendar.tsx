import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicCalendarRoutePage } from "../features/public-program/public-calendar-page";

export const Route = createFileRoute("/public/$slug/calendar")({
  validateSearch: z.object({ center_id: z.uuid().optional() }),
  component: PublicCalendarRoutePage,
});
