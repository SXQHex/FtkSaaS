import { test, expect } from "./test.js";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import type {
  DigitalAgreementView,
  RequestInstructorAgreementAccept,
} from "../src/lib/api-contracts/generated.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const text = common.agreementDocument;
async function setup(
  page: import("@playwright/test").Page,
  options: { missing?: boolean; unknown?: boolean; unread?: boolean; denied?: boolean } = {},
) {
  const native = await mockSessionDetail(page, { existing: true, instructor: true });
  const view: DigitalAgreementView = {
    agreement: {
      id: id(880),
      person_id: id(999),
      center_id: I.center,
      discipline_id: I.discipline,
      version: 2,
      format: "group",
      valid: { starts_at: "2026-01-01T00:00:00Z", ends_at: null },
      supersedes_id: id(879),
      published_at: "2026-01-01T00:00:00Z",
      terms: {
        model: "session_fixed",
        currency: "TRY",
        components: [{ kind: "session_fixed", amount_minor: "25000" }],
        room_fee: { kind: "free", order: "before_instructor_share" },
      },
    },
    source_content_hash: "synthetic-facts-hash",
    acceptance: null,
    document_error: null,
    rendered_document: {
      id: id(881),
      source_version: id(880),
      source_content_hash: "synthetic-facts-hash",
      content_hash: "synthetic-document-hash",
      language: "tr",
      created_at: "2026-11-18T00:00:00Z",
      content: {
        name: "Kontrollü anlaşma metni",
        language: "tr",
        template_id: "instructor",
        template_version: "1",
        text: 'Sentetik anlaşma koşulları.\n<img src=x onerror="window.__agreementInjected=true">',
      },
    },
  };
  if (options.missing) {
    view.rendered_document = null;
    view.document_error = "POLICY_NOT_CONFIGURED";
  }
  const writes: RequestInstructorAgreementAccept[] = [],
    receiptKeys: string[] = [],
    effects = new Set<string>();
  let unread = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string) =>
      route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (op === "instructor_account_get_v1") {
      expect(r.person_id).toBe(I.instructor);
      expect(r.center_id).toBe(I.center);
      return send({
        view: r.view,
        items: r.view === "agreements" ? [view.agreement] : [],
        totals: [],
        next_cursor: null,
        as_of: "2026-11-18T00:00:00Z",
      });
    }
    if (op === "instructor_agreement_get_v1") {
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        agreement_id: view.agreement.id,
      });
      if (effects.size && options.unread && !unread) {
        unread = true;
        return route.abort("failed");
      }
      return send(view);
    }
    if (op === "instructor_agreement_accept_v1") {
      writes.push(r);
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        agreement_id: view.agreement.id,
        expected_version: 2,
        rendered_document_id: view.rendered_document!.id,
        source_content_hash: view.source_content_hash,
      });
      expect(r).not.toHaveProperty("displayed_content");
      expect(r).not.toHaveProperty("displayed_content_hash");
      if (options.denied) return reject("FORBIDDEN");
      effects.add(r.operation_key);
      view.acceptance = {
        id: id(882),
        account_id: I.account,
        person_id: I.instructor,
        agreement_id: view.agreement.id,
        rendered_document_id: view.rendered_document!.id,
        content_hash: view.rendered_document!.content_hash,
        source_content_hash: view.source_content_hash,
        evidence_kind: "server_document",
        displayed_content: structuredClone(view.rendered_document!.content),
        accepted_at: "2026-11-18T00:01:00Z",
      };
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({
        primary_id: view.agreement.id,
        version: 2,
        related: [{ type: "instructor_agreements", id: view.agreement.id }],
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "instructor_agreement_accept_v1") {
      receiptKeys.push(r.key);
      expect(effects.has(r.key)).toBe(true);
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "instructor_agreements", id: view.agreement.id },
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
  await page.getByRole("button", { name: text.open, exact: true }).click();
  const panel = page.getByRole("dialog", { name: text.title, exact: true });
  if (!options.missing)
    await expect(
      panel.getByRole("article", { name: view.rendered_document!.content.name }),
    ).toBeVisible();
  return { native, view, panel, writes, receiptKeys, effects };
}
async function accept(panel: import("@playwright/test").Locator) {
  await panel.getByRole("checkbox", { name: text.review, exact: true }).press("Space");
  await panel.getByRole("button", { name: text.accept, exact: true }).click();
}
test("own canonical account reads the immutable alias document as text and accepts only after explicit consent", async ({
  page,
}) => {
  const f = await setup(page);
  const article = f.panel.getByRole("article", { name: f.view.rendered_document!.content.name });
  await expect(article).toHaveAttribute("lang", "tr");
  await expect(article).toContainText('<img src=x onerror="window.__agreementInjected=true">');
  await expect(article.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(globalThis, "__agreementInjected"))).toBeUndefined();
  await f.panel.getByRole("button", { name: text.accept, exact: true }).click();
  await expect(f.panel.getByRole("alert")).toHaveText(text.reviewRequired);
  await expect(f.panel.getByRole("checkbox", { name: text.review, exact: true })).toBeFocused();
  expect(f.writes).toHaveLength(0);
  await accept(f.panel);
  await expect(f.panel.getByText(text.accepted, { exact: true })).toBeVisible();
  expect(f.effects.size).toBe(1);
  expect(f.writes).toHaveLength(1);
  expect(f.view.agreement.person_id).toBe(id(999));
  expect(f.view.acceptance!.person_id).toBe(I.instructor);
  expect(f.native.writes).toHaveLength(0);
  await f.panel.getByRole("button", { name: common.memberDocuments.close, exact: true }).click();
  await page.getByRole("button", { name: text.open, exact: true }).click();
  await expect(page.getByRole("dialog").getByText(text.accepted, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: text.accept, exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
test("missing approved organization source leaves financial terms readable and exposes no document acceptance", async ({
  page,
}) => {
  const f = await setup(page, { missing: true });
  await expect(f.panel.getByRole("alert")).toHaveText(text.noSource);
  await expect(f.panel.getByRole("checkbox")).toHaveCount(0);
  await expect(f.panel.getByRole("button", { name: text.accept, exact: true })).toHaveCount(0);
  await f.panel.getByRole("button", { name: common.memberDocuments.close, exact: true }).click();
  await page.getByText(common.instructorEarnings.agreementTerms, { exact: true }).click();
  await expect(page.getByLabel("Para birimi (ISO 4217)", { exact: true })).toHaveValue("TRY");
  await expect(page.getByLabel("Para birimi (ISO 4217)", { exact: true })).toBeDisabled();
  expect(f.writes).toHaveLength(0);
});
for (const recovery of ["retry", "receipt"] as const)
  test(`unknown agreement consent ${recovery} retains its document, scope and operation key`, async ({
    page,
  }) => {
    const f = await setup(page, { unknown: true });
    await accept(f.panel);
    await expect(
      f.panel.getByRole("button", { name: common.finance.readResult, exact: true }),
    ).toBeVisible();
    await expect(
      f.panel.getByRole("button", { name: common.memberDocuments.close, exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(f.panel).toBeVisible();
    await f.panel
      .getByRole("button", {
        name: recovery === "retry" ? common.studio.retrySameRequest : common.finance.readResult,
        exact: true,
      })
      .click();
    await expect(f.panel.getByText(text.accepted, { exact: true })).toBeVisible();
    expect(f.effects.size).toBe(1);
    if (recovery === "retry") {
      expect(f.writes).toHaveLength(2);
      expect(f.writes[1]!.operation_key).toBe(f.writes[0]!.operation_key);
    } else {
      expect(f.writes).toHaveLength(1);
      expect(f.receiptKeys).toEqual([f.writes[0]!.operation_key]);
    }
  });
test("acknowledged agreement consent rereads native evidence without another write or receipt", async ({
  page,
}) => {
  const f = await setup(page, { unread: true });
  await accept(f.panel);
  await expect(
    f.panel.getByText(common.events.commandStates["saved-unread"], { exact: true }),
  ).toBeVisible();
  await f.panel.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(f.panel.getByText(text.accepted, { exact: true })).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.receiptKeys).toHaveLength(0);
});
test("changed server document requires reloading and fresh consent before any writer", async ({
  page,
}) => {
  const f = await setup(page);
  f.view.rendered_document!.id = id(883);
  f.view.rendered_document!.content_hash = "new-synthetic-hash";
  f.view.rendered_document!.content.text = "Yeni kontrollü anlaşma metni.";
  await accept(f.panel);
  await expect(f.panel.getByRole("alert")).toHaveText(text.changed);
  await expect(f.panel.getByRole("checkbox", { name: text.review, exact: true })).not.toBeChecked();
  expect(f.writes).toHaveLength(0);
  await f.panel.getByRole("button", { name: common.memberDocuments.retry, exact: true }).click();
  await expect(f.panel.getByRole("article")).toContainText("Yeni kontrollü anlaşma metni.");
  await accept(f.panel);
  await expect(f.panel.getByText(text.accepted, { exact: true })).toBeVisible();
  expect(f.writes[0]!.rendered_document_id).toBe(id(883));
});
test("native permission loss removes private agreement and financial contents without reporting acceptance", async ({
  page,
}) => {
  const f = await setup(page, { denied: true });
  await accept(f.panel);
  await expect(page.getByText(common.instructorToday.unavailable, { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: text.open, exact: true })).toHaveCount(0);
  expect(f.effects.size).toBe(0);
  expect(f.view.acceptance).toBeNull();
});
