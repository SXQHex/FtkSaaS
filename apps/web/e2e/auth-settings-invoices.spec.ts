import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { at, uid } from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

test("owner updates and clears the tax profile and downloads unchanged original invoices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockSettingsCompletion(page, { billingOwner: true });
  const pdf = Buffer.from("%PDF-1.4\nSynthetic invoice fixture\n%%EOF");
  const zip = Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)]);
  const invoices = [
    {
      id: uid(198),
      invoice_number: "FTK-2026-001",
      issued_on: "2026-11-10",
      published_at: at,
      mime: "application/pdf",
      bytes: pdf.length,
    },
    {
      id: uid(199),
      invoice_number: "FTK-2026-002",
      issued_on: "2026-11-12",
      published_at: at,
      mime: "application/zip",
      bytes: zip.length,
    },
  ];
  const writes: Record<string, unknown>[] = [];
  let profile = {
    org_id: I.org,
    version: 0,
    tax_office: null as string | null,
    tax_identifier: null as string | null,
  };
  let rejectDownload = false;
  await page.route("**/functions/v1/backend-v1/**", async (route) => {
    const url = new URL(route.request().url());
    const op = url.pathname.split("/").at(-1);
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (
      op === "operation_status_get_v1" &&
      request.operation === "organization_billing_tax_set_v1"
    ) {
      expect(request.key).toBe(writes[0]?.operation_key);
      return send({
        operation: request.operation,
        key: request.key,
        status: "succeeded",
        result_reference: { type: "organizations", id: I.org },
      });
    }
    if (!op?.startsWith("organization_billing_tax_") && !op?.startsWith("organization_invoice"))
      return route.fallback();
    expect(request.org_id).toBe(I.org);
    expect(request).not.toHaveProperty("center_id");
    if (op === "organization_billing_tax_get_v1") return send(profile);
    if (op === "organization_billing_tax_set_v1") {
      writes.push(request);
      expect(request.expected_version).toBe(profile.version);
      profile = {
        ...profile,
        version: profile.version + 1,
        tax_office: request.tax_office,
        tax_identifier: request.tax_identifier,
      };
      if (writes.length === 1) return route.abort();
      return send({ primary_id: I.org, version: profile.version });
    }
    if (op === "organization_invoices_list_v1") {
      expect(request.page.limit).toBe(50);
      return send({
        items: [invoices[request.page.cursor ? 1 : 0]],
        next_cursor: request.page.cursor ? null : "next-invoice",
        as_of: at,
      });
    }
    expect(url.search).toBe("?download=original");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().headers().cookie).toBeUndefined();
    if (rejectDownload)
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    const pdfSelected = request.invoice_id === invoices[0]!.id;
    expect(request.invoice_id).toBe(invoices[pdfSelected ? 0 : 1]!.id);
    return route.fulfill({
      contentType: pdfSelected ? "application/pdf" : "application/zip",
      body: pdfSelected ? pdf : zip,
    });
  });
  await activate(page.getByRole("tab", { name: "Plan", exact: true }));
  await page.getByRole("combobox", { name: "Ayar kapsamı" }).selectOption("organization");
  const office = page.getByRole("textbox", { name: "Vergi dairesi" });
  const identifier = page.getByRole("textbox", { name: "Vergi kimliği" });
  await expect(office).toHaveValue("");
  await office.fill("Deneme Vergi Dairesi");
  await identifier.fill("SENTETIK-1");
  const reviewButton = page.getByRole("button", { name: "Vergi değişikliğini incele" });
  const dialog = page.getByRole("dialog", { name: "Vergi değişikliğini incele" });
  const apply = dialog.getByRole("button", { name: "Onaylanan değişiklikleri uygula" });
  async function applyTax() {
    await activate(reviewButton);
    await expect(apply).toBeDisabled();
    await activate(dialog.getByRole("checkbox"), "Space");
    await activate(apply);
  }
  await applyTax();
  await activate(dialog.getByRole("button", { name: common.finance.readResult, exact: true }));
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    expected_version: 0,
    tax_office: "Deneme Vergi Dairesi",
    tax_identifier: "SENTETIK-1",
  });
  await activate(dialog.getByRole("button", { name: "Vazgeç" }));
  await expect(office).toHaveValue("Deneme Vergi Dairesi");
  await expect(identifier).toHaveValue("SENTETIK-1");
  await office.fill("");
  await identifier.fill("");
  await applyTax();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  expect(writes[1]).toMatchObject({ expected_version: 1, tax_office: null, tax_identifier: null });
  await activate(dialog.getByRole("button", { name: "Vazgeç" }));
  await activate(page.getByRole("button", { name: "Daha fazla fatura" }));
  for (const [index, bytes] of [pdf, zip].entries()) {
    const row = invoices[index]!;
    const ready = page.waitForEvent("download");
    await activate(
      page.getByRole("button", { name: `İndir — ${row.invoice_number}`, exact: true }),
    );
    const download = await ready;
    expect(download.suggestedFilename()).toBe(`invoice-${row.id}.${index === 0 ? "pdf" : "zip"}`);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks)).toEqual(bytes);
  }
  rejectDownload = true;
  await activate(page.getByRole("button", { name: "İndir — FTK-2026-001", exact: true }));
  await expect(page.getByText("Fatura geçmişi okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("FTK-2026-001", { exact: true })).toHaveCount(0);
});

test("organization manager settings do not expose owner invoice data or call owner endpoints", async ({
  page,
}) => {
  await mockSettingsCompletion(page);
  const ownerCalls: string[] = [];
  await page.route("**/functions/v1/backend-v1/**", (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    if (op.startsWith("organization_billing_tax_") || op.startsWith("organization_invoice"))
      ownerCalls.push(op);
    return route.fallback();
  });
  await activate(page.getByRole("tab", { name: "Plan", exact: true }));
  await page.getByRole("combobox", { name: "Ayar kapsamı" }).selectOption("organization");
  await expect(page.getByRole("textbox", { name: "Fatura unvanı" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vergi profili", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kesilmiş faturalar", exact: true })).toHaveCount(
    0,
  );
  expect(ownerCalls).toEqual([]);
});
