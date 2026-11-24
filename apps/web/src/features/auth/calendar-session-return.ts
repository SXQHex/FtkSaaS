import { z } from "zod";

const calendarPath = /^\/organizasyon\/([^/]+)\/seans\/([^/]+)$/;
const uuid = z.uuid();

export function calendarSessionReturn(input: unknown): string | undefined {
  if (typeof input !== "string") return;
  const match = calendarPath.exec(input);
  if (!match || match[0] !== input) return;
  const org = uuid.safeParse(match[1]);
  const session = uuid.safeParse(match[2]);
  if (!org.success || !session.success) return;
  return `/organizasyon/${org.data.toLowerCase()}/seans/${session.data.toLowerCase()}`;
}

export function calendarSessionSearch(input: Record<string, unknown>): { next?: string } {
  // Override an invalid value because Router merges validation output into the search.
  return { next: calendarSessionReturn(input.next) };
}

const googleReturnKey = "ftksaas.calendar-session.google-return";

// Google continues through the existing exact PKCE callback. Keep the route
// in this tab, outside provider URLs, and consume it at most once.
export function storeGoogleCalendarReturn(next?: string) {
  const path = calendarSessionReturn(next);
  try {
    if (path) sessionStorage.setItem(googleReturnKey, path);
    else sessionStorage.removeItem(googleReturnKey);
  } catch {
    // Native sign-in can continue when browser storage is unavailable.
  }
}

export function takeGoogleCalendarReturn() {
  try {
    const next = sessionStorage.getItem(googleReturnKey);
    sessionStorage.removeItem(googleReturnKey);
    return calendarSessionReturn(next);
  } catch {
    return undefined;
  }
}
