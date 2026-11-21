import { beforeEach, expect, it, vi } from "vitest";
import {
  readSettingsDocument,
  parseSettingsDocumentPatch,
  settingsDocumentIntent,
  readSettingsDocumentResult,
  writeSettingsDocument,
} from "./settings-document";
import { readPublicForms, readPublicConsentSources } from "./settings-public-reader";
import {
  parseEditablePolicy,
  previewSettingsPolicy,
  settingsPolicyIntent,
  writeSettingsPolicy,
} from "./settings-policy-command";
import { readSettingsSubscription } from "./settings-subscription";
import {
  settingsDowngradeIntent,
  writeSettingsDowngrade,
  readSettingsDowngradeResult,
  readDowngradeSource,
} from "./settings-downgrade";
import {
  readTeamPage,
  prepareTeamPermission,
  writeTeam,
  teamResult,
  prepareTeamRole,
} from "./settings-team";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const at = "2026-11-17T12:00:00Z";
const publicFields = ["name", "contact"];
const proof = {
  purpose: "application",
  version: "approved-1",
  required: true,
  content_template_id: id(4),
};
const config = {
  scope: "organization",
  version: 1,
  values: {
    public_profile_enabled: false,
    public_fields: publicFields,
    public_application_form: { form_id: id(5), consents: [proof] },
  },
  as_of: at,
  overridden_fields: [],
};
const catalog = {
  scope: "organization",
  catalog_version: 24,
  fields: ["public_profile_enabled", "public_fields", "public_application_form"].map((key) => ({
    key,
    writable: true,
    group: "O01",
    consumer: "public_profile",
  })),
  defaults: {},
  brand_packages: [],
  limitations: [],
};
const policy = {
  key: "reservation_window" as const,
  scope: { kind: "organization" as const },
  value: {
    kind: "window" as const,
    opens_minutes_before: 10080,
    closes_minutes_before: 60,
    manager_exception: false,
  },
  version: 2,
  effective_at: at,
  mandatory: false,
};
const target = {
  plan: "starter" as const,
  target: { id: id(10), period: "monthly" as const, amount_minor: "50000", currency: "TRY" },
  effective_at: "2026-12-01T00:00:00Z",
  kept_center_required: true,
};
const sub = {
  state: "active",
  plan: "pro",
  period_start: "2026-11-01T00:00:00Z",
  period_end: target.effective_at,
  grace_until: null,
  cancel_at_period_end: false,
  pending_change: null,
  subscription_version: 2,
  limits: { entries: [] },
  usage: { entries: [] },
  billing: {
    current: { id: id(11), period: "monthly", amount_minor: "100000", currency: "TRY" },
    period_change_options: [],
    pending_period_change: null,
    downgrade_options: [target],
  },
};
const snapshot = (
  operation: string,
  type: string,
  entityId: string,
  values: unknown,
  versions = [{ entity: { type, id: entityId }, version: 2 }],
) => ({
  items: [
    {
      operation,
      entity: { type, id: entityId },
      exists: true,
      state: "active",
      versions,
      current: { operation, values },
      as_of: at,
    },
  ],
  next_cursor: null,
  as_of: at,
});
beforeEach(() => call.mockReset());
it("enforces exact public field and consent array bounds rather than accepting arbitrary configuration", () => {
  expect(
    parseSettingsDocumentPatch({
      public_fields: ["name", "contact"],
      public_application_form: null,
    }),
  ).toEqual({ public_fields: ["name", "contact"], public_application_form: null });
  expect(() => parseSettingsDocumentPatch({ public_fields: ["name", "name"] })).toThrow();
  expect(() =>
    parseSettingsDocumentPatch({ public_application_form: { form_id: id(5), consents: [] } }),
  ).toThrow();
  expect(() =>
    parseSettingsDocumentPatch({
      public_application_form: {
        form_id: id(5),
        consents: [{ ...proof, content_template_id: "unknown" }],
      },
    }),
  ).toThrow();
  expect(() => parseSettingsDocumentPatch({ service_secret: "no" })).toThrow();
});
it("readback verifies structured consent equality and public field set equality after ACK, without replaying the writer", async () => {
  let version = 1;
  call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? catalog
      : op === "settings_get_v1"
        ? {
            ...config,
            version,
            values:
              version === 1
                ? config.values
                : {
                    ...config.values,
                    public_fields: ["contact", "name"],
                    public_application_form: structuredClone(config.values.public_application_form),
                  },
          }
        : { primary_id: scope.accountId },
  );
  const before = await readSettingsDocument(scope, "organization");
  const patch = parseSettingsDocumentPatch({
    public_fields: ["name", "contact"],
    public_application_form: config.values.public_application_form,
  });
  const intent = await settingsDocumentIntent(scope, "organization", before, patch);
  await writeSettingsDocument(intent);
  version = 2;
  await expect(readSettingsDocumentResult(intent, scope.accountId)).resolves.toMatchObject({
    document: { version: 2 },
  });
  expect(call.mock.calls.filter((row) => row[0] === "settings_update_v1")).toHaveLength(1);
});
it("configured forms are explicitly discovered by scope with native cursor and no private form lookup", async () => {
  call.mockResolvedValue({
    ...catalog,
    scope: "center",
    configured_forms: {
      items: [
        {
          form_id: id(5),
          center_id: scope.centerId,
          channel: "web_form",
          form_key: "approved-form",
          enabled: true,
        },
      ],
      next_cursor: "next",
    },
  });
  await readPublicForms(scope, "center", "before");
  expect(call.mock.calls[0]![1]).toMatchObject({
    scope: "center",
    center_id: scope.centerId,
    include_configured_forms: true,
    configured_forms_page: { limit: 50, cursor: "before" },
  });
});
it("consent selection uses only published catalog sources with neither retirement nor invalidation", async () => {
  const row = {
    org_id: scope.orgId,
    center_id: null,
    scope_key: `organization:${scope.orgId}`,
    code: "document.synthetic",
    channel: "document",
    language: "tr",
    version: 1,
    source_version: "approved-1",
    content: { title: "Sentetik kaynak", text: "Sentetik onay metni" },
    id: id(4),
    state: "published",
    revision: 1,
    created_at: at,
    published_at: at,
    retired: false,
    invalidated: false,
  };
  call.mockResolvedValue({
    items: [
      row,
      { ...row, id: id(6), state: "draft" },
      { ...row, id: id(7), retired: true },
      { ...row, id: id(8), invalidated: true },
    ],
    as_of: at,
  });
  expect(
    (await readPublicConsentSources(scope, "organization", "document.synthetic")).map(
      (row) => row.id,
    ),
  ).toEqual([id(4)]);
  expect(call.mock.calls[0]![1]).toMatchObject({
    scope_key: `organization:${scope.orgId}`,
    channel: "document",
  });
});
it("policy value parsing rejects unsafe quantities and invalid valuation values before a command", () => {
  expect(parseEditablePolicy(policy.value)).toEqual(policy.value);
  expect(() =>
    parseEditablePolicy({ ...policy.value, opens_minutes_before: Number.MAX_SAFE_INTEGER + 1 }),
  ).toThrow();
  expect(() =>
    parseEditablePolicy({
      kind: "valuation",
      format: "private",
      discipline_id: id(8),
      currency: "TRY",
      amount_minor: "9223372036854775808",
    }),
  ).toThrow();
});
it("policy edit rejects DST ambiguity before reading or writing and freezes matching native protection proof", async () => {
  await expect(
    previewSettingsPolicy(
      scope,
      "organization",
      policy,
      policy.value,
      "2026-10-25T02:30",
      "Europe/Berlin",
      false,
      "Sentetik gerekçe",
    ),
  ).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
  call.mockImplementation(async (op, r) => {
    if (op === "policies_get_v1") return [policy];
    if (op === "reservation_impact_preview_v1")
      return {
        preview: {
          id: id(8),
          token: "synthetic",
          scope_hash: "synthetic",
          dependencies: { versions: [] },
          effects: [],
          blockers: [],
          expires_at: "2099-01-01T00:00:00Z",
        },
        change: r.change,
        affected: [],
        preserves_reservations: true,
        waives_independent_blocks: false,
      };
    return { primary_id: id(9) };
  });
  const review = await previewSettingsPolicy(
    scope,
    "organization",
    policy,
    { ...policy.value, closes_minutes_before: 120 },
    "2026-12-01T15:00",
    "Europe/Istanbul",
    true,
    "Sentetik gerekçe",
  );
  const intent = settingsPolicyIntent(review);
  await writeSettingsPolicy(intent);
  await writeSettingsPolicy(intent);
  const writes = call.mock.calls.filter((row) => row[0] === "policy_publish_v1");
  expect(writes).toHaveLength(2);
  expect(writes[0]![1]).toMatchObject({
    operation_key: intent.key,
    effective_at: "2026-12-01T12:00:00Z",
    mandatory: true,
    impact_approval: { id: id(8), token: "synthetic" },
    accepted_reservation_ids: [],
  });
  expect(writes[1]![1].operation_key).toBe(intent.key);
});
it("changed policy source prevents even an impact preview, rather than silently rebasing the draft", async () => {
  call.mockResolvedValue([{ ...policy, version: 3 }]);
  await expect(
    previewSettingsPolicy(
      scope,
      "organization",
      policy,
      policy.value,
      "2026-12-01T15:00",
      "Europe/Istanbul",
      false,
      "Sentetik gerekçe",
    ),
  ).rejects.toThrow("POLICY_SOURCE_CHANGED");
  expect(call.mock.calls.map((row) => row[0])).toEqual(["policies_get_v1"]);
});
it("downgrade uses actual target terms, explicit kept scope including zero students and a versioned source", async () => {
  call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? sub
      : snapshot("subscription_downgrade_request_v1", "saas_subscriptions", id(12), {
          target_plan_id: target.target.id,
          expected_version: 2,
          kept_center_id: scope.centerId,
        }),
  );
  const before = await readSettingsSubscription(scope);
  const kept = {
    room_id: id(13),
    discipline_id: id(14),
    instructor_id: id(15),
    student_person_ids: [],
  };
  const intent = await settingsDowngradeIntent(before, target.target.id, scope.centerId, kept);
  call.mockResolvedValue({ primary_id: id(16) });
  await writeSettingsDowngrade(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    expected_version: 2,
    target_plan_id: target.target.id,
    kept_center_id: scope.centerId,
    kept_scope: kept,
  });
  call.mockResolvedValue({
    ...sub,
    subscription_version: 3,
    pending_change: { type: "saas_change_requests", id: id(16) },
    pending_starter_scope: { center_id: scope.centerId, scope: kept },
  });
  await expect(readSettingsDowngradeResult(intent, id(16))).resolves.toMatchObject({
    subscription: { plan: "pro" },
  });
});
it("downgrade rejects stale or cross-center projections and never picks an implicit retained center", async () => {
  call.mockResolvedValue(sub);
  const before = await readSettingsSubscription(scope);
  await expect(settingsDowngradeIntent(before, target.target.id)).rejects.toThrow();
  expect(call.mock.calls).toHaveLength(1);
  call.mockResolvedValue(
    snapshot("subscription_downgrade_request_v1", "saas_subscriptions", id(12), {
      target_plan_id: target.target.id,
      expected_version: 2,
      kept_center_id: id(19),
    }),
  );
  await expect(readDowngradeSource(before, target.target.id, scope.centerId)).rejects.toThrow();
});
it("team directory reads only one native role page and its actual visible people", async () => {
  const role = {
    id: id(20),
    person_id: id(21),
    role: "staff",
    scope_center_id: scope.centerId,
    state: "active",
    version: 4,
    account_access_granted: false,
  };
  call.mockImplementation(async (op) =>
    op === "roles_list_v1"
      ? { items: [role], as_of: at, next_cursor: "next" }
      : {
          id: id(21),
          display_name: "Sentetik personel",
          version: 3,
          relationships: [],
          contacts: [],
        },
  );
  const page = await readTeamPage(scope, "staff", "before");
  expect(page.records[0]?.bound).toBe(false);
  expect(call.mock.calls.filter((row) => row[0] === "person_get_v1")).toHaveLength(1);
  expect(call.mock.calls[0]![1]).toMatchObject({
    role: "staff",
    state: "active",
    center_id: scope.centerId,
    page: { limit: 20, cursor: "before" },
  });
  expect(call.mock.calls.some((row) => row[0] === "management_state_get_v1")).toBe(false);
});
it("single permission change uses the real person version and verifies the native effective override after ACK", async () => {
  let version = 3,
    enabled = false;
  call.mockImplementation(async (op) =>
    op === "management_state_get_v1"
      ? snapshot(
          "permission_set_v1",
          "people",
          id(21),
          { person_id: id(21), permission: "sale.write", enabled, override_exists: enabled },
          [{ entity: { type: "people", id: id(21) }, version }],
        )
      : { primary_id: id(22) },
  );
  const intent = await prepareTeamPermission(scope, id(21), "sale.write", true);
  await writeTeam(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    person_id: id(21),
    permission: "sale.write",
    enabled: true,
    expected_version: 3,
  });
  version = 4;
  enabled = true;
  await teamResult(intent, id(22));
  expect(call.mock.calls.filter((row) => row[0] === "permission_set_v1")).toHaveLength(1);
});
it("existing active role cannot be assigned again and another center does not satisfy this center role", async () => {
  const role = {
    id: id(20),
    person_id: id(21),
    role: "staff",
    scope_center_id: scope.centerId,
    state: "active",
    version: 2,
  };
  call.mockResolvedValue({ items: [role], next_cursor: null, as_of: at });
  await expect(prepareTeamRole(scope, id(21), "staff", true, "")).rejects.toThrow(
    "TEAM_ROLE_ALREADY_ACTIVE",
  );
  call.mockResolvedValue({
    items: [{ ...role, scope_center_id: id(23) }],
    next_cursor: null,
    as_of: at,
  });
  const intent = await prepareTeamRole(scope, id(21), "staff", true, "");
  expect(intent.operation).toBe("role_assign_v1");
});

it("OM directory omits center, binds role/state/cursor and rejects a foreign native filter result", async () => {
  const row = {
    id: id(25),
    person_id: id(21),
    role: "org_manager",
    scope_center_id: null,
    state: "inactive",
    version: 3,
    account_access_granted: false,
  };
  call.mockImplementation(async (op) =>
    op === "roles_list_v1"
      ? { items: [row], as_of: at, next_cursor: null }
      : {
          id: id(21),
          display_name: "Sentetik yönetici",
          version: 3,
          relationships: [],
          contacts: [],
        },
  );
  await readTeamPage(scope, "org_manager", "before", "organization", "inactive");
  expect(call.mock.calls[0]![1]).toMatchObject({
    role: "org_manager",
    state: "inactive",
    page: { cursor: "before" },
  });
  expect(call.mock.calls.every((row) => !("center_id" in row[1]))).toBe(true);
  call.mockResolvedValue({
    items: [{ ...row, role: "center_manager", scope_center_id: scope.centerId }],
    as_of: at,
    next_cursor: null,
  });
  await expect(
    readTeamPage(scope, "org_manager", undefined, "organization", "inactive"),
  ).rejects.toThrow();
});
it("manager assignment skips unsupported management-state preview", async () => {
  call.mockResolvedValue({ items: [], as_of: at, next_cursor: null });
  const manager = await prepareTeamRole(scope, id(21), "center_manager", true, "");
  expect(manager.operation).toBe("center_manager_assign_v1");
  const organizationManager = await prepareTeamRole(scope, id(21), "org_manager", true, "");
  expect(organizationManager.operation).toBe("org_manager_assign_v1");
  expect(call.mock.calls.filter(([operation]) => operation === "roles_list_v1")).toHaveLength(2);
  expect(call.mock.calls.some(([operation]) => operation === "management_state_get_v1")).toBe(
    false,
  );
});
it("manager changes use dedicated native commands, with org scope and current assignment version", async () => {
  let manager = {
    id: id(25),
    person_id: id(21),
    role: "center_manager",
    scope_center_id: scope.centerId,
    state: "active",
    version: 5,
  };
  call.mockImplementation(async (op, r) =>
    op === "roles_list_v1"
      ? { items: [manager], as_of: at, next_cursor: null }
      : op === "management_state_get_v1"
        ? snapshot(r.operation, "role_assignments", manager.id, { person_id: manager.person_id }, [
            { entity: { type: "role_assignments", id: manager.id }, version: manager.version },
          ])
        : { primary_id: manager.id },
  );
  const revoke = await prepareTeamRole(scope, id(21), "center_manager", false, "Sentetik gerekçe");
  await writeTeam(revoke);
  expect(call.mock.calls.at(-1)?.[0]).toBe("center_manager_revoke_v1");
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    person_id: id(21),
    center_id: scope.centerId,
    expected_version: 5,
  });
  manager = { ...manager, state: "inactive", version: 6 };
  await teamResult(revoke, manager.id);
  call.mockImplementation(async (op, r) =>
    op === "roles_list_v1"
      ? { items: [], as_of: at, next_cursor: null }
      : op === "management_state_get_v1"
        ? {
            items: [
              {
                operation: r.operation,
                exists: false,
                entity: null,
                state: null,
                versions: [],
                current: null,
                as_of: at,
              },
            ],
            as_of: at,
            next_cursor: null,
          }
        : { primary_id: id(26) },
  );
  const assign = await prepareTeamRole(scope, id(21), "org_manager", true, "");
  await writeTeam(assign);
  expect(call.mock.calls.at(-1)?.[0]).toBe("org_manager_assign_v1");
  expect(call.mock.calls.at(-1)?.[1]).not.toHaveProperty("center_id");
  expect(call.mock.calls.some((row) => row[0] === "role_revoke_v1")).toBe(false);
});
it("only an explicitly unbound active operational role may be rebound; verified binding never reassigns", async () => {
  const role = {
    id: id(20),
    person_id: id(21),
    role: "staff",
    scope_center_id: scope.centerId,
    state: "active",
    version: 2,
    account_access_granted: false,
  };
  call.mockResolvedValue({ items: [role], as_of: at, next_cursor: null });
  expect((await prepareTeamRole(scope, id(21), "staff", true, "")).operation).toBe(
    "role_assign_v1",
  );
  call.mockResolvedValue({
    items: [{ ...role, account_access_granted: true }],
    as_of: at,
    next_cursor: null,
  });
  await expect(prepareTeamRole(scope, id(21), "staff", true, "")).rejects.toThrow(
    "TEAM_ROLE_ALREADY_ACTIVE",
  );
});
