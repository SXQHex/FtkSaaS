import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const fileId = "019ab7b0-0000-7000-8000-000000000090",
  documentId = "019ab7b0-0000-7000-8000-000000000091",
  previewId = "019ab7b0-0000-7000-8000-000000000092";
async function setup(
  page: Page,
  mode: "normal" | "unknown" | "unread" | "prepare-unknown" | "transfer-unknown" = "normal",
) {
  await mockStudio(page);
  const state = {
    writes: [] as { op: string; r: Record<string, unknown> }[],
    checksum: "",
    published: false,
    failed: false,
    puts: 0,
  };
  const preview = {
    id: previewId,
    token: "synthetic",
    scope_hash: "synthetic-scope",
    expires_at: "2099-01-01T00:00:00Z",
    dependencies: { versions: [] },
    blockers: [],
    effects: [],
  };
  await page.route("**/storage/v1/object/upload/sign/**", async (route) => {
    state.puts++;
    if (mode === "transfer-unknown" && !state.failed) {
      state.failed = true;
      return route.abort("failed");
    }
    await route.fulfill({ status: 200, json: { Key: "synthetic" } });
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: fileId } });
    if (op === "document_upload_prepare_v1") {
      state.writes.push({ op, r });
      if (mode === "prepare-unknown" && !state.failed) {
        state.failed = true;
        return route.abort("failed");
      }
      return send({
        file_id: fileId,
        upload_url: `/storage/v1/object/upload/sign/ftksaas-documents/${I.org}/${fileId}?token=synthetic`,
        expires_at: "2099-01-01T00:00:00Z",
        allowed_mime: ["text/plain"],
        max_bytes: 2097152,
      });
    }
    if (op === "file_upload_complete_v1") {
      state.writes.push({ op, r });
      state.checksum = r.checksum;
      return send({ primary_id: fileId, operation_id: previewId });
    }
    if (op === "document_publication_preview_v1")
      return send({
        preview,
        affected: [
          {
            subject: { type: "reservations", id: documentId },
            version: 1,
            person_id: I.self,
            center_id: I.center,
          },
        ],
        preserves_reservations: true,
      });
    if (op === "preview_get_v1") return send(preview);
    if (op === "document_version_publish_v1") {
      state.writes.push({ op, r });
      state.published = true;
      if (mode === "unknown" && !state.failed) {
        state.failed = true;
        return route.abort("failed");
      }
      return send({
        primary_id: fileId,
        operation_id: previewId,
        related: [{ type: "documents", id: documentId }],
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "document_version_publish_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_reference: { type: "document_versions", id: fileId },
      });
    if (
      op === "management_state_get_v1" &&
      ["file_upload_complete_v1", "document_version_publish_v1"].includes(r.operation)
    ) {
      const publication = r.operation === "document_version_publish_v1";
      if (publication && mode === "unread" && !state.failed) {
        state.failed = true;
        return route.abort("failed");
      }
      return send({
        items: [
          {
            operation: r.operation,
            entity: { type: publication ? "document_versions" : "files", id: fileId },
            exists: true,
            state: publication ? "published" : "ready",
            versions: [],
            as_of: "2026-11-17T00:00:00Z",
            current: {
              operation: r.operation,
              values: publication
                ? {
                    document_id: documentId,
                    file_id: fileId,
                    version_label: "v1",
                    requirements: [
                      { gate: "sale", scope: { center_ids: [I.center] }, renewed_acceptance: true },
                    ],
                    scope: { kind: "center", center_id: I.center },
                  }
                : { file_id: fileId, checksum: state.checksum },
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-17T00:00:00Z",
      });
    }
    return route.fallback();
  });
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/documents`);
  await page.getByRole("button", { name: "Belge yükle", exact: true }).click();
  return state;
}
async function fill(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Belge adı", { exact: true }).fill("Sentetik belge");
  await dialog.getByLabel("Sürüm etiketi", { exact: true }).fill("v1");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Sentetik belge"),
  });
  await dialog.getByRole("checkbox", { name: "Satış", exact: true }).press("Space");
  await dialog.getByRole("button", { name: "Etkiyi göster", exact: true }).click();
  return dialog;
}
test("documents validates before upload and focuses the first invalid field", async ({ page }) => {
  const state = await setup(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Etkiyi göster", exact: true }).click();
  await expect(dialog.getByLabel("Belge adı", { exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["normal", "unknown", "unread"] as const)
  test(`document publication ${mode} preserves reviewed scope and never repeats an acknowledged writer`, async ({
    page,
  }) => {
    const state = await setup(page, mode);
    const dialog = await fill(page);
    await expect(
      dialog.getByText("Mevcut kaydı korunacak işlem: 1", { exact: true }),
    ).toBeVisible();
    const publish = dialog.getByRole("button", { name: "Yayınla", exact: true });
    await expect(publish).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
    await publish.click();
    if (mode !== "normal") {
      await expect(
        dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
    }
    await expect(
      page.getByText("v1 sürümü yayımlandı ve sunucudan yeniden doğrulandı.", { exact: true }),
    ).toBeVisible();
    expect(state.puts).toBe(1);
    expect(state.writes.filter((w) => w.op === "document_version_publish_v1")).toHaveLength(1);
    expect(state.writes.at(-1)?.r.impact_approval).toMatchObject({
      preview: { id: previewId, token: "synthetic" },
      accepted_subjects: [{ type: "reservations", id: documentId }],
    });
  });

for (const mode of ["prepare-unknown", "transfer-unknown"] as const)
  test(`document upload ${mode} recovers frozen bytes without a new metadata intent`, async ({
    page,
  }) => {
    const state = await setup(page, mode),
      dialog = await fill(page);
    await expect(
      dialog.getByText(
        "Yükleme sonucu belirsiz. Aynı isteği yeniden dene veya sunucudaki dosyayı doğrula.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Belge adı", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    if (mode === "prepare-unknown")
      await dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
    else
      await dialog.getByRole("button", { name: "Yüklenen dosyayı doğrula", exact: true }).click();
    await expect(
      dialog.getByText("Mevcut kaydı korunacak işlem: 1", { exact: true }),
    ).toBeVisible();
    const prepares = state.writes.filter((w) => w.op === "document_upload_prepare_v1");
    expect(new Set(prepares.map((w) => w.r.operation_key)).size).toBe(1);
    expect(state.puts).toBe(1);
    expect(state.writes.filter((w) => w.op === "file_upload_complete_v1")).toHaveLength(1);
  });
