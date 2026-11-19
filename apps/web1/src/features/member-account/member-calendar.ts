import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { PersonalCalendarLink } from "../../lib/api-contracts/generated";
export type CalendarScope = Pick<ClientScope, "accountId" | "orgId"> & { studioCenterId?: string };
export type CalendarKind = PersonalCalendarLink["kinds"][number];
function organizationScope(scope: CalendarScope) {
  return {
    org_id: scope.orgId,
    ...(scope.studioCenterId && { center_id: scope.studioCenterId }),
  };
}
export function calendarLinkMatchesScope(scope: CalendarScope, link: PersonalCalendarLink) {
  return (
    link.org_id === scope.orgId &&
    link.center_id === scope.studioCenterId &&
    (scope.studioCenterId
      ? link.kinds.length === 1 && link.kinds[0] === "studio_program"
      : !link.kinds.includes("studio_program"))
  );
}
export async function readMemberCalendars(scope: CalendarScope) {
  const backend = await scopedBackend(scope);
  const links: PersonalCalendarLink[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let ready = false;
  let supportedKinds: CalendarKind[] = [];
  do {
    const page = await backend.call("calendar_links_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      page: { limit: 50, cursor },
      ...(scope.studioCenterId && {
        studio_program_scope: { org_id: scope.orgId, center_id: scope.studioCenterId },
      }),
    });
    ready = page.service_ready;
    supportedKinds = scope.studioCenterId ? ["studio_program"] : page.supported_kinds;
    for (const link of page.items) {
      if (seen.has(link.id) || !Number.isSafeInteger(link.version) || link.version < 1)
        throw new Error("CALENDAR_METADATA_UNAVAILABLE");
      seen.add(link.id);
      if (!scope.studioCenterId && link.org_id !== scope.orgId) continue;
      if (!calendarLinkMatchesScope(scope, link)) throw new Error("CALENDAR_METADATA_UNAVAILABLE");
      links.push(link);
    }
    const next = page.next_cursor ?? undefined;
    if (next && seen.has(`cursor:${next}`)) throw new Error("CALENDAR_CURSOR_REPEATED");
    if (next) seen.add(`cursor:${next}`);
    cursor = next;
  } while (cursor);
  return { links, ready, supportedKinds };
}
export type CalendarSnapshot = Awaited<ReturnType<typeof readMemberCalendars>>;
export type CalendarIntent = { key: string } & (
  | { action: "create"; kind: CalendarKind }
  | { action: "rotate" | "revoke"; link: PersonalCalendarLink }
);
export async function writeMemberCalendar(scope: CalendarScope, intent: CalendarIntent) {
  const backend = await scopedBackend(scope);
  const base = { client_api_version: 1 as const, request_id: uuidv7(), operation_key: intent.key };
  if (intent.action === "create") {
    if ((intent.kind === "studio_program") !== Boolean(scope.studioCenterId))
      throw new Error("CALENDAR_SCOPE_CHANGED");
    return backend.call("calendar_link_create_v1", {
      ...base,
      organization_scope: organizationScope(scope),
      kinds: [intent.kind],
    });
  }
  if (!calendarLinkMatchesScope(scope, intent.link)) throw new Error("CALENDAR_SCOPE_CHANGED");
  const selected = { ...base, link_id: intent.link.id, expected_version: intent.link.version };
  if (intent.action === "rotate")
    return backend.call("calendar_link_rotate_v1", {
      ...selected,
      organization_scope: organizationScope(scope),
    });
  return backend.call("calendar_link_revoke_v1", selected);
}
// Never place this credential in query cache, storage, navigation or receipt logs.
export function calendarCredential(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
  )
    throw new Error("CALENDAR_CREDENTIAL_INVALID");
  return value;
}
