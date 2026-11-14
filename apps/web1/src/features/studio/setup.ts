import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { studioBackend, studioPages, type StudioResources, type StudioScope } from "./studio";
import { readStudioAvailability, type InstructorRecord } from "./studio-reads";

export type SetupRead<T> = { state: "known"; value: T } | { state: "unavailable" };
async function readable<T>(read: () => Promise<T>): Promise<SetupRead<T>> {
  try {
    return { state: "known", value: await read() };
  } catch (error) {
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      throw error;
    return { state: "unavailable" };
  }
}
export async function readStudioSetup(
  scope: StudioScope,
  resources: StudioResources,
  instructors: InstructorRecord[],
  canReadPlan = false,
) {
  const backend = await studioBackend(scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
  };
  const people = [
    ...new Set(instructors.filter((item) => item.active).map((item) => item.person.id)),
  ];
  const availability: {
    personId: string;
    rules: SetupRead<Awaited<ReturnType<typeof readStudioAvailability>>>;
  }[] = [];
  let nextPerson = 0;
  const [center, products, plan] = await Promise.all([
    readable(async () => {
      const [centers, catalog, settings] = await Promise.all([
        studioPages((cursor) =>
          backend
            .call("centers_list_v1", {
              client_api_version: 1,
              request_id: uuidv7(),
              org_id: scope.orgId,
              page: { limit: 50, ...(cursor ? { cursor } : {}) },
            })
            .then((page) => ({ items: page.items, next_cursor: page.next_cursor ?? null })),
        ),
        backend.call("settings_catalog_get_v1", {
          ...common,
          request_id: uuidv7(),
          scope: "center",
        }),
        backend.call("settings_get_v1", { ...common, request_id: uuidv7(), scope: "center" }),
      ]);
      const matches = centers.filter((item) => item.id === scope.centerId && item.accessible);
      if (matches.length !== 1 || catalog.scope !== "center" || settings.scope !== "center")
        throw new Error("STUDIO_UNAVAILABLE");
      const temporal = await getTemporal();
      const selected = matches[0]!;
      const today = temporal.Instant.from(settings.as_of)
        .toZonedDateTimeISO(selected.timezone)
        .toPlainDate()
        .toString();
      return {
        name: selected.name,
        timezone: selected.timezone,
        address: settings.values.address ?? null,
        addressWritable: catalog.fields.some((field) => field.key === "address" && field.writable),
        today,
      };
    }),
    readable(async () => {
      const items = await studioPages((cursor) =>
        backend
          .call("products_list_v1", {
            ...common,
            request_id: uuidv7(),
            include_timed_products: true,
            page: { limit: 50, ...(cursor ? { cursor } : {}) },
          })
          .then((page) => ({ items: page.items, next_cursor: page.next_cursor ?? null })),
      );
      return new Set(
        items
          .filter((item) =>
            item.terms.scopes.some(
              (entry) => entry.center_id === null || entry.center_id === scope.centerId,
            ),
          )
          .map((item) => item.id),
      ).size;
    }),
    readable(async () => {
      if (!canReadPlan) return null;
      // This reader is owner-scoped. A CM-only actor may get FORBIDDEN; that
      // becomes unknown metadata, never an invented quota or a relaxed gate.
      const value = await backend.call("subscription_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
      });
      const limits = value.limits.entries.filter((item) => item.key === "rooms");
      const limit = limits[0];
      if (limits.length !== 1 || !limit) throw new Error("STUDIO_UNAVAILABLE");
      if ("unlimited" in limit)
        return { plan: value.plan, roomLimit: null, roomsUnlimited: true, state: value.state };
      if (!Number.isSafeInteger(limit.value) || limit.value < 0)
        throw new Error("STUDIO_UNAVAILABLE");
      return {
        plan: value.plan,
        roomLimit: limit.value,
        roomsUnlimited: false,
        state: value.state,
      };
    }),
    // Reuse this one account-pinned bearer and cap setup detail reads at four.
    Promise.all(
      Array.from({ length: Math.min(4, people.length) }, async () => {
        while (nextPerson < people.length) {
          const personId = people[nextPerson++]!;
          availability.push({
            personId,
            rules: await readable(() =>
              readStudioAvailability(scope, { kind: "person", id: personId }, backend),
            ),
          });
        }
      }),
    ),
  ]);
  const knownRules = availability.filter((item) => item.rules.state === "known");
  const readyPeople =
    center.state === "known"
      ? knownRules.filter(
          (item) =>
            item.rules.state === "known" &&
            item.rules.value.some(
              (rule) => rule.rule.valid_until == null || rule.rule.valid_until > center.value.today,
            ),
        ).length
      : null;
  return {
    scope: { ...scope },
    center,
    products,
    plan,
    activeRooms: resources.rooms.filter((room) => room.active).length,
    activeClasses: resources.classes.filter((lesson) => lesson.active).length,
    instructors: {
      count: people.length,
      ready: readyPeople,
      unread: people.length - knownRules.length,
    },
    // The contract has no safe center-wide discovery for these two facts.
    // No scan of all people, fake file ID, or guessed completion is substituted.
    documents: null,
    invitations: null,
  };
}
