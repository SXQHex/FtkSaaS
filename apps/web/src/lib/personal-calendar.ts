import { validate } from "uuid";
import type { Operations, PersonalCalendarLink } from "@ftksaas/api-contracts";
import { accountCall } from "./account";
export type CalendarWrite =
  | "calendar_link_create_v1"
  | "calendar_link_rotate_v1"
  | "calendar_link_revoke_v1";
export type CalendarCommand = {
  [K in CalendarWrite]: {
    operation: K;
    input: Omit<Operations[K]["request"], "client_api_version" | "request_id">;
  };
}[CalendarWrite];
export const calendarStorageKey = (actorId: string) => `ftksaas:calendar-link:${actorId}`;
export function validCalendarCommand(value: unknown): value is CalendarCommand {
  if (!value || typeof value !== "object") return false;
  const c = value as { operation?: string; input?: Record<string, unknown> };
  const v = c.input;
  if (
    !v ||
    typeof v.operation_key !== "string" ||
    !validate(v.operation_key) ||
    !/-7[0-9a-f]{3}-/i.test(v.operation_key)
  )
    return false;
  const org = v.organization_scope as { org_id?: unknown } | undefined;
  if (c.operation === "calendar_link_create_v1")
    return (
      Object.keys(v).every((k) => ["operation_key", "organization_scope", "kinds"].includes(k)) &&
      !!org &&
      Object.keys(org).length === 1 &&
      typeof org.org_id === "string" &&
      validate(org.org_id) &&
      Array.isArray(v.kinds) &&
      v.kinds.length >= 1 &&
      v.kinds.length <= 2 &&
      new Set(v.kinds).size === v.kinds.length &&
      v.kinds.every((k) => k === "lessons" || k === "duties")
    );
  if (
    !["calendar_link_rotate_v1", "calendar_link_revoke_v1"].includes(c.operation ?? "") ||
    typeof v.link_id !== "string" ||
    !validate(v.link_id) ||
    !Number.isSafeInteger(v.expected_version) ||
    Number(v.expected_version) < 1
  )
    return false;
  return (
    Object.keys(v).every((k) =>
      [
        "operation_key",
        "link_id",
        "expected_version",
        ...(c.operation === "calendar_link_rotate_v1" ? ["organization_scope"] : []),
      ].includes(k),
    ) &&
    (c.operation === "calendar_link_revoke_v1" ||
      (!!org &&
        Object.keys(org).length === 1 &&
        typeof org.org_id === "string" &&
        validate(org.org_id)))
  );
}
export function readCalendarPending(actorId: string): CalendarCommand | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(calendarStorageKey(actorId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return validCalendarCommand(v) ? v : "invalid";
  } catch {
    return "invalid";
  }
}
export function validCalendarLink(l: PersonalCalendarLink) {
  return (
    validate(l.id) &&
    validate(l.org_id) &&
    Number.isFinite(Date.parse(l.created_at)) &&
    Number.isSafeInteger(l.version) &&
    l.version > 0 &&
    ["active", "revoked"].includes(l.state) &&
    new Set(l.kinds).size === l.kinds.length &&
    l.kinds.length > 0 &&
    l.kinds.every((k) => k === "lessons" || k === "duties")
  );
}
export const personalCalendarApi = {
  async list(cursor?: string) {
    const p = await accountCall("calendar_links_get_v1", {
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (
      p.items.some((l) => !validCalendarLink(l)) ||
      new Set(p.items.map((l) => l.id)).size !== p.items.length ||
      (cursor && p.next_cursor === cursor)
    )
      throw Error("invalidCalendarLinks");
    return p;
  },
  async write(c: CalendarCommand, actorId: string) {
    if (!validCalendarCommand(c)) throw Error("invalidCalendarLinks");
    const r =
      c.operation === "calendar_link_create_v1"
        ? await accountCall(c.operation, c.input)
        : c.operation === "calendar_link_rotate_v1"
          ? await accountCall(c.operation, c.input)
          : await accountCall(c.operation, c.input);
    if (
      !validCalendarLink(r.link) ||
      r.primary_id !== actorId ||
      (c.operation !== "calendar_link_revoke_v1" &&
        !("subscription_url" in r && typeof r.subscription_url === "string")) ||
      (c.operation === "calendar_link_revoke_v1"
        ? r.link.state !== "revoked"
        : r.link.state !== "active") ||
      (c.operation !== "calendar_link_revoke_v1" &&
        r.link.org_id !== c.input.organization_scope.org_id) ||
      (c.operation !== "calendar_link_create_v1" && r.link.id !== c.input.link_id)
    )
      throw Error("invalidCalendarLinks");
    if ("subscription_url" in r && typeof r.subscription_url === "string") {
      const url = new URL(r.subscription_url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw Error("invalidCalendarLinks");
    }
    return r;
  },
  status: (c: CalendarCommand) =>
    accountCall("operation_status_get_v1", { operation: c.operation, key: c.input.operation_key }),
};
