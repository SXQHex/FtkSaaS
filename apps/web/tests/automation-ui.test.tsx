import { beforeEach, expect, test, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import tr from "../messages/tr.json";
import { v7 } from "uuid";
import { render } from "./render";
import { SegmentEditor } from "../src/components/automation/automation-editor";
import { AutomationWorkspace } from "../src/components/automation/automation-workspace";
import { DeliverySettings } from "../src/components/automation/delivery-settings";
import { setupStorageKey } from "../src/lib/studio-setup";
import { ownDeliveryScope } from "../src/lib/delivery-settings";
import type { AutomationRecord } from "../src/lib/automation-command";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
beforeEach(() => {
  sessionStorage.clear();
  m.call.mockReset();
});
test("editing an any-only native segment preserves in-array conditions and exposes every condition in review", async () => {
  const u = userEvent.setup();
  const source = {
    id: v7(),
    version: 3,
    name: "Kaynaklar",
    definition: {
      any: [
        { field: "lead_source" as const, operator: "in" as const, value: ["phone", "whatsapp"] },
      ],
    },
  };
  render(<SegmentEditor scope={scope} source={source} onSaved={() => {}} />);
  expect(screen.getByLabelText("Her satıra bir değer")).toHaveValue("phone\nwhatsapp");
  expect(screen.getByLabelText("Koşul alanı")).toHaveValue("lead_source");
  await u.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  expect(screen.getByText(/phone, whatsapp/)).toBeVisible();
  expect(screen.getByRole("button", { name: tr.flows.apply })).toBeDisabled();
  expect(m.call).not.toHaveBeenCalled();
});
const studios = [
  {
    organization: {
      id: scope.orgId,
      name: "Studio",
      state: "active" as const,
      access_mode: "normal" as const,
      version: 1,
    },
    centers: [
      {
        id: scope.centerId,
        name: "Merkez",
        timezone: "Europe/Istanbul",
        state: "active" as const,
        accessible: true,
        version: 1,
      },
    ],
  },
];
function baseSource(op: string, input: Record<string, unknown>) {
  if (op === "settings_catalog_get_v1")
    return {
      scope: input.scope,
      catalog_version: 16,
      fields: [],
      defaults: {},
      brand_packages: [],
      limitations: [],
    };
  if (op === "settings_get_v1")
    return {
      scope: input.scope,
      version: 0,
      values: {},
      overridden_fields: [],
      as_of: "2026-11-07T12:00:00Z",
    };
  if (op === "notifications_list_v1")
    return { items: [], next_cursor: null, as_of: "2026-11-07T12:00:00Z" };
  throw Error("FORBIDDEN");
}
test("selecting another automation drops the former disable approval", async () => {
  const u = userEvent.setup();
  const a: AutomationRecord = {
      id: v7(),
      version: 2,
      definition: {
        name: "A",
        trigger: { kind: "student_inactive", offset_days: 7 },
        action: { kind: "create_followup", channel: "in_app", template_key: "Ara" },
        execution_center_ids: [scope.centerId],
        enabled: true,
      },
    },
    b = { ...a, id: v7(), definition: { ...a.definition, name: "B" } };
  m.call.mockImplementation(async (op, input) => {
    if (op === "management_state_get_v1")
      return {
        items:
          input.operation === "automation_save_v1"
            ? [a, b].map((row) => ({
                state: "active",
                as_of: "2026-11-07T12:00:00Z",
                exists: true,
                operation: "automation_save_v1",
                entity: { type: "automations", id: row.id },
                versions: [{ entity: { type: "automations", id: row.id }, version: row.version }],
                current: {
                  operation: "automation_save_v1",
                  values: {
                    scope: { kind: "center", center_id: scope.centerId },
                    automation_id: row.id,
                    definition: row.definition,
                    recent_jobs: [],
                  },
                },
              }))
            : [],
        next_cursor: null,
      };
    return baseSource(op, input);
  });
  render(<AutomationWorkspace actorId={scope.actorId} studios={studios} />);
  await u.click(screen.getByRole("button", { name: "Otomasyonlar" }));
  await u.click(await screen.findByRole("button", { name: "A" }));
  await u.click(screen.getByRole("button", { name: "Otomasyonu kapat" }));
  expect(screen.getByText(/A · Otomasyonu kapat/)).toBeVisible();
  await u.click(screen.getByRole("button", { name: "B" }));
  expect(screen.queryByText(/A · Otomasyonu kapat/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: tr.flows.apply })).not.toBeInTheDocument();
});
test("denied automation discovery never exposes a working create form", async () => {
  m.call.mockImplementation(async (op, input) => baseSource(op, input));
  const u = userEvent.setup();
  render(<AutomationWorkspace actorId={scope.actorId} studios={studios} />);
  await u.click(screen.getByRole("button", { name: "Otomasyonlar" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Yeni oluştur" })).toBeDisabled();
  expect(screen.queryByRole("region", { name: "Otomasyonu düzenle" })).not.toBeInTheDocument();
});
test("global quiet-hour recovery uses the same actor journal after organization changes and sends no org", async () => {
  const key = v7(),
    user = ownDeliveryScope(scope.actorId);
  sessionStorage.setItem(
    setupStorageKey(user, "delivery:user"),
    JSON.stringify({
      command: {
        operation: "settings_update_v1",
        input: {
          scope: "user",
          operation_key: key,
          expected_version: 0,
          patch: { quiet_hours_enabled: false },
        },
      },
    }),
  );
  m.call.mockImplementation(async (op) => {
    if (op === "operation_status_get_v1")
      return {
        operation: "settings_update_v1",
        key,
        status: "failed_final",
        result_reference: null,
      };
    if (op === "settings_catalog_get_v1") return { scope: "user", fields: [] };
    if (op === "settings_get_v1")
      return {
        scope: "user",
        version: 0,
        values: {},
        overridden_fields: [],
        as_of: "2026-11-07T12:00:00Z",
      };
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<DeliverySettings scope={{ actorId: scope.actorId, orgId: v7() }} target="user" />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  const request = m.call.mock.calls.find(([op]) => op === "operation_status_get_v1")![1];
  expect(request).not.toHaveProperty("org_id");
  expect(sessionStorage.getItem(setupStorageKey(user, "delivery:user"))).toBeNull();
});

test("boolean and credit fields offer only meaningful typed operators and retain numeric values in review", async () => {
  const u = userEvent.setup();
  render(<SegmentEditor scope={scope} source={null} onSaved={() => {}} />);
  const operator = screen.getByLabelText("Karşılaştırma");
  expect(within(operator).queryByRole("option", { name: "Listede" })).not.toBeInTheDocument();
  expect(within(operator).queryByRole("option", { name: "Büyük" })).not.toBeInTheDocument();
  await u.selectOptions(screen.getByLabelText("Koşul alanı"), "remaining_credits");
  expect(
    within(screen.getByLabelText("Karşılaştırma")).queryByRole("option", { name: "Listede" }),
  ).not.toBeInTheDocument();
  await u.selectOptions(screen.getByLabelText("Karşılaştırma"), "gt");
  await u.clear(screen.getByLabelText("Değer"));
  await u.type(screen.getByLabelText("Değer"), "3");
  await u.type(screen.getByLabelText("Ad"), "Krediler");
  await u.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  expect(screen.getByText(/Kalan ders kredisi · Büyük · 3/)).toBeVisible();
});

test("organization history can include a non-retryable job from an earlier execution center", async () => {
  const { readAutomations } = await import("../src/lib/automations");
  const id = v7();
  m.call.mockResolvedValue({
    items: [
      {
        operation: "automation_save_v1",
        exists: true,
        state: "active",
        as_of: "2026-11-07T12:00:00Z",
        entity: { type: "automations", id },
        versions: [{ entity: { type: "automations", id }, version: 4 }],
        current: {
          operation: "automation_save_v1",
          values: {
            automation_id: id,
            scope: { kind: "organization" },
            definition: {
              name: "Geçmiş",
              trigger: { kind: "student_inactive", offset_days: 7 },
              action: { kind: "create_followup", channel: "in_app", template_key: "Ara" },
              execution_center_ids: [scope.centerId],
              enabled: true,
            },
            recent_jobs: [
              {
                id: v7(),
                version: 2,
                person_id: v7(),
                center_id: v7(),
                state: "succeeded",
                attempts: 1,
                next_attempt_at: null,
                safe_error_code: null,
                result_reference: { type: "crm_activities", id: v7() },
                retry_available: false,
              },
            ],
          },
        },
      },
    ],
    as_of: "2026-11-07T12:00:00Z",
    next_cursor: null,
  });
  const page = await readAutomations(scope, "automation", undefined, "organization");
  expect(page.automations).toHaveLength(1);
  expect(page.automations[0]!.jobs![0]!.retry_available).toBe(false);
});
