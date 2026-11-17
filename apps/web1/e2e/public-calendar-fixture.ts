import { expect, type Page } from "@playwright/test";
import type {
  PublicCalendarItem,
  SuccessPublicCalendarGet,
  PublicApplicationForm,
} from "../src/lib/api-contracts/generated.js";
export const publicCalendarId = "019ab7b0-0000-7000-8000-000000000001";
export const publicDisciplineId = "019ab7b0-0000-7000-8000-000000000010";
export const otherDisciplineId = "019ab7b0-0000-7000-8000-000000000011";
export const publicForm: PublicApplicationForm = {
  form_id: "019ab7b0-0000-7000-8000-000000000020",
  contact_requirement: "either",
  required_fields: ["interest"],
  consents: [
    {
      purpose: "participation",
      version: "v1",
      required: true,
      content_template_id: "019ab7b0-0000-7000-8000-000000000021",
      source_version: "v1",
      content_hash: "a".repeat(64),
      content: {
        name: "Katılım koşulları",
        language: "tr",
        template_id: "document.participation",
        template_version: "1",
        text: "Yayımlanmış örnek koşullar.",
      },
    },
  ],
};
const item: PublicCalendarItem = {
  publication_id: publicCalendarId,
  title: "Tango programı",
  interval: { starts_at: "2026-11-18T15:00:00Z", ends_at: "2026-11-18T16:00:00Z" },
  venue_public_label: "Public salon",
  fee_minor: "50000",
  currency: "TRY",
  public_conditions: "Rahat ayakkabı",
  discipline_ids: [publicDisciplineId],
  kind: "lesson",
  timezone: "Europe/Istanbul",
  occupancy: null,
  instructors: null,
};
export async function preparePublicCalendar(
  page: Page,
  mode: "normal" | "error" | "empty" | "malformed" | "timezone" = "normal",
) {
  await page.clock.install({ time: new Date("2026-11-16T12:00:00Z") });
  const calls: Record<string, unknown>[] = [];
  const packet: SuccessPublicCalendarGet["data"] = {
    items: [structuredClone(item)],
    as_of: "2026-11-16T12:00:00Z",
    next_cursor: "next-page",
    publication_state: "available",
    application: { state: "closed", form: null },
    organization_profile: {
      name: "Örnek Stüdyo",
      address: "Yayınlanan adres",
      timezone: "Europe/Istanbul",
      disciplines: [
        {
          id: publicDisciplineId,
          name: "Tango",
          description: null,
          color: null,
          icon: null,
          display_order: 0,
        },
        {
          id: otherDisciplineId,
          name: "Vals",
          description: null,
          color: null,
          icon: null,
          display_order: 1,
        },
      ],
    },
  };
  let fail = mode === "error",
    failNext = false;
  if (mode === "empty") {
    packet.items = [];
    packet.next_cursor = null;
    packet.organization_profile = null;
  }
  if (mode === "timezone") {
    packet.items[0]!.timezone = "UTC";
    packet.organization_profile = { name: "Örnek Stüdyo" };
    packet.next_cursor = null;
  }
  if (mode === "malformed") packet.items.push(structuredClone(packet.items[0]!));
  await page.route("**/auth/v1/**", () => {
    throw Error("Public route must not initialize native Auth");
  });
  await page.route("**/functions/v1/backend-v1/**", () => {
    throw Error("Public route must not use authenticated backend");
  });
  await page.route("**/api/public/calendar", async (route) => {
    const req = route.request();
    expect(req.headers()).not.toHaveProperty("authorization");
    expect(req.headers()).not.toHaveProperty("apikey");
    const request = req.postDataJSON() as Record<string, unknown>;
    calls.push(request);
    expect(request.include_details).toBe(true);
    const cursor = (request.page as { cursor?: string }).cursor;
    if (fail || (failNext && cursor))
      return route.fulfill({
        status: 200,
        json: {
          ok: false,
          error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: publicCalendarId },
        },
      });
    const second = {
      ...item,
      publication_id: "019ab7b0-0000-7000-8000-000000000002",
      discipline_ids: [otherDisciplineId],
      title: "İkinci program",
      interval: { starts_at: "2026-11-19T15:00:00Z", ends_at: "2026-11-19T16:00:00Z" },
    };
    const data = request.discipline_id
      ? {
          ...packet,
          items: [...packet.items, ...(packet.next_cursor ? [second] : [])].filter((row) =>
            row.discipline_ids.includes(String(request.discipline_id)),
          ),
          next_cursor: null,
        }
      : cursor
        ? { ...packet, items: [second], next_cursor: null }
        : packet;
    return route.fulfill({ json: { ok: true, trace_id: publicCalendarId, data } });
  });
  await page.goto(`/public/test-studio/calendar?center_id=${publicCalendarId}`);
  return {
    calls,
    packet,
    recover: () => {
      fail = false;
    },
    failNext: () => {
      failNext = true;
    },
    recoverNext: () => {
      failNext = false;
    },
    setFailure: (value: boolean) => {
      fail = value;
    },
  };
}
