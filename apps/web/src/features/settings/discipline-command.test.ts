import { beforeEach, expect, it, vi } from "vitest";
import type { DisciplineBase } from "./discipline-reader";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readDisciplineBase } from "./discipline-reader";
import {
  disciplineDraft,
  disciplineIntent,
  readDisciplineReceipt,
  readDisciplineResult,
} from "./discipline-command";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const id = "019a7b00-0000-7000-8000-000000000009",
  relationId = "019a7b00-0000-7000-8000-000000000021";
function base(): DisciplineBase {
  return {
    scope: { ...scope },
    level: "center",
    entityId: relationId,
    version: 5,
    discipline: {
      id,
      name: "Örnek disiplin",
      state: "active",
      version: 99,
      presentation: {
        organization: {
          description: null,
          color: null,
          icon: null,
          display_order: 0,
          public_visible: false,
          allow_center_description: false,
        },
        center: {
          id: relationId,
          state: "active",
          version: 5,
          presentation: { description: "", public_visible: false },
        },
      },
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
});

it("resolves an exactly absent center relation from the permitted master catalog without supplying another entity's version", async () => {
  const source = base();
  source.discipline.presentation.center = null;
  call
    .mockResolvedValueOnce({
      items: [
        {
          operation: "center_discipline_set_v1",
          exists: false,
          entity: null,
          versions: [],
          state: null,
          current: null,
        },
      ],
      next_cursor: null,
    })
    .mockResolvedValueOnce({ items: [source.discipline], next_cursor: null });
  const result = await readDisciplineBase(scope, "center", id);
  expect(call.mock.calls[0]?.[1].selector).toEqual({
    operation: "center_discipline_set_v1",
    key: { discipline_id: id, include_deactivation_effects: false },
  });
  expect(call.mock.calls[1]?.[1]).not.toHaveProperty("center_id");
  const intent = disciplineIntent(scope, "center", disciplineDraft(result), result);
  expect(intent.request).not.toHaveProperty("expected_version");
  expect(intent.request).not.toHaveProperty("presentation");
});

it("uses the relation version and preserves a stored local description when organization permission is closed", () => {
  const source = base(),
    draft = { ...disciplineDraft(source), publicVisible: true };
  const intent = disciplineIntent(scope, "center", draft, source);
  expect(intent.request.expected_version).toBe(5);
  expect(intent.request.presentation).toEqual({ public_visible: true });
  expect(() => disciplineIntent(scope, "center", { ...draft, description: null }, source)).toThrow(
    "DISCIPLINE_LOCAL_DESCRIPTION_FORBIDDEN",
  );
  expect(() =>
    disciplineIntent(
      { ...scope, centerId: "019a7b00-0000-7000-8000-000000000099" },
      "center",
      draft,
      source,
    ),
  ).toThrow("DISCIPLINE_SOURCE_UNAVAILABLE");
});

it("rejects a management source that substitutes the master version for the relation version", async () => {
  const source = base();
  call
    .mockResolvedValueOnce({
      items: [
        {
          operation: "center_discipline_set_v1",
          exists: true,
          entity: { type: "center_disciplines", id: relationId },
          state: "active",
          versions: [{ entity: { type: "center_disciplines", id: relationId }, version: 99 }],
          current: {
            operation: "center_discipline_set_v1",
            values: { discipline_id: id, state: "active" },
          },
        },
      ],
      next_cursor: null,
    })
    .mockResolvedValueOnce({ items: [source.discipline], next_cursor: null });
  await expect(readDisciplineBase(scope, "center", id)).rejects.toThrow(
    "DISCIPLINE_SOURCE_UNAVAILABLE",
  );
});

it("keeps explicit local null distinct from empty text and sends only the changed patch", () => {
  const source = base();
  source.discipline.presentation.organization.allow_center_description = true;
  const draft = { ...disciplineDraft(source), description: null };
  const intent = disciplineIntent(scope, "center", draft, source);
  expect(intent.request.presentation).toEqual({ description: null });
  expect(intent.request).not.toHaveProperty("name");
});

it("requires a current nonblocking deactivation source and carries its proof without cancelling referenced records", () => {
  const source = base(),
    draft = { ...disciplineDraft(source), state: "inactive" as const };
  expect(() => disciplineIntent(scope, "center", draft, source)).toThrow(
    "DISCIPLINE_EFFECTS_UNAVAILABLE",
  );
  source.effects = {
    blocking: true,
    counts: {
      sessions: 1,
      reservations: 0,
      requests: 0,
      waitlist: 0,
      offers: 0,
      classes: 1,
      programs: 0,
      products: 0,
      sales: 0,
    },
    items: [],
    proof: "synthetic-proof",
    truncated: false,
  };
  expect(() => disciplineIntent(scope, "center", draft, source)).toThrow(
    "DISCIPLINE_OPEN_OPERATIONS",
  );
  source.effects.blocking = false;
  source.effects.counts.sessions = 0;
  const intent = disciplineIntent(scope, "center", draft, source);
  expect(intent.request.deactivation_proof).toBe("synthetic-proof");
  expect(intent.request).not.toHaveProperty("cancel");
  expect(call).not.toHaveBeenCalled();
});

it("rejects receipt keys and result types from a different command", async () => {
  const source = base(),
    intent = disciplineIntent(
      scope,
      "center",
      { ...disciplineDraft(source), publicVisible: true },
      source,
    );
  call.mockResolvedValue({
    operation: intent.operation,
    key: "another-key",
    status: "succeeded",
    result_available: true,
    result_reference: { type: "center_disciplines", id: relationId },
  });
  await expect(readDisciplineReceipt(intent)).rejects.toThrow("DISCIPLINE_RECEIPT_UNAVAILABLE");
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "disciplines", id },
  });
  await expect(readDisciplineReceipt(intent)).rejects.toThrow("DISCIPLINE_RECEIPT_UNAVAILABLE");
});

it("does not guess a new master identity from its name when an expired result has no reference", async () => {
  const intent = disciplineIntent(scope, "organization", {
    ...disciplineDraft(),
    name: "Örnek yeni disiplin",
  });
  await expect(readDisciplineResult(intent)).rejects.toThrow("DISCIPLINE_RESULT_UNAVAILABLE");
  expect(call).not.toHaveBeenCalled();
});
