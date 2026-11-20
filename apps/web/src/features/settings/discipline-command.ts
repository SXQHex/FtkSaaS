import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { RequestCenterDisciplineSet, RequestDisciplineSave } from "@ftksaas/api-contracts";
import type { DisciplineDraft } from "./discipline-sheet";
import { readDisciplineBase, type DisciplineBase, type DisciplineLevel } from "./discipline-reader";

const draftSchema = z.object({
  name: z.string().refine((value) => Boolean(value.trim())),
  state: z.enum(["active", "inactive"]),
  description: z.string().max(2000).nullable(),
  publicVisible: z.boolean(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  icon: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,63}$/)
    .nullable(),
  displayOrder: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(2147483647)),
  allowCenterDescription: z.boolean(),
});
export type DisciplineIntent =
  | {
      scope: ClientScope;
      base?: DisciplineBase;
      operation: "discipline_save_v1";
      request: Omit<RequestDisciplineSave, "request_id">;
    }
  | {
      scope: ClientScope;
      base: DisciplineBase;
      operation: "center_discipline_set_v1";
      request: Omit<RequestCenterDisciplineSet, "request_id">;
    };

// These are the documented *new record* presentation defaults, never fallbacks for unread values.
export function disciplineDraft(base?: DisciplineBase): DisciplineDraft {
  const org = base?.discipline.presentation.organization;
  const center = base?.discipline.presentation.center;
  const presentation = base?.level === "center" ? center?.presentation : org;
  return {
    name: base?.discipline.name ?? "",
    state:
      base?.level === "center" ? (center?.state ?? "active") : (base?.discipline.state ?? "active"),
    description: presentation?.description ?? null,
    publicVisible: presentation?.public_visible ?? false,
    color: org?.color ?? null,
    icon: org?.icon ?? null,
    displayOrder: String(org?.display_order ?? 0),
    allowCenterDescription: org?.allow_center_description ?? false,
  };
}

export function disciplineIntent(
  scope: ClientScope,
  level: DisciplineLevel,
  draft: DisciplineDraft,
  base?: DisciplineBase,
): DisciplineIntent {
  const value = draftSchema.parse(draft);
  if (
    base &&
    (base.level !== level ||
      base.scope.accountId !== scope.accountId ||
      base.scope.orgId !== scope.orgId ||
      base.scope.centerId !== scope.centerId)
  )
    throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  if (level === "center" && !base) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  const before = disciplineDraft(base),
    deactivating =
      base?.version !== null &&
      base !== undefined &&
      before.state === "active" &&
      value.state === "inactive";
  let proof: string | undefined;
  if (deactivating) {
    const effects = base.effects;
    if (
      !effects ||
      typeof effects.blocking !== "boolean" ||
      typeof effects.proof !== "string" ||
      !effects.proof
    )
      throw new Error("DISCIPLINE_EFFECTS_UNAVAILABLE");
    if (effects.blocking) throw new Error("DISCIPLINE_OPEN_OPERATIONS");
    proof = effects.proof;
  }
  const common = {
    client_api_version: 1 as const,
    org_id: scope.orgId,
    operation_key: uuidv7(),
    ...(proof ? { deactivation_proof: proof } : {}),
  };
  if (level === "organization") {
    const presentation = {
      ...(value.description !== before.description ? { description: value.description } : {}),
      ...(value.color !== before.color ? { color: value.color } : {}),
      ...(value.icon !== before.icon ? { icon: value.icon } : {}),
      ...(value.displayOrder !== Number(before.displayOrder)
        ? { display_order: value.displayOrder }
        : {}),
      ...(value.publicVisible !== before.publicVisible
        ? { public_visible: value.publicVisible }
        : {}),
      ...(value.allowCenterDescription !== before.allowCenterDescription
        ? { allow_center_description: value.allowCenterDescription }
        : {}),
    };
    if (
      base &&
      value.name.trim() === before.name &&
      value.state === before.state &&
      !Object.keys(presentation).length
    )
      throw new Error("DISCIPLINE_NO_CHANGES");
    return {
      scope: { ...scope },
      ...(base ? { base: structuredClone(base) } : {}),
      operation: "discipline_save_v1",
      request: {
        ...common,
        name: value.name.trim(),
        state: value.state,
        ...(base
          ? { discipline_id: base.discipline.id, expected_version: base.version ?? undefined }
          : {}),
        ...(Object.keys(presentation).length ? { presentation } : {}),
      },
    };
  }
  if (!base) throw new Error("DISCIPLINE_SOURCE_UNAVAILABLE");
  if (
    value.name !== base.discipline.name ||
    value.color !== before.color ||
    value.icon !== before.icon ||
    value.displayOrder !== Number(before.displayOrder) ||
    value.allowCenterDescription !== before.allowCenterDescription
  )
    throw new Error("DISCIPLINE_ORGANIZATION_FIELDS_READONLY");
  const descriptionChanged = value.description !== before.description;
  if (descriptionChanged && !base.discipline.presentation.organization.allow_center_description)
    throw new Error("DISCIPLINE_LOCAL_DESCRIPTION_FORBIDDEN");
  const presentation = {
    ...(descriptionChanged ? { description: value.description } : {}),
    ...(value.publicVisible !== before.publicVisible
      ? { public_visible: value.publicVisible }
      : {}),
  };
  if (base.version !== null && value.state === before.state && !Object.keys(presentation).length)
    throw new Error("DISCIPLINE_NO_CHANGES");
  return {
    scope: { ...scope },
    base: structuredClone(base),
    operation: "center_discipline_set_v1",
    request: {
      ...common,
      center_id: scope.centerId,
      discipline_id: base.discipline.id,
      state: value.state,
      ...(base.version !== null ? { expected_version: base.version } : {}),
      ...(Object.keys(presentation).length ? { presentation } : {}),
    },
  };
}

export async function writeDiscipline(intent: DisciplineIntent) {
  const backend = await scopedBackend(intent.scope),
    requestId = uuidv7();
  const result =
    intent.operation === "discipline_save_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id: requestId })
      : await backend.call(intent.operation, { ...intent.request, request_id: requestId });
  const expected =
    intent.operation === "discipline_save_v1" ? intent.request.discipline_id : intent.base.entityId;
  if (
    !z.uuid().safeParse(result.primary_id).success ||
    (expected && result.primary_id !== expected)
  )
    throw new Error("DISCIPLINE_RESULT_UNAVAILABLE");
  return result;
}

export async function readDisciplineReceipt(intent: DisciplineIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  const type = intent.operation === "discipline_save_v1" ? "disciplines" : "center_disciplines";
  const expected =
    intent.operation === "discipline_save_v1" ? intent.request.discipline_id : intent.base.entityId;
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== type ||
        (expected && receipt.result_reference.id !== expected)))
  )
    throw new Error("DISCIPLINE_RECEIPT_UNAVAILABLE");
  return receipt;
}

export async function readDisciplineResult(intent: DisciplineIntent, primaryId?: string) {
  const level = intent.operation === "discipline_save_v1" ? "organization" : "center";
  const id =
    intent.operation === "discipline_save_v1"
      ? (intent.request.discipline_id ?? primaryId)
      : intent.request.discipline_id;
  if (!id) throw new Error("DISCIPLINE_RESULT_UNAVAILABLE");
  const result = await readDisciplineBase(intent.scope, level, id);
  if (primaryId && result.entityId !== primaryId) throw new Error("DISCIPLINE_RESULT_UNAVAILABLE");
  // A later source version may supersede this command; do not overwrite it by replaying a writer.
  if (
    result.version === null ||
    (intent.request.expected_version !== undefined &&
      result.version <= intent.request.expected_version)
  )
    throw new Error("DISCIPLINE_RESULT_UNAVAILABLE");
  return result;
}
