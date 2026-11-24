import { afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { getTemporal } from "../../lib/temporal";
import { server } from "../../test/server";
import {
  combinePublicProgramRows,
  publicCalendarInterval,
  publicProgramRows,
  readPublicCalendar,
  readPublicProgramPage,
} from "./public-calendar-read";
const id = "019ab7b0-0000-7000-8000-000000000001",
  discipline = "019ab7b0-0000-7000-8000-000000000002";
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
  kind: "lesson" as const,
  timezone: "Europe/Istanbul",
  occupancy: null,
  instructors: null,
};
const discovery = {
  publication_state: "available" as const,
  application: { state: "closed" as const, form: null },
};
const consent = {
  purpose: "participation",
  version: "v1",
  required: true,
  content_template_id: id,
  source_version: "v1",
  content_hash: "a".repeat(64),
  content: {
    name: "Katılım koşulları",
    language: "tr",
    template_id: "document.participation",
    template_version: "1",
    text: "Yayımlanmış örnek metin.",
  },
};
const form = {
  form_id: id,
  contact_requirement: "either",
  required_fields: ["interest"],
  consents: [consent],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function endpoint(data: Record<string, unknown>) {
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://public.invalid");
  server.use(
    http.post("https://public.invalid/api/public/calendar", () =>
      HttpResponse.json({ ok: true, data: { ...discovery, ...data }, trace_id: id }),
    ),
  );
}
it("reads only the anonymous Worker with fixed interval, native details and cursor", async () => {
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
        include_details: true,
      });
      return HttpResponse.json({
        ok: true,
        data: {
          ...discovery,
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
it("uses each published IANA timezone and distinguishes repeated DST hours without inventing hidden fields", async () => {
  const result = await publicProgramRows([
    {
      ...discovery,
      items: [
        {
          ...item,
          timezone: "America/New_York",
          interval: { starts_at: "2026-11-01T05:30:00Z", ends_at: "2026-11-01T06:30:00Z" },
        },
      ],
      as_of: interval.starts_at,
      organization_profile: { timezone: "Europe/Istanbul" },
    },
  ]);
  expect(result.timezone).toBe("America/New_York");
  expect(result.rows[0]).toMatchObject({ day: "2026-11-01", fee: "₺500,00", kind: "lesson" });
  expect(result.rows[0]!.start).toMatch(/01:30.*(?:GMT|UTC)-4/);
  expect(result.rows[0]!.end).toMatch(/01:30.*(?:GMT|UTC)-5/);
  expect(result.rows[0]!.occupancy).toBeUndefined();
  expect(result.rows[0]!.instructor).toBeUndefined();
});
it("honors explicit record UTC without a profile timezone and rejects an invalid record zone", async () => {
  const page = { ...discovery, items: [{ ...item, timezone: "UTC" }], as_of: interval.starts_at };
  expect(await publicProgramRows([page])).toMatchObject({
    timezone: "UTC",
    rows: [{ start: "15:00" }],
  });
  await expect(
    publicProgramRows([{ ...page, items: [{ ...item, timezone: "Unknown/Nowhere" }] }]),
  ).rejects.toThrow();
  endpoint({ ...page, items: [{ ...item, timezone: undefined }] });
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
});
it("rejects duplicate or invalid intervals and repeated native cursor responses", async () => {
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
      { ...discovery, items: [item], as_of: interval.starts_at },
      { ...discovery, items: [item], as_of: interval.starts_at },
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
it("sends discipline filtering to the source and rejects a nonmatching returned page", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  endpoint({ items: [{ ...item, discipline_ids: [discipline] }], as_of: interval.starts_at });
  await readPublicCalendar({ slug: "test", interval, disciplineId: discipline });
  const body = fetch.mock.calls[0]?.[1]?.body;
  expect(typeof body).toBe("string");
  if (typeof body !== "string") throw new Error("Expected anonymous JSON request body");
  expect(JSON.parse(body)).toMatchObject({
    include_details: true,
    discipline_id: discipline,
  });
  endpoint({ items: [item], as_of: interval.starts_at });
  await expect(
    readPublicCalendar({ slug: "test", interval, disciplineId: discipline }),
  ).rejects.toThrow();
});
it("keeps event, visible occupancy and instructor fields independent of hidden lesson fields", async () => {
  const result = await publicProgramRows([
    {
      ...discovery,
      items: [
        item,
        {
          ...item,
          publication_id: discipline,
          kind: "event",
          occupancy: { registered: 7, capacity: null },
          instructors: ["Yayımlanan eğitmen"],
        },
      ],
      as_of: interval.starts_at,
    },
  ]);
  expect(result.rows[0]).toMatchObject({
    kind: "lesson",
    occupancy: undefined,
    instructor: undefined,
  });
  expect(result.rows[1]).toMatchObject({
    kind: "event",
    occupancy: { registered: 7, capacity: null },
    instructor: "Yayımlanan eğitmen",
  });
});
it("keeps mixed record zones explicit and shows a real multi-day event end date", async () => {
  const result = await publicProgramRows([
    {
      ...discovery,
      items: [
        { ...item, timezone: "UTC" },
        {
          ...item,
          publication_id: discipline,
          kind: "event",
          timezone: "Europe/Istanbul",
          interval: { starts_at: "2026-11-18T21:00:00Z", ends_at: "2026-11-20T21:00:00Z" },
        },
      ],
      as_of: interval.starts_at,
    },
  ]);
  expect(result.timezone).toBeUndefined();
  expect(result.rows.map((row) => row.timezone)).toEqual(["UTC", "Europe/Istanbul"]);
  expect(result.rows[1]!.end).toContain("21");
  expect(result.rows[1]!.end).toContain("2026");
});
it.each(["closed", "unavailable"] as const)(
  "accepts %s application metadata without exposing a form",
  async (state) => {
    endpoint({ items: [], as_of: interval.starts_at, application: { state, form: null } });
    expect((await readPublicCalendar({ slug: "test", interval })).application).toEqual({
      state,
      form: null,
    });
    endpoint({ items: [], as_of: interval.starts_at, application: { state, form } });
    await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
  },
);
it("reads only an explicitly published consent source and rejects a stale source version", async () => {
  endpoint({
    items: [],
    as_of: interval.starts_at,
    application: {
      state: "open",
      form: { ...form, consents: [{ ...consent, source_url: "https://example.invalid/source" }] },
    },
  });
  const result = await readPublicCalendar({ slug: "test", interval });
  expect(result.application.state).toBe("open");
  expect(result.application.form?.consents[0]).not.toHaveProperty("source_url");
  endpoint({
    items: [],
    as_of: interval.starts_at,
    application: {
      state: "open",
      form: { ...form, consents: [{ ...consent, source_version: "v2" }] },
    },
  });
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
});
it("distinguishes a truly unavailable publication from an available empty program", async () => {
  endpoint({ items: [], as_of: interval.starts_at, publication_state: "unavailable" });
  expect((await readPublicCalendar({ slug: "test", interval })).publication_state).toBe(
    "unavailable",
  );
  endpoint({ items: [item], as_of: interval.starts_at, publication_state: "unavailable" });
  await expect(readPublicCalendar({ slug: "test", interval })).rejects.toThrow();
  endpoint({ items: [], as_of: interval.starts_at, publication_state: "available" });
  expect((await readPublicCalendar({ slug: "test", interval })).publication_state).toBe(
    "available",
  );
});

it("keeps calendar page data to the visible projection and still validates duplicate publications across cursors", async () => {
  const temporal = await getTemporal();
  endpoint({
    items: [{ ...item, discipline_ids: [discipline] }],
    as_of: interval.starts_at,
    next_cursor: "next",
    application: { state: "open", form },
    organization_profile: {
      name: "Yayındaki stüdyo",
      disciplines: [{ id: discipline, name: "Tango" }],
    },
  });
  const first = await readPublicProgramPage(temporal, { slug: "test", interval });
  expect(first).toMatchObject({
    applicationState: "open",
    nextCursor: "next",
    rows: [{ id, title: "Tango", fee: "₺500,00" }],
    disciplines: [{ id: discipline, name: "Tango" }],
  });
  expect(first).not.toHaveProperty("items");
  expect(first).not.toHaveProperty("application");
  expect(first.rows[0]).not.toHaveProperty("discipline_ids");

  const following = {
    ...first,
    rows: [{ ...first.rows[0]!, id: discipline, title: "Yeni etkinlik" }],
  };
  const combined = combinePublicProgramRows(temporal, [first, following]);
  expect(combined.rows.map(({ title }) => title)).toEqual(["Tango", "Yeni etkinlik"]);
  expect(combined.rows[0]).toBe(first.rows[0]);
  expect(combined.rows[1]).toBe(following.rows[0]);
  expect(() => combinePublicProgramRows(temporal, [first, first])).toThrow(
    "Yinelenen public program kaydı.",
  );
});
