import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { AcceptanceContext, DocumentView } from "@ftksaas/api-contracts";
import { mockMemberAccount } from "./member-account-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function setup(
  page: Page,
  mode: "normal" | "unknown" | "context-unread" | "denied" | "empty" = "normal",
  operational = false,
) {
  await mockMemberAccount(page);
  const accepted = new Set<string>(),
    writes: Record<string, unknown>[] = [],
    reads: Record<string, unknown>[] = [];
  let failed = false;
  const first: AcceptanceContext = operational
      ? { gate: "attendance", subject: { type: "reservations", id: id(30) } }
      : { gate: "sale", subject: { type: "sales", id: id(30) } },
    second: AcceptanceContext = operational
      ? {
          gate: "event_registration",
          subject: { type: "events", id: id(31) },
          product_version_id: id(33),
          event_registration_preview_id: id(34),
        }
      : {
          gate: "sale",
          subject: { type: "product_versions", id: id(31) },
          product_version_id: id(31),
          purchase_preview_id: id(32),
        };
  const document = (context: AcceptanceContext, content = false): DocumentView => {
    const key = context.subject.id,
      renderId = context.purchase_preview_id ? id(24) : id(23),
      name = "İşleme özel koşullar",
      hash = content ? "rendered-hash" : "source-hash";
    const row: DocumentView = {
      id: id(20),
      version_id: id(21),
      file: { type: "files", id: id(22) },
      name,
      required_at: context.gate,
      accepted: accepted.has(key),
      content_kind: "digital",
      content_hash: hash,
    };
    if (content) {
      row.rendered_document = {
        id: renderId,
        language: "tr",
        source_version: id(21),
        content_hash: hash,
        source_content_hash: "source-hash",
        created_at: "2026-11-16T12:00:00Z",
        content: {
          name,
          language: "tr",
          template_id: "document.synthetic",
          template_version: "1",
          text: "Sentetik işlem metni <script>window.contextScript=true</script>",
        },
      };
      if (row.accepted)
        row.digital_acceptance = {
          id: context.purchase_preview_id ? id(27) : id(25),
          account_id: I.account,
          person_id: I.self,
          accepted_at: "2026-11-16T12:01:00Z",
          content_hash: hash,
          source_content_hash: "source-hash",
          displayed_content: row.rendered_document.content,
          rendered_document_id: renderId,
          evidence_kind: "server_document",
        };
    }
    return row;
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "member_document_contexts_get_v1") {
      reads.push(r);
      expect(r).not.toHaveProperty("person_id");
      expect(r).not.toHaveProperty("context");
      if (mode === "denied")
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      if (mode === "context-unread" && accepted.size && !failed) {
        failed = true;
        return route.abort("failed");
      }
      const context = r.page.cursor ? second : first;
      return send({
        items: mode === "empty" ? [] : [{ context, requirements: [document(context)] }],
        next_cursor: r.page.cursor || mode === "empty" ? null : "second-context",
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (op === "document_requirements_get_v1") {
      expect(r.person_id).toBe(I.self);
      expect(r.center_id).toBe(I.center);
      if (operational && r.context.gate === "event_registration") expect(r.context).toEqual(second);
      return send([document(r.context, !!r.content_file_id)]);
    }
    if (op === "document_accept_v1") {
      writes.push(r);
      accepted.add(r.context.subject.id);
      expect(r.rendered_document_id).toBe(r.context.purchase_preview_id ? id(24) : id(23));
      expect(r).not.toHaveProperty("displayed_content");
      if (mode === "unknown" && !failed) {
        failed = true;
        return route.abort("failed");
      }
      return send({
        primary_id: r.context.purchase_preview_id ? id(27) : id(25),
        operation_id: id(26),
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "document_accept_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_reference: { type: "document_acceptances", id: id(25) },
      });
    return route.fallback();
  });
  await page.reload();
  const card = page
    .locator('main [data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Belgeler", exact: true }) });
  return { card, writes, reads, first, second };
}
async function accept(page: Page) {
  const read = page.getByRole("button", {
    name: "İşleme özel koşullar belgesini oku",
    exact: true,
  });
  await read.click();
  await expect(
    page.getByText("Sentetik işlem metni <script>window.contextScript=true</script>", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Belgeyi okudum, bu işlem için kabul ediyorum.", exact: true })
    .press("Space");
  await page.getByRole("button", { name: "Belgeyi kabul et", exact: true }).click();
}
for (const operational of [false, true])
  test(`account document discovery preserves ${operational ? "attendance and event" : "purchase"} contexts and never copies another transaction acceptance`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 950 });
    const state = await setup(page, "normal", operational);
    await accept(page);
    await expect(
      page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    expect(state.writes[0]!.context).toEqual(state.first);
    expect(await page.evaluate(() => Object.hasOwn(globalThis, "contextScript"))).toBe(false);
    await page.getByRole("button", { name: "Belgeyi kapat", exact: true }).click();
    await expect(state.card.getByText("Kabul edildi", { exact: true })).toBeVisible();
    await state.card.getByRole("button", { name: "Sonraki", exact: true }).click();
    await expect(
      state.card.getByRole("button", { name: "İşleme özel koşullar belgesini oku", exact: true }),
    ).toBeVisible();
    expect(state.reads.at(-1)).toMatchObject({ page: { cursor: "second-context" } });
    const readsBeforeAcceptance = state.reads.length;
    await accept(page);
    await expect(
      page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1]!.context).toEqual(state.second);
    expect(state.reads.slice(readsBeforeAcceptance)).toHaveLength(1);
    expect(state.reads.at(-1)?.page).not.toHaveProperty("cursor");
  });
for (const mode of ["unknown", "context-unread"] as const)
  test(`account document ${mode} keeps the editor and shared fields locked until exact result reread`, async ({
    page,
  }) => {
    const state = await setup(page, mode);
    await accept(page);
    await expect(
      page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Belgeyi kapat", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "Hesap güvenliğini yönet", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
    await expect(
      page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });
test("account denied document discovery is unread rather than empty", async ({ page }) => {
  const state = await setup(page, "denied");
  await expect(
    state.card.getByText("Bu hesap için aktif işlem belgeleri okunamadı. Yeniden yükle.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    state.card.getByText("Bu bağlamda kabul bekleyen belge yok.", { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("account empty native context directory has no content or acceptance side effects", async ({
  page,
}) => {
  const state = await setup(page, "empty");
  await expect(
    state.card.getByText("Bu bağlamda kabul bekleyen belge yok.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
