import { beforeEach, expect, it, vi } from "vitest";
import type {
  NegativeLimitsView,
  ReservationProtectionPreview,
} from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  negativeLimitDraft,
  readNegativeLimit,
  previewNegativeLimit,
  negativeLimitIntent,
  writeNegativeLimit,
  readNegativeLimitReceipt,
  readNegativeLimitResult,
} from "./negative-limit";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  person = id(4),
  discipline = id(5),
  reservation = id(6),
  session = id(7);
const draft = { disciplineId: discipline, quantity: "2", reason: " Synthetic reason " };
let limit: NegativeLimitsView, preview: ReservationProtectionPreview;
beforeEach(() => {
  limit = {
    person_id: person,
    center_id: scope.centerId,
    discipline_id: discipline,
    version: 7,
    override: null,
    default_limit: 0,
    upper_limit: 4,
    effective_limit: 0,
    reserved_deficit: 0,
    consumed_deficit: 0,
    policy_version_ids: [],
    override_version: null,
    personal_override_enabled: true,
  };
  preview = {
    change: {
      kind: "negative_limit",
      person_id: person,
      discipline_id: discipline,
      allowed_negative_credits: 2,
    },
    preview: {
      id: id(10),
      token: "synthetic-preview",
      scope_hash: "synthetic",
      dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
      effects: [],
      blockers: [],
      expires_at: "2099-01-01T00:00:00Z",
    },
    affected: [
      {
        reservation_id: reservation,
        session_id: session,
        person_id: person,
        allocation_ids: [],
        deficit_ids: [],
        quantity: 1,
        source_sale_id: null,
        existing_version: 3,
      },
    ],
    preserves_reservations: true,
    waives_independent_blocks: false,
  };
  call.mockReset();
  call.mockImplementation(async (op) => {
    if (op === "negative_limits_get_v1") return limit;
    if (op === "reservation_impact_preview_v1") return preview;
    if (op === "session_get_v1")
      return { id: session, starts_at: "2026-12-01T10:00:00Z", ends_at: "2026-12-01T11:00:00Z" };
    if (op === "negative_limit_set_v1") return { primary_id: id(15), changed: [], jobs: [] };
    if (op === "entitlements_get_v1") return [];
    if (op === "reservation_list_v1")
      return {
        items: [{ id: reservation, session_id: session, person_id: person, state: "active" }],
        next_cursor: null,
      };
    throw new Error("UNEXPECTED_OPERATION");
  });
});
it("accepts zero but rejects fractional, negative, blank and unsafe limits before a native preview", () => {
  expect(negativeLimitDraft.parse({ ...draft, quantity: "0" }).quantity).toBe(0);
  for (const quantity of ["", "-1", "1.5", "9007199254740992", "1e2", " 2 "])
    expect(() => negativeLimitDraft.parse({ ...draft, quantity })).toThrow();
  expect(() => negativeLimitDraft.parse({ ...draft, reason: " " })).toThrow();
});
it("keeps native policy null distinct from zero and rejects foreign scope or disabled personal override", async () => {
  limit.effective_limit = null;
  expect((await readNegativeLimit(scope, person, discipline)).effective_limit).toBeNull();
  limit.center_id = id(99);
  await expect(readNegativeLimit(scope, person, discipline)).rejects.toThrow(
    "PROFILE_NEGATIVE_SOURCE_UNAVAILABLE",
  );
  limit.center_id = scope.centerId;
  limit.personal_override_enabled = false;
  await expect(previewNegativeLimit(scope, person, draft)).rejects.toThrow(
    "PERSONAL_LIMIT_DISABLED",
  );
  expect(call.mock.calls.some((x) => x[0] === "reservation_impact_preview_v1")).toBe(false);
});
it("binds the preview to the person, discipline, quantity and protected reservation set", async () => {
  const review = await previewNegativeLimit(scope, person, draft);
  const intent = negativeLimitIntent(review);
  expect(intent.request).toMatchObject({
    expected_version: 7,
    person_id: person,
    discipline_id: discipline,
    allowed_negative_credits: 2,
    reason: "Synthetic reason",
    accepted_reservation_ids: [reservation],
    impact_approval: { id: id(10), token: "synthetic-preview" },
  });
  expect(review.affected).toEqual([
    { id: reservation, startsAt: "2026-12-01T10:00:00Z", endsAt: "2026-12-01T11:00:00Z" },
  ]);
  preview.change = {
    ...preview.change,
    kind: "negative_limit",
    person_id: id(99),
    discipline_id: discipline,
    allowed_negative_credits: 2,
  };
  await expect(previewNegativeLimit(scope, person, draft)).rejects.toThrow(
    "PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE",
  );
  preview.change = {
    kind: "negative_limit",
    person_id: person,
    discipline_id: discipline,
    allowed_negative_credits: 2,
  };
  preview.affected[0]!.person_id = id(99);
  await expect(previewNegativeLimit(scope, person, draft)).rejects.toThrow(
    "PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE",
  );
});
it("freezes the exact preview, native version and key across writer retries", async () => {
  const intent = negativeLimitIntent(await previewNegativeLimit(scope, person, draft));
  limit.version = 99;
  preview.preview.token = "changed";
  await writeNegativeLimit(intent);
  await writeNegativeLimit(intent);
  const writes = call.mock.calls.filter((x) => x[0] === "negative_limit_set_v1");
  expect(writes).toHaveLength(2);
  expect({ ...writes[0]![1], request_id: null }).toEqual({ ...writes[1]![1], request_id: null });
  expect(writes[0]![1].request_id).not.toBe(writes[1]![1].request_id);
  expect(writes[0]![1]).toMatchObject({
    expected_version: 7,
    impact_approval: { token: "synthetic-preview" },
  });
  expect(call.mock.calls.some((x) => x[0] === "reservation_impact_apply_v1")).toBe(false);
});
it("requires a newer override result and rejects a foreign receipt without another writer", async () => {
  const intent = negativeLimitIntent(await previewNegativeLimit(scope, person, draft));
  await expect(readNegativeLimitResult(intent, id(15))).rejects.toThrow(
    "PROFILE_NEGATIVE_RESULT_UNAVAILABLE",
  );
  limit.override = 2;
  limit.override_version = 1;
  const result = await readNegativeLimitResult(intent, id(15));
  expect(result.limit.override).toBe(2);
  expect(result.rights).toEqual([]);
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: id(99),
    status: "succeeded",
    result_reference: { type: "negative_limit_overrides", id: id(15) },
  });
  await expect(readNegativeLimitReceipt(intent)).rejects.toThrow(
    "PROFILE_NEGATIVE_RECEIPT_UNAVAILABLE",
  );
  expect(call.mock.calls.some((x) => x[0] === "negative_limit_set_v1")).toBe(false);
});
