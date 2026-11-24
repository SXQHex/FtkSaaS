import { activate, attemptOutsideDismissal } from "./device-input.js";
import { checkLockedWorkspaceScope } from "./auth-fixture.js";
import { test, expect } from "./test.js";
import { mockMemberLifecycle } from "./member-lifecycle-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const text = common.studentDiscipline;
async function setup(
  page: import("@playwright/test").Page,
  options: {
    existing?: boolean;
    unknown?: boolean;
    unread?: boolean;
    stale?: boolean;
    denied?: boolean;
    inactive?: boolean;
  } = {},
) {
  const f = await mockMemberLifecycle(page, { studentActive: !options.inactive });
  if (options.existing)
    f.person.discipline_relationships.push({
      center_id: I.center,
      discipline_id: I.discipline,
      kind: "student",
      state: "active",
      version: 3,
    });
  const unrelated = structuredClone(
    f.person.discipline_relationships.filter((row) => row.kind !== "student"),
  );
  const writes: Record<string, unknown>[] = [],
    receipts: Record<string, unknown>[] = [];
  const committed = new Map<string, unknown>();
  let unread = false,
    conflict = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string) =>
      route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (op === "person_get_v1" && r.person_id === I.instructor) {
      if (options.unread && committed.size && !unread) {
        unread = true;
        return route.abort("failed");
      }
      return send(f.person);
    }
    if (op === "person_discipline_set_v1") {
      writes.push(r);
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        person_id: I.instructor,
        discipline_id: I.discipline,
        kind: "student",
      });
      if (options.denied) return reject("FORBIDDEN");
      if (committed.has(r.operation_key)) return send(committed.get(r.operation_key));
      let row = f.person.discipline_relationships.find(
        (row) =>
          row.center_id === I.center &&
          row.discipline_id === I.discipline &&
          row.kind === "student",
      );
      if (options.stale && !conflict) {
        conflict = true;
        row!.version++;
        return reject("VERSION_CONFLICT");
      }
      if (row) {
        expect(r.expected_version).toBe(row.version);
        row.state = r.state;
        row.version++;
      } else {
        expect(r).not.toHaveProperty("expected_version");
        f.person.discipline_relationships.push({
          center_id: I.center,
          discipline_id: I.discipline,
          kind: "student",
          state: r.state,
          version: 1,
        });
      }
      const result = { primary_id: "019ab7b0-0000-7000-8000-000000000951", changed: [], jobs: [] };
      committed.set(r.operation_key, result);
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send(result);
    }
    if (op === "operation_status_get_v1" && r.operation === "person_discipline_set_v1") {
      receipts.push(r);
      expect(committed.has(r.key)).toBe(true);
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: {
          type: "person_disciplines",
          id: "019ab7b0-0000-7000-8000-000000000951",
        },
      });
    }
    return route.fallback();
  });
  if (options.existing) await page.reload();
  await activate(page.getByRole("button", { name: text.title, exact: true }));
  const panel = page.getByRole("dialog", { name: text.title, exact: true });
  return { ...f, writes, receipts, committed, unrelated, panel };
}
async function review(
  page: import("@playwright/test").Page,
  panel: import("@playwright/test").Locator,
  inactive = false,
) {
  await panel.getByLabel(text.discipline, { exact: true }).selectOption(I.discipline);
  if (inactive)
    await activate(
      panel.getByRole("radio", { name: common.people.states.inactive, exact: true }),
      "Space",
    );
  await activate(panel.getByRole("button", { name: text.review, exact: true }));
  return page.getByRole("dialog", { name: text.review, exact: true });
}
async function apply(dialog: import("@playwright/test").Locator) {
  await activate(dialog.getByRole("checkbox"), "Space");
  await activate(dialog.getByRole("button", { name: text.apply, exact: true }));
}
test("student discipline requires an explicit choice/review and rereads a new native link without changing student or instructor roles", async ({
  page,
}) => {
  const f = await setup(page),
    field = f.panel.getByLabel(text.discipline, { exact: true });
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await activate(f.panel.getByRole("button", { name: text.review, exact: true }));
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toBeFocused();
  expect(f.writes).toHaveLength(0);
  const dialog = await review(page, f.panel);
  await expect(dialog.getByRole("button", { name: text.apply, exact: true })).toBeDisabled();
  await apply(dialog);
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.committed.size).toBe(1);
  expect(f.person.relationships.find((row) => row.kind === "student")!.state).toBe("active");
  expect(f.person.discipline_relationships.filter((row) => row.kind !== "student")).toEqual(
    f.unrelated,
  );
  await activate(dialog.getByRole("button", { name: common.settings.discard, exact: true }));
  await page.reload();
  await activate(page.getByRole("button", { name: text.title, exact: true }));
  const editor = page.getByRole("dialog", { name: text.title, exact: true });
  await editor.getByLabel(text.discipline, { exact: true }).selectOption(I.discipline);
  await activate(editor.getByRole("button", { name: text.review, exact: true }));
  await expect(editor.getByRole("alert")).toContainText(text.same);
  expect(f.writes).toHaveLength(1);
});
for (const recovery of ["retry", "receipt"] as const)
  test(`unknown student discipline ${recovery} keeps the same versioned intent and one native effect`, async ({
    page,
  }) => {
    const f = await setup(page, { existing: true, unknown: true }),
      dialog = await review(page, f.panel, true);
    await apply(dialog);
    await expect(dialog.getByRole("status")).toContainText(text.states.unknown);
    await checkLockedWorkspaceScope(page, async () => {
      await expect(page.locator("[data-workspace-logo]").locator("..")).toBeDisabled();
    });
    await attemptOutsideDismissal(dialog);
    await expect(dialog).toBeVisible();
    await activate(
      dialog.getByRole("button", {
        name: recovery === "retry" ? common.finance.retrySame : common.finance.readResult,
        exact: true,
      }),
    );
    await expect(dialog.getByRole("status")).toContainText(text.states.saved);
    expect(f.committed.size).toBe(1);
    expect(f.writes).toHaveLength(recovery === "retry" ? 2 : 1);
    if (recovery === "retry") {
      expect(f.writes[1]!.operation_key).toBe(f.writes[0]!.operation_key);
      expect(f.writes[1]!.expected_version).toBe(3);
    }
    expect(f.person.discipline_relationships.find((row) => row.kind === "student")!.state).toBe(
      "inactive",
    );
    expect(f.person.discipline_relationships.filter((row) => row.kind !== "student")).toEqual(
      f.unrelated,
    );
  });
test("student discipline ACK recovery only rereads the person, without dispatching another writer or receipt", async ({
  page,
}) => {
  const f = await setup(page, { unread: true }),
    dialog = await review(page, f.panel);
  await apply(dialog);
  await expect(dialog.getByRole("status")).toContainText(text.states["saved-unread"]);
  await expect(
    dialog.getByRole("button", { name: common.finance.retrySame, exact: true }),
  ).toHaveCount(0);
  await activate(dialog.getByRole("button", { name: common.finance.readResult, exact: true }));
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes).toHaveLength(1);
  expect(f.receipts).toHaveLength(0);
});
test("a changed student discipline version requires fresh review and explicit approval before writing the new version", async ({
  page,
}) => {
  const f = await setup(page, { existing: true, stale: true });
  let dialog = await review(page, f.panel, true);
  await apply(dialog);
  await expect(dialog.getByRole("status")).toContainText(text.states.stale);
  await expect(dialog.getByRole("button", { name: text.apply, exact: true })).toBeDisabled();
  await activate(dialog.getByRole("button", { name: common.settings.discard, exact: true }));
  dialog = await review(page, f.panel, true);
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await apply(dialog);
  await expect(dialog.getByRole("status")).toContainText(text.states.saved);
  expect(f.writes.map((row) => row.expected_version)).toEqual([3, 4]);
  expect(f.writes[0]!.operation_key).not.toBe(f.writes[1]!.operation_key);
});
test("native discipline write denial preserves all source relationships and never reports a saved link", async ({
  page,
}) => {
  const f = await setup(page, { denied: true }),
    before = structuredClone(f.person.discipline_relationships),
    dialog = await review(page, f.panel);
  await apply(dialog);
  await expect(dialog.getByRole("status")).toContainText(text.states.rejected);
  expect(f.committed.size).toBe(0);
  expect(f.person.discipline_relationships).toEqual(before);
});
