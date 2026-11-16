import { afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import {
  publicCalendarInterval,
  publicProgramRows,
  readPublicCalendar,
} from "./public-calendar-read";
const id = "019ab7b0-0000-7000-8000-000000000001";
const interval = { starts_at: "2026-11-16T00:00:00Z", ends_at: "2026-11-30T00:00:00Z" };
const item = {
  publication_id: id,
  title: "Tango",
  interval: { starts_at: "2026-11-18T15:00:00Z", ends_at: "2026-11-18T16:00:00Z" },
  venue_public_label: "Public salon",
  fee_minor: "50000",
  currency: "TRY",
  public_conditions: "Koşullar",
  discipline_ids: [],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function endpoint(data: unknown) {
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://public.invalid");
  server.use(
    http.post("https://public.invalid/api/public/calendar", () =>
      HttpResponse.json({ ok: true, data, trace_id: id }),
    ),
  );
}
it("reads only the anonymous Worker with the fixed interval and native cursor", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://public.invalid/");
  server.use(
    http.post("https://public.invalid/api/public/calendar", async ({ request }) => {
      expect([...request.headers.keys()]).not.toContain("authorization");
      expect(request.headers.has("apikey")).toBe(false);
      expect(await request.json()).toEqual({
        client_api_version: 1,
        request_id: expect.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-7/),
        slug: "test-studio",
        center_id: id,
        interval,
        page: { limit: 50, sort: "starts_at_asc", cursor: "native-cursor" },
        include_disciplines: true,
      });
      return HttpResponse.json({
        ok: true,
        data: {
          items: [{ ...item, internal_person_id: id }],
          as_of: interval.starts_at,
          next_cursor: null,
        },
        trace_id: id,
      });
    }),
  );
  const result = await readPublicCalendar({
    slug: "test-studio",
    centerId: id,
    interval,
    cursor: "native-cursor",
  });
  expect(result.items[0]).not.toHaveProperty("internal_person_id");
  expect(fetch).toHaveBeenCalledWith(
    "https://public.invalid/api/public/calendar",
    expect.objectContaining({ credentials: "omit", cache: "no-store" }),
  );
});
it("keeps the two week interval independent of the visitor timezone", async () => {
  expect(await publicCalendarInterval(Date.parse(interval.starts_at))).toEqual(interval);
});
it("uses the published IANA timezone across a repeated hour without guessing capacity or kind", async () => {
  const result = await publicProgramRows([
    {
      items: [
        {
          ...item,
          interval: { starts_at: "2026-11-01T05:30:00Z", ends_at: "2026-11-01T06:30:00Z" },
        },
      ],
      as_of: interval.starts_at,
      organization_profile: { timezone: "America/New_York" },
    },
  ]);
  expect(result.timezone).toBe("America/New_York");
  expect(result.rows[0]).toMatchObject({
    day: "2026-11-01",
    start: "01:30",
    end: "01:30",
    fee: "₺500,00",
  });
  expect(result.rows[0]).not.toHaveProperty("availability");
  expect(result.rows[0]).not.toHaveProperty("kind");
});
it("labels missing public timezone as UTC and rejects an invalid published zone", async () => {
  const page = { items: [item], as_of: interval.starts_at };
  expect(await publicProgramRows([page])).toMatchObject({
    timezone: undefined,
    rows: [{ start: "15:00" }],
  });
  await expect(
    publicProgramRows([{ ...page, center_profile: { timezone: "Unknown/Nowhere" } }]),
  ).rejects.toThrow();
});
it("rejects duplicate or invalid public intervals and repeated cursor responses", async () => {
  endpoint({ items: [item, item], as_of: interval.starts_at });
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
  endpoint({
    items: [
      { ...item, interval: { starts_at: item.interval.ends_at, ends_at: item.interval.starts_at } },
    ],
    as_of: interval.starts_at,
  });
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
  endpoint({ items: [item], as_of: interval.starts_at, next_cursor: "same" });
  await expect(readPublicCalendar({ slug: "test", interval, cursor: "same" })).rejects.toThrow();
  await expect(
    publicProgramRows([
      { items: [item], as_of: interval.starts_at },
      { items: [item], as_of: interval.starts_at },
    ]),
  ).rejects.toThrow();
});
it("treats an HTTP 200 failure as an error without retrying an authenticated endpoint", async () => {
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://public.invalid");
  server.use(
    http.post("https://public.invalid/api/public/calendar", () =>
      HttpResponse.json({
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: id },
      }),
    ),
  );
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toMatchObject({
    code: "SERVICE_UNAVAILABLE",
  });
});
