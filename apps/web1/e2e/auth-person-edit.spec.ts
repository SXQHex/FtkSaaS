import type { RequestPersonUpdate } from "../src/lib/api-contracts/generated.js";
import { test, expect } from "./test.js";
import { mockMemberLifecycle } from "./member-lifecycle-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const text = common.personEdit;
async function setup(
  page: import("@playwright/test").Page,
  options: { unknown?: boolean; unread?: boolean; stale?: boolean; denied?: boolean } = {},
) {
  const f = await mockMemberLifecycle(page);
  const policy = { source: "person" as const, person_update_writable: true };
  f.person.field_policy = {
    display_name: policy,
    given_name: { ...policy, person_update_writable: false },
    family_name: { ...policy, person_update_writable: false },
  };
  f.person.contacts = [
    {
      kind: "email",
      value: "native@example.test",
      field_policy: { source: "native_auth", person_update_writable: false },
    },
    { kind: "email", value: "local@example.test", field_policy: policy },
    { kind: "phone", value: "+905550000001" },
  ];
  const originalRelationships = structuredClone(f.person.relationships),
    originalDisciplines = structuredClone(f.person.discipline_relationships);
  const writes: RequestPersonUpdate[] = [],
    receipts: { key: string }[] = [],
    otherWrites: string[] = [];
  const committed = new Map<string, unknown>();
  let unread = false,
    stale = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string) =>
      route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (
      [
        "student_activate_v1",
        "account_access_send_v1",
        "role_assign_v1",
        "person_discipline_set_v1",
      ].includes(op)
    ) {
      otherWrites.push(op);
      return reject("FORBIDDEN");
    }
    if (op === "person_get_v1" && r.person_id === I.instructor) {
      if (options.unread && committed.size && !unread) {
        unread = true;
        return route.abort("failed");
      }
      return send(f.person);
    }
    if (op === "person_update_v1") {
      writes.push(r);
      expect(r).toMatchObject({ org_id: I.org, center_id: I.center, person_id: I.instructor });
      if (options.denied) return reject("FORBIDDEN");
      if (committed.has(r.operation_key)) return send(committed.get(r.operation_key));
      if (options.stale && !stale) {
        stale = true;
        f.person.version++;
        return reject("VERSION_CONFLICT");
      }
      expect(r.expected_version).toBe(f.person.version);
      if (r.patch.display_name) f.person.display_name = r.patch.display_name;
      if (r.patch.contacts) {
        expect(r.patch.contacts).toContainEqual({ kind: "email", value: "native@example.test" });
        expect(r.patch.contacts).toContainEqual({ kind: "phone", value: "+905550000001" });
        f.person.contacts = r.patch.contacts.map(
          (row: { kind: "email" | "phone"; value: string }) => ({
            ...row,
            ...(() => {
              const original = f.person.contacts?.find(
                (old) => old.kind === row.kind && old.value === row.value,
              );
              return original ? original : { field_policy: policy };
            })(),
          }),
        );
      }
      f.person.version++;
      const result = { primary_id: f.person.id, version: f.person.version, changed: [], jobs: [] };
      committed.set(r.operation_key, result);
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send(result);
    }
    if (op === "operation_status_get_v1" && r.operation === "person_update_v1") {
      receipts.push(r);
      expect(committed.has(r.key)).toBe(true);
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "people", id: f.person.id },
      });
    }
    return route.fallback();
  });
  await page.getByRole("button", { name: text.title, exact: true }).click();
  const panel = page.getByRole("dialog", { name: text.title, exact: true });
  await expect(
    panel.getByRole("textbox", { name: common.people.fullName, exact: true }),
  ).toHaveValue(f.person.display_name);
  return {
    ...f,
    writes,
    receipts,
    committed,
    otherWrites,
    panel,
    originalRelationships,
    originalDisciplines,
  };
}
async function review(
  page: import("@playwright/test").Page,
  panel: import("@playwright/test").Locator,
) {
  await panel
    .getByRole("textbox", { name: common.people.fullName, exact: true })
    .fill("Yeni sentetik kişi");
  await panel.getByRole("button", { name: text.review, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: text.review, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: text.apply, exact: true })).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: common.settings.acceptReview, exact: true })
    .press("Space");
  return dialog;
}
test("person details preserve native/unknown fields and save local name/contact separately from student status", async ({
  page,
}) => {
  const f = await setup(page);
  await expect(f.panel.getByRole("textbox", { name: "E-posta 1", exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(f.panel.getByRole("textbox", { name: "Telefon 3", exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await f.panel.getByRole("textbox", { name: "E-posta 2", exact: true }).fill("");
  await f.panel.getByRole("button", { name: text.addEmail, exact: true }).click();
  await f.panel.getByRole("textbox", { name: "E-posta 4", exact: true }).fill("new@example.test");
  const dialog = await review(page, f.panel);
  expect(f.writes).toHaveLength(0);
  await expect(dialog).toContainText("local@example.test");
  await expect(dialog).toContainText("new@example.test");
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes).toHaveLength(1);
  expect(f.committed.size).toBe(1);
  expect(f.otherWrites).toEqual([]);
  expect(f.person.relationships).toEqual(f.originalRelationships);
  expect(f.person.discipline_relationships).toEqual(f.originalDisciplines);
  expect(f.writes[0]!.patch).toEqual({
    display_name: "Yeni sentetik kişi",
    contacts: [
      { kind: "email", value: "native@example.test" },
      { kind: "phone", value: "+905550000001" },
      { kind: "email", value: "new@example.test" },
    ],
  });
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yeni sentetik kişi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: text.title, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "E-posta 3", exact: true })).toHaveValue(
    "new@example.test",
  );
});
test("lost person update reply recovers its receipt without repeating the mutation", async ({
  page,
}) => {
  const f = await setup(page, { unknown: true });
  const dialog = await review(page, f.panel);
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.unknown);
  await expect(
    dialog.getByRole("button", { name: common.settings.discard, exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes).toHaveLength(1);
  expect(f.receipts).toHaveLength(1);
  expect(f.receipts[0]!.key).toBe(f.writes[0]!.operation_key);
});
test("ACK read failure rereads only the person; it never rewrites or asks for another receipt", async ({
  page,
}) => {
  const f = await setup(page, { unread: true });
  const dialog = await review(page, f.panel);
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states["saved-unread"]);
  await dialog.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes).toHaveLength(1);
  expect(f.receipts).toHaveLength(0);
});
test("stale person version requires closing and reviewing fresh fields before a new explicit write", async ({
  page,
}) => {
  const f = await setup(page, { stale: true });
  let dialog = await review(page, f.panel);
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.stale);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await f.panel.getByRole("button", { name: common.memberProfile.close, exact: true }).click();
  await page.getByRole("button", { name: text.title, exact: true }).click();
  dialog = await review(page, page.getByRole("dialog", { name: text.title, exact: true }));
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]!.expected_version).toBe(f.writes[0]!.expected_version + 1);
  expect(f.writes[1]!.operation_key).not.toBe(f.writes[0]!.operation_key);
  expect(f.committed.size).toBe(1);
});
test("native write denial never reports saved person details or creates relationships", async ({
  page,
}) => {
  const f = await setup(page, { denied: true });
  const name = f.person.display_name;
  const dialog = await review(page, f.panel);
  await dialog.getByRole("button", { name: text.apply, exact: true }).click();
  await expect(page.getByText(text.states.saved, { exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.committed.size).toBe(0);
  expect(f.person.display_name).toBe(name);
  expect(f.otherWrites).toEqual([]);
});
