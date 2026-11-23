import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type {
  DisciplinePresentationView,
  DisciplineView,
  SettingsDeactivationEffects,
} from "@ftksaas/api-contracts";

export type DisciplineLevel = "organization" | "center";
export type PresentedDiscipline = DisciplineView & { presentation: DisciplinePresentationView };
export interface DisciplineBase {
  scope: ClientScope;
  level: DisciplineLevel;
  discipline: PresentedDiscipline;
  entityId: string | null;
  version: number | null;
  effects?: SettingsDeactivationEffects;
}

const positiveVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const centerPresentation = z.object({
  description: z.string().max(2000).nullable(),
  public_visible: z.boolean(),
});
const effectCategory = z.enum([
  "sessions",
  "reservations",
  "requests",
  "waitlist",
  "offers",
  "classes",
  "programs",
  "products",
  "sales",
]);
const effectsSchema = z.object({
  blocking: z.boolean(),
  counts: z.record(effectCategory, z.number().int().nonnegative()),
  items: z
    .array(
      z.object({
        category: effectCategory,
        id: z.uuid(),
        version: positiveVersion,
        blocking: z.boolean(),
      }),
    )
    .max(200),
  proof: z.string().min(1),
  truncated: z.boolean(),
});
const presentedDiscipline = z.object({
  id: z.uuid(),
  name: z.string(),
  state: z.enum(["active", "inactive"]),
  version: positiveVersion,
  presentation: z.object({
    organization: centerPresentation.extend({
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable(),
      icon: z
        .string()
        .regex(/^[a-z][a-z0-9_-]{0,63}$/)
        .nullable(),
      display_order: z.number().int().min(0).max(2147483647),
      allow_center_description: z.boolean(),
    }),
    center: z
      .object({
        id: z.uuid(),
        state: z.enum(["active", "inactive"]),
        version: positiveVersion,
        presentation: centerPresentation,
      })
      .nullable(),
  }),
});

/** Explicit presentation opt-in, native pagination, no inference from omitted metadata. */
export async function readDisciplineCatalog(
  scope: ClientScope,
  level: DisciplineLevel,
  readContext?: AccountReadContext,
  signal = readContext?.signal,
) {
  const backend = await scopedBackend(scope, signal, readContext),
    items: PresentedDiscipline[] = [],
    cursors = new Set<string>(),
    ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("disciplines_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      ...(level === "center" ? { center_id: scope.centerId } : {}),
      include_presentation: true,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    for (const value of page.items) {
      const parsed = presentedDiscipline.parse(value);
      if (ids.has(parsed.id)) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
      ids.add(parsed.id);
      items.push(parsed);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
      cursors.add(cursor);
    }
  } while (cursor);
  return items;
}

export async function readDisciplineBase(
  scope: ClientScope,
  level: DisciplineLevel,
  id: string,
  includeEffects = false,
  signal?: AbortSignal,
): Promise<DisciplineBase> {
  z.uuid().parse(id);
  const backend = await scopedBackend(scope, signal);
  const operation = level === "organization" ? "discipline_save_v1" : "center_discipline_set_v1";
  const selector =
    level === "organization"
      ? {
          operation: "discipline_save_v1" as const,
          key: { discipline_id: id, include_deactivation_effects: includeEffects },
        }
      : {
          operation: "center_discipline_set_v1" as const,
          key: { discipline_id: id, include_deactivation_effects: includeEffects },
        };
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    ...(level === "center" ? { center_id: scope.centerId } : {}),
    operation,
    selector,
    page: { limit: 1 },
  });
  if (page.items.length !== 1 || page.next_cursor) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  const current = page.items[0]!;
  if (current.operation !== operation) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  // The center-filtered catalog contains existing relations only. An explicitly
  // absent relation must resolve its master from the permitted organization catalog.
  const catalog = await readDisciplineCatalog(
      scope,
      level === "center" && !current.exists ? "organization" : level,
      undefined,
      signal,
    ),
    discipline = catalog.find((item) => item.id === id);
  if (!discipline) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  const relation = discipline.presentation.center;
  if (!current.exists) {
    if (
      level !== "center" ||
      relation !== null ||
      current.entity !== null ||
      current.versions.length !== 0
    )
      throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
    return { scope: { ...scope }, level, discipline, entityId: null, version: null };
  }
  const type = level === "organization" ? "disciplines" : "center_disciplines";
  const expectedId = level === "organization" ? discipline.id : relation?.id;
  const expectedVersion = level === "organization" ? discipline.version : relation?.version;
  const state = level === "organization" ? discipline.state : relation?.state;
  const projection = current.current;
  if (
    !expectedId ||
    current.entity?.type !== type ||
    current.entity.id !== expectedId ||
    !expectedVersion ||
    current.state !== state ||
    projection?.operation !== operation ||
    projection.values.discipline_id !== id ||
    projection.values.state !== state
  )
    throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  if (projection.operation === "discipline_save_v1" && projection.values.name !== discipline.name)
    throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  const versions = current.versions.filter(
    (entry) => entry.entity.type === type && entry.entity.id === expectedId,
  );
  if (versions.length !== 1 || versions[0]?.version !== expectedVersion)
    throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  const effects = projection.values.deactivation_effects
    ? effectsSchema.parse(projection.values.deactivation_effects)
    : undefined;
  if (includeEffects && state === "active" && !effects)
    throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  return {
    scope: { ...scope },
    level,
    discipline,
    entityId: expectedId,
    version: expectedVersion,
    ...(effects ? { effects } : {}),
  };
}
