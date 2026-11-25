import { activate, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
import type { ContentTemplateView, DigitalDocumentContent } from "@ftksaas/api-contracts";
const fileId = "019ab7b0-0000-7000-8000-000000000090",
  documentId = "019ab7b0-0000-7000-8000-000000000091",
  previewId = "019ab7b0-0000-7000-8000-000000000092";
async function setup(
  page: Page,
  mode:
    | "normal"
    | "unknown"
    | "unread"
    | "prepare-unknown"
    | "transfer-unknown"
    | "digital"
    | "catalog" = "normal",
) {
  await mockStudio(page);
  const state = {
    writes: [] as { op: string; r: Record<string, unknown> }[],
    checksum: "",
    published: mode === "catalog",
    completed: false,
    failed: false,
    puts: 0,
    digital: undefined as DigitalDocumentContent | undefined,
    digitalPreview: undefined as DigitalDocumentContent | undefined,
  };
  const catalog: ContentTemplateView[] = [
    {
      id: fileId,
      org_id: I.org,
      center_id: I.center,
      scope_key: `center:${I.org}:${I.center}`,
      code: `document.${documentId}`,
      channel: "document",
      language: "tr",
      version: 1,
      revision: 1,
      source_version: fileId,
      state: "published",
      retired: false,
      invalidated: false,
      created_at: "2026-11-17T00:00:00Z",
      published_at: "2026-11-17T00:00:00Z",
      content: {
        language: "tr",
        name: "Sentetik belge",
        text: "Sentetik kaynak metni",
        template_id: "document.text",
        template_version: "1",
      },
    },
  ];
  const translationId = "019ab7b0-0000-7000-8000-000000000093";
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
    if (op === "document_directory_get_v1") {
      const latest = {
        version_id: fileId,
        version: 1,
        version_label: "v1",
        published_at: "2026-11-17T00:00:00Z",
        effective_at: "2026-11-17T00:00:00Z",
        requirements: [
          { gate: "sale", scope: { center_ids: [I.center] }, renewed_acceptance: true },
        ],
      };
      const items: unknown[] = [];
      if (r.view === "documents" && state.published) {
        items.push({
          key: documentId,
          kind: "document",
          document_id: documentId,
          file_id: fileId,
          name: "Sentetik belge",
          created_at: "2026-11-17T00:00:00Z",
          expires_at: null,
          state: "published",
          scope: "center",
          read_only: false,
          latest_version: latest,
          version_count: 1,
          required_members: 1,
          pending_members: 1,
          acceptance_records: 0,
        });
      } else if (r.view === "documents" && state.completed) {
        items.push({
          key: fileId,
          kind: "unpublished_file",
          document_id: null,
          file_id: fileId,
          name: "Sentetik belge",
          created_at: "2026-11-17T00:00:00Z",
          expires_at: null,
          state: "ready_unpublished",
          scope: "center",
          read_only: false,
          latest_version: null,
          version_count: null,
          required_members: 0,
          pending_members: 0,
          acceptance_records: null,
        });
      } else if (r.view === "versions" && state.published) {
        items.push(latest);
      }
      return send({
        view: r.view,
        items,
        as_of: "2026-11-17T00:00:00Z",
        next_cursor: null,
        history_available: true,
        summary: {
          published_documents: state.published ? 1 : 0,
          unpublished_files: state.completed && !state.published ? 1 : 0,
          pending_members: state.published ? 1 : 0,
          total_members: state.published ? 1 : 0,
          last_publication: state.published ? "2026-11-17T00:00:00Z" : null,
          acceptance_records: 0,
        },
      });
    }
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
      state.completed = true;
      return send({ primary_id: fileId, operation_id: previewId });
    }
    if (op === "document_publication_preview_v1") {
      if (mode === "digital") {
        expect(r).not.toHaveProperty("file_id");
        state.digitalPreview = r.digital_content;
      }
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
    }
    if (op === "preview_get_v1") return send(preview);
    if (op === "document_version_publish_v1") {
      state.writes.push({ op, r });
      state.published = true;
      if (mode === "digital") {
        expect(r).not.toHaveProperty("file_id");
        expect(r.digital_content).toEqual(state.digitalPreview);
        state.digital = r.digital_content;
      }
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
    if (mode === "catalog" && op === "content_catalog_get_v1") {
      expect(r).toMatchObject({
        center_id: I.center,
        scope_key: `center:${I.org}:${I.center}`,
        code: `document.${documentId}`,
        channel: "document",
      });
      return send({ items: catalog, as_of: "2026-11-17T00:00:00Z" });
    }
    if (mode === "catalog" && op === "content_catalog_save_v1") {
      state.writes.push({ op, r });
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        code: `document.${documentId}`,
        source_version: fileId,
        language: "en",
        version: 1,
      });
      const translation = catalog.find((row) => row.id === translationId);
      if (r.action === "draft") {
        expect(r.expected_revision).toBeUndefined();
        catalog.push({
          ...catalog[0]!,
          id: translationId,
          language: "en",
          content: r.content,
          published_at: null,
          state: "draft",
        });
      } else {
        expect(r.expected_revision).toBe(translation?.revision);
        if (!translation) throw Error("Expected catalogue translation");
        if (r.action === "publish") {
          translation.state = "published";
          translation.revision++;
        }
        if (r.action === "retire") translation.retired = true;
        if (r.action === "invalidate") translation.invalidated = true;
      }
      return send({ primary_id: translationId, operation_id: previewId });
    }
    if (op === "content_catalog_get_v1" && state.digital) {
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        scope_key: `center:${I.org}:${I.center}`,
        code: `document.${documentId}`,
        channel: "document",
      });
      const content = state.failed ? state.digital : { ...state.digital, text: "Uyuşmayan metin" };
      state.failed = true;
      return send({
        items: [
          {
            id: fileId,
            org_id: I.org,
            center_id: I.center,
            scope_key: r.scope_key,
            code: r.code,
            channel: r.channel,
            state: "published",
            source_version: fileId,
            language: content.language,
            content,
            version: 1,
            revision: 1,
            retired: false,
            invalidated: false,
          },
        ],
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
  if (mode !== "catalog")
    await activate(page.getByRole("button", { name: "Belge yükle", exact: true }));
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
  await activate(dialog.getByRole("checkbox", { name: "Satış", exact: true }), "Space");
  await activate(dialog.getByRole("button", { name: "Etkiyi göster", exact: true }));
  return dialog;
}
test("documents validates before upload and focuses the first invalid field", async ({ page }) => {
  const state = await setup(page);
  const dialog = page.getByRole("dialog");
  await activate(dialog.getByRole("button", { name: "Etkiyi göster", exact: true }));
  await expect(dialog.getByLabel("Belge adı", { exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("M02 refreshes the directory after verified upload completion", async ({ page }) => {
  const state = await setup(page);
  const dialog = await fill(page);
  await expect(dialog.getByText("Mevcut kaydı korunacak işlem: 1", { exact: true })).toBeVisible();
  expect(state.writes.filter((row) => row.op === "file_upload_complete_v1")).toHaveLength(1);
  expect(state.writes.filter((row) => row.op === "document_version_publish_v1")).toHaveLength(0);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Sentetik belge" })).toBeVisible();
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
    await activate(dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
    await activate(publish);
    if (mode !== "normal") {
      await expect(
        dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
      ).toBeVisible();
      await attemptOutsideDismissal(dialog);
      await expect(dialog).toBeVisible();
      await activate(
        dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
      );
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
    await attemptOutsideDismissal(dialog);
    await expect(dialog).toBeVisible();
    if (mode === "prepare-unknown")
      await activate(dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }));
    else
      await activate(dialog.getByRole("button", { name: "Yüklenen dosyayı doğrula", exact: true }));
    await expect(
      dialog.getByText("Mevcut kaydı korunacak işlem: 1", { exact: true }),
    ).toBeVisible();
    const prepares = state.writes.filter((w) => w.op === "document_upload_prepare_v1");
    expect(new Set(prepares.map((w) => w.r.operation_key)).size).toBe(1);
    expect(state.puts).toBe(1);
    expect(state.writes.filter((w) => w.op === "file_upload_complete_v1")).toHaveLength(1);
  });

test("digital publication confirms exact server content without any Storage upload", async ({
  page,
}) => {
  const state = await setup(page, "digital");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Belge adı", { exact: true }).fill("Sentetik belge");
  await dialog.getByLabel("Sürüm etiketi", { exact: true }).fill("v1");
  await dialog.getByLabel("Belge biçimi", { exact: true }).selectOption("digital");
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await activate(dialog.getByRole("checkbox", { name: "Satış", exact: true }), "Space");
  const field = dialog.getByLabel("Dijital metin", { exact: true });
  const preview = dialog.getByRole("button", { name: "Etkiyi göster", exact: true });
  await activate(preview);
  await expect(field).toBeFocused();
  const source = "İlk satır.  \nİkinci satır.";
  await field.fill(source);
  await activate(preview);
  await expect(dialog.getByText("Mevcut kaydı korunacak işlem: 1", { exact: true })).toBeVisible();
  await activate(dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
  await activate(dialog.getByRole("button", { name: "Yayınla", exact: true }));
  await expect(
    page.getByText("v1 sürümü yayımlandı ve sunucudan yeniden doğrulandı.", { exact: true }),
  ).toHaveCount(0);
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(
    page.getByText("v1 sürümü yayımlandı ve sunucudan yeniden doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.digitalPreview?.text).toBe(source);
  expect(state.digital?.text).toBe(source);
  expect(state.puts).toBe(0);
  expect(state.writes.map(({ op }) => op)).toEqual(["document_version_publish_v1"]);
});

test("content catalogue manages an exact source translation and acknowledges invalidation", async ({
  page,
}) => {
  const state = await setup(page, "catalog");
  await activate(page.getByRole("tab", { name: "İçerik kataloğu" }));
  await page.getByLabel("Belge", { exact: true }).selectOption({ label: "Sentetik belge" });
  const grid = page.getByRole("grid", { name: "İçerik kataloğu" });
  await expect(grid.getByRole("rowheader").last()).toHaveText(`document.${documentId}`);
  await activate(page.getByRole("button", { name: "Çeviri ekle" }));
  const form = page.getByRole("form", { name: "Belge çevirisi" });
  const field = form.getByLabel("Dijital metin");
  await activate(form.getByRole("button", { name: "Taslağı kaydet" }));
  await expect(field).toBeFocused();
  await field.fill("Synthetic translation.");
  const confirm = async (name: string) => {
    const dialog = page.getByRole("dialog", { name, exact: true });
    const apply = dialog.getByRole("button", { name: common.settings.applyReview });
    await expect(apply).toBeDisabled();
    await activate(dialog.getByRole("checkbox"), "Space");
    await activate(apply);
    await expect(
      dialog.getByText(common.events.commandStates.saved, { exact: true }),
    ).toBeVisible();
    await activate(dialog.getByRole("button", { name: "Vazgeç" }));
  };
  await activate(form.getByRole("button", { name: "Taslağı kaydet" }));
  await confirm("Taslağı kaydet");
  const row = grid
    .getByRole("row")
    .filter({ has: page.getByRole("gridcell", { name: "en", exact: true }) });
  await expect(row.getByRole("gridcell", { name: "Taslak", exact: true })).toBeVisible();
  await activate(row.getByRole("button", { name: "Taslağı düzenle" }));
  await expect(field).toHaveValue("Synthetic translation.");
  await activate(form.getByRole("button", { name: "Çeviriyi yayımla" }));
  await confirm("Çeviriyi yayımla");
  await expect(row.getByRole("gridcell", { name: "Yayın sürümü" })).toBeVisible();
  await activate(row.getByRole("button", { name: "Yayından kaldır" }));
  await confirm("Yayından kaldır");
  await expect(row.getByRole("gridcell", { name: "Kaldırıldı" })).toBeVisible();
  await activate(row.getByRole("button", { name: "Geçersiz kıl" }));
  await confirm("Geçersiz kıl");
  await expect(page.getByText("Sunucu, sürümü geçersiz kıldığını doğruladı.")).toBeVisible();
  await expect(row.getByRole("gridcell", { name: "Geçersiz kılındı" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Geçersiz kıl" })).toHaveCount(0);
  await page.reload();
  await activate(page.getByRole("tab", { name: "İçerik kataloğu" }));
  await page.getByLabel("Belge", { exact: true }).selectOption({ label: "Sentetik belge" });
  await expect(row.getByRole("gridcell", { name: "Geçersiz kılındı" })).toBeVisible();
  expect(state.writes.map(({ r }) => r.action)).toEqual([
    "draft",
    "publish",
    "retire",
    "invalidate",
  ]);
});
