import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type {
  Interval,
  RequestPublicCalendarGet,
  SuccessPublicCalendarGet,
} from "@ftksaas/api-contracts";
import { publicApplicationDiscovery } from "./public-discovery";
import { readEnvelope } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { formatMinorAmount } from "../../lib/money";
import type { PublicProgramRow } from "./public-calendar-view";

const instant = z.iso.datetime({ offset: true });
const profile = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  disciplines: z.array(z.object({ id: z.uuid(), name: z.string() })).optional(),
});
const calendar = z.object({
  items: z.array(
    z.object({
      publication_id: z.uuid(),
      title: z.string(),
      interval: z.object({ starts_at: instant, ends_at: instant }),
      venue_public_label: z.string(),
      fee_minor: z.string().regex(/^\d+$/),
      currency: z.string().regex(/^[A-Z]{3}$/),
      public_conditions: z.string(),
      discipline_ids: z.array(z.uuid()),
      kind: z.enum(["lesson", "event"]),
      timezone: z.string().min(1),
      occupancy: z
        .object({
          registered: z.number().int().nonnegative().safe(),
          capacity: z.number().int().nonnegative().safe().nullable(),
        })
        .nullable(),
      instructors: z.array(z.string()).nullable(),
    }),
  ),
  next_cursor: z.string().min(1).nullable().optional(),
  as_of: instant,
  publication_state: z.enum(["available", "unavailable"]),
  application: publicApplicationDiscovery,
  organization_profile: profile.nullish(),
  center_profile: profile.nullish(),
});
export type PublicCalendarPage = z.infer<typeof calendar>;

type CalendarTemporal = Awaited<ReturnType<typeof getTemporal>>;
type FormattedPublicRow = PublicProgramRow & { timezone: string };

export function publicCalendarIntervalAt(T: CalendarTemporal, now: number): Interval {
  const start = T.Instant.fromEpochMilliseconds(now);
  return { starts_at: start.toString(), ends_at: start.add({ hours: 14 * 24 }).toString() };
}

export async function publicCalendarInterval(now = Date.now()): Promise<Interval> {
  return publicCalendarIntervalAt(await getTemporal(), now);
}

export async function readPublicCalendar(
  input: {
    slug: string;
    centerId?: string;
    disciplineId?: string;
    interval: Interval;
    cursor?: string | null;
    discoveryOnly?: boolean;
  },
  signal?: AbortSignal,
) {
  const base = import.meta.env.VITE_PUBLIC_GATEWAY_URL?.trim();
  if (!base) throw new Error("Public gateway yapılandırması eksik.");
  const request: RequestPublicCalendarGet = {
    client_api_version: 1,
    request_id: uuidv7(),
    slug: input.slug,
    interval: input.interval,
    page: {
      limit: input.discoveryOnly ? 1 : 50,
      sort: "starts_at_asc",
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
    ...(input.centerId ? { center_id: input.centerId } : {}),
    ...(!input.discoveryOnly ? { include_disciplines: true } : {}),
    include_details: true,
    ...(input.disciplineId ? { discipline_id: z.uuid().parse(input.disciplineId) } : {}),
  };
  const response = await fetch(`${base.replace(/\/$/, "")}/api/public/calendar`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = calendar.parse(await readEnvelope<SuccessPublicCalendarGet>(response, signal));
  const ids = new Set<string>();
  const T = await getTemporal();
  let previous: string | undefined;
  for (const item of data.items) {
    if (
      ids.has(item.publication_id) ||
      (input.disciplineId && !item.discipline_ids.includes(input.disciplineId)) ||
      T.Instant.compare(item.interval.starts_at, item.interval.ends_at) >= 0 ||
      T.Instant.compare(item.interval.starts_at, input.interval.starts_at) < 0 ||
      T.Instant.compare(item.interval.starts_at, input.interval.ends_at) >= 0 ||
      (previous && T.Instant.compare(previous, item.interval.starts_at) > 0)
    )
      throw new Error("Geçersiz public program yanıtı.");
    ids.add(item.publication_id);
    previous = item.interval.starts_at;
  }
  if (input.cursor && input.cursor === data.next_cursor)
    throw new Error("Geçersiz program cursor yanıtı.");
  if (
    data.publication_state === "unavailable" &&
    (data.items.length || data.next_cursor || data.application.state === "open")
  )
    throw new Error("Geçersiz public yayın durumu.");
  return data;
}

function formatProgramRows(
  T: CalendarTemporal,
  items: PublicCalendarPage["items"],
): FormattedPublicRow[] {
  return items.map((item) => {
    const start = T.Instant.from(item.interval.starts_at).toZonedDateTimeISO(item.timezone);
    const end = T.Instant.from(item.interval.ends_at).toZonedDateTimeISO(item.timezone);
    const day = start.toPlainDate();
    const time: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(start.offset !== end.offset ? { timeZoneName: "shortOffset" as const } : {}),
    };
    return {
      id: item.publication_id,
      title: item.title,
      day: day.toString(),
      dayLabel: start.toLocaleString("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      start: start.toLocaleString("tr-TR", time),
      end: end.toLocaleString(
        "tr-TR",
        day.equals(end.toPlainDate())
          ? time
          : { ...time, day: "numeric", month: "short", year: "numeric" },
      ),
      startsAt: item.interval.starts_at,
      endsAt: item.interval.ends_at,
      venue: item.venue_public_label,
      conditions: item.public_conditions,
      fee: formatMinorAmount(item.fee_minor, item.currency),
      kind: item.kind,
      timezone: item.timezone,
      instructor: item.instructors?.join(" · ") || undefined,
      occupancy: item.occupancy ?? undefined,
    };
  });
}

export async function readPublicProgramPage(
  T: CalendarTemporal,
  input: Parameters<typeof readPublicCalendar>[0],
  signal?: AbortSignal,
) {
  const source = await readPublicCalendar(input, signal);
  const profile = source.center_profile ?? source.organization_profile;
  return {
    rows: formatProgramRows(T, source.items),
    timezone: source.center_profile?.timezone ?? source.organization_profile?.timezone,
    nextCursor: source.next_cursor,
    publicationState: source.publication_state,
    applicationState: source.application.state,
    profile: profile && {
      name: profile.name,
      description: profile.description,
      address: profile.address,
    },
    disciplines:
      source.center_profile?.disciplines ?? source.organization_profile?.disciplines ?? [],
  };
}

export function combinePublicProgramRows(
  T: CalendarTemporal,
  pages: { rows: FormattedPublicRow[]; timezone?: string }[],
): { rows: PublicProgramRow[]; timezone?: string } {
  const rows = pages.flatMap((page) => page.rows);
  const ids = new Set<string>();
  const zones = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error("Yinelenen public program kaydı.");
    ids.add(row.id);
    zones.add(row.timezone);
  }
  const timezone =
    zones.size === 1 ? rows[0]?.timezone : rows.length ? undefined : pages[0]?.timezone;
  return {
    rows: rows.sort(
      (a, b) => a.day.localeCompare(b.day) || T.Instant.compare(a.startsAt, b.startsAt),
    ),
    timezone,
  };
}

export async function publicProgramRows(pages: PublicCalendarPage[]) {
  const T = await getTemporal();
  return combinePublicProgramRows(
    T,
    pages.map((page) => ({
      rows: formatProgramRows(T, page.items),
      timezone: page.center_profile?.timezone ?? page.organization_profile?.timezone,
    })),
  );
}
