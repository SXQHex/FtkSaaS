import { test, expect } from "./test.js";
import {
  mockCompletion,
  completionUrl,
  nativePage,
  nativeMutation,
  metadata,
  uid,
  at,
} from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const version = {
  version_id: uid(5),
  version: 2,
  version_label: "Sürüm 2",
  published_at: at,
  effective_at: at,
  requirements: [
    {
      gate: "sale",
      scope: { center_ids: [I.center], product_version_ids: [uid(6)] },
      renewed_acceptance: false,
    },
  ],
};
const document = {
  key: uid(4),
  kind: "document",
  document_id: uid(4),
  file_id: null,
  name: "Sentetik belge",
  created_at: at,
  expires_at: null,
  state: "published",
  scope: "center",
  read_only: false,
  latest_version: version,
  version_count: 2,
  required_members: 8,
  pending_members: 3,
  acceptance_records: 19,
};
const ready = {
  ...document,
  key: uid(7),
  kind: "unpublished_file",
  document_id: null,
  file_id: uid(7),
  name: "Sentetik hazır dosya",
  latest_version: null,
  version_count: null,
  state: "ready_unpublished",
  required_members: 0,
  pending_members: 0,
  acceptance_records: null,
};
const summary = {
  published_documents: 4,
  unpublished_files: 2,
  pending_members: 3,
  total_members: 8,
  last_publication: at,
  acceptance_records: 19,
};
const directory = (
  view: string,
  items: unknown[],
  next_cursor: string | null = null,
  history_available = true,
) => ({ view, items, as_of: at, next_cursor, history_available, summary });
test("document directory has native global summaries, cursor/search, actual ready draft and current-vs-history acceptance", async ({
  page,
}) => {
  const f = await mockCompletion(page, async ({ op, r, send }) => {
    if (op !== "document_directory_get_v1") return;
    if (r.view === "documents")
      await send(
        directory(
          "documents",
          r.page.cursor
            ? [{ ...document, key: uid(11), document_id: uid(11), name: "İkinci sentetik belge" }]
            : [document, ready],
          r.page.cursor ? null : "docs-next",
        ),
      );
    if (r.view === "versions") await send(directory("versions", [version]));
    if (r.view === "acceptances")
      await send(
        directory(
          "acceptances",
          r.acceptance_filter === "pending"
            ? []
            : [
                {
                  key: "requirement",
                  kind: "requirement",
                  person_id: I.instructor,
                  display_name: "Sentetik katılımcı",
                  context: { gate: "sale", subject: { type: "sales", id: uid(8) } },
                  document_id: document.document_id,
                  required_version_id: version.version_id,
                  accepted: true,
                  status: "valid",
                  evidence_id: uid(9),
                  evidence_version_id: uid(10),
                  evidence_at: at,
                  evidence_matches_version: false,
                },
                {
                  key: "history",
                  kind: "history",
                  acceptance_id: uid(9),
                  document_id: document.document_id,
                  version_id: version.version_id,
                  version_label: version.version_label,
                  person_id: I.instructor,
                  display_name: "Tarihsel katılımcı",
                  accepted_at: at,
                  context: { gate: "sale", subject: { type: "sales", id: uid(8) } },
                  evidence_state: "recorded",
                  evidence_kind: "server_document",
                },
              ],
        ),
      );
  });
  await page.goto(completionUrl("documents"));
  await expect(page.getByText("3 / 8", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik hazır dosya", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("İkinci sentetik belge", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Önceki sayfa", exact: true }).click();
  await page.getByRole("tab", { name: /Kabul/ }).click();
  await expect(page.getByRole("combobox", { name: "Belge", exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Belge", exact: true })
    .selectOption(document.document_id);
  await page.getByRole("radio", { name: "Tümü", exact: true }).click();
  await expect(
    page.getByRole("row", { name: "Sk Sentetik katılımcı Satış", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Tk Tarihsel katılımcı Satış", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Önceki sürüm.*geçerli|Önceki.*geçerli/)).toBeVisible();
  expect(
    f.requests
      .filter((row) => row.op === "document_directory_get_v1" && row.r.view === "acceptances")
      .every((row) => row.r.document_id === document.document_id),
  ).toBe(true);
});
test("organization discovered read-only document does not request forbidden versions or enable a new version", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const f = await mockCompletion(page, async ({ op, r, send }) => {
    if (op === "document_directory_get_v1")
      await send(
        directory(
          r.view,
          [
            {
              ...document,
              scope: "organization",
              read_only: true,
              version_count: null,
              acceptance_records: null,
              latest_version: { ...version, requirements: null },
            },
          ],
          null,
          false,
        ),
      );
  });
  await page.goto(completionUrl("documents"));
  await page.getByRole("row").filter({ hasText: "Sentetik belge" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Sentetik belge");
  await expect(sheet.getByRole("button", { name: "Yeni sürüm yükle", exact: true })).toHaveCount(0);
  expect(
    f.requests.some((row) => row.op === "document_directory_get_v1" && row.r.view === "versions"),
  ).toBe(false);
});
test("owned ready file reuses the native file and publishes only after explicit protection review without another upload", async ({
  page,
}) => {
  let published = false;
  const writes: { op: string; r: Record<string, unknown> }[] = [];
  const proof = {
    id: uid(15),
    token: "synthetic",
    scope_hash: "synthetic",
    dependencies: { versions: [] },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  };
  await mockCompletion(page, async ({ op, r, send }) => {
    if (op === "document_directory_get_v1")
      await send(directory(r.view, r.view === "documents" ? [published ? document : ready] : []));
    if (op === "document_publication_preview_v1")
      await send({ preview: proof, affected: [], preserves_reservations: true });
    if (op === "preview_get_v1") await send(proof);
    if (op === "document_version_publish_v1") {
      writes.push({ op, r });
      published = true;
      await send(nativeMutation(ready.file_id));
    }
    if (op === "management_state_get_v1" && r.operation === "document_version_publish_v1")
      await send(
        nativePage([
          metadata(
            "document_version_publish_v1",
            "document_versions",
            ready.file_id,
            {
              document_id: document.document_id,
              file_id: ready.file_id,
              version_label: "Yeni sentetik sürüm",
              scope: { kind: "center", center_id: I.center },
              requirements: r.selector.key.requirements ?? [
                { gate: "sale", scope: { center_ids: [I.center] }, renewed_acceptance: true },
              ],
            },
            1,
            "published",
          ),
        ]),
      );
  });
  await page.goto(completionUrl("documents"));
  await page.getByRole("row").filter({ hasText: "Sentetik hazır dosya" }).click();
  await page.getByRole("button", { name: "Yayına hazırla", exact: true }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("textbox", { name: /Belge adı/ })).toHaveAttribute("readonly", "");
  await editor.getByRole("textbox", { name: /Sürüm/ }).fill("Yeni sentetik sürüm");
  await editor.getByRole("checkbox", { name: /Satış/ }).press("Space");
  await editor.getByRole("button", { name: "Etkiyi göster", exact: true }).click();
  await expect(editor.getByText(/0.*korun|korun.*0/)).toBeVisible();
  await editor.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await editor.getByRole("button", { name: "Yayınla", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]!.r.file_id).toBe(ready.file_id);
  await expect(
    page.getByText("Yeni sentetik sürüm sürümü yayımlandı ve sunucudan yeniden doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("M02 publication rereads the visible first page and refreshes old cursor/filter caches only on return", async ({
  page,
}) => {
  let published = false;
  let publicationRequest: Record<string, unknown> | undefined;
  let oldCursorReads = 0;
  let allAcceptanceReads = 0;
  const proof = {
    id: uid(15),
    token: "synthetic",
    scope_hash: "synthetic",
    dependencies: { versions: [] },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  };
  const history = {
    key: "history",
    kind: "history",
    acceptance_id: uid(9),
    document_id: document.document_id,
    version_id: version.version_id,
    version_label: version.version_label,
    person_id: I.instructor,
    display_name: "Tarihsel katılımcı",
    accepted_at: at,
    context: { gate: "sale", subject: { type: "sales", id: uid(8) } },
    evidence_state: "recorded",
    evidence_kind: "server_document",
  };

  const f = await mockCompletion(page, async ({ op, r, send }) => {
    if (op === "document_directory_get_v1") {
      if (r.view === "versions") {
        await send(directory("versions", [version]));
        return;
      }
      if (r.view === "acceptances") {
        if (r.acceptance_filter === "all") allAcceptanceReads++;
        await send(directory("acceptances", r.acceptance_filter === "all" ? [history] : []));
        return;
      }
      if (r.page.cursor) {
        expect(r.page.cursor).toBe("stable-cursor");
        oldCursorReads++;
        await send(
          directory("documents", [
            {
              ...document,
              key: uid(11),
              document_id: uid(11),
              name: published ? "İkinci güncel belge" : "İkinci eski belge",
            },
          ]),
        );
        return;
      }
      const newlyPublished = {
        ...document,
        key: uid(18),
        document_id: uid(18),
        name: ready.name,
        latest_version: {
          ...version,
          version_id: ready.file_id,
          version_label: "Yeni sentetik sürüm",
        },
      };
      await send(
        directory(
          "documents",
          published ? [document, newlyPublished] : [document, ready],
          "stable-cursor",
        ),
      );
      return;
    }
    if (op === "document_publication_preview_v1") {
      await send({ preview: proof, affected: [], preserves_reservations: true });
      return;
    }
    if (op === "preview_get_v1") {
      await send(proof);
      return;
    }
    if (op === "document_version_publish_v1") {
      publicationRequest = r;
      published = true;
      await send(nativeMutation(ready.file_id));
      return;
    }
    if (op === "management_state_get_v1" && r.operation === "document_version_publish_v1") {
      expect(publicationRequest).toBeDefined();
      await send(
        nativePage([
          metadata(
            "document_version_publish_v1",
            "document_versions",
            ready.file_id,
            {
              document_id: uid(18),
              file_id: ready.file_id,
              version_label: "Yeni sentetik sürüm",
              scope: { kind: "center", center_id: I.center },
              requirements: publicationRequest!.requirements,
            },
            1,
            "published",
          ),
        ]),
      );
    }
  });

  await page.goto(completionUrl("documents"));
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("İkinci eski belge", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Önceki sayfa", exact: true }).click();

  await page.getByRole("tab", { name: /Kabul/ }).click();
  await page
    .getByRole("combobox", { name: "Belge", exact: true })
    .selectOption(document.document_id);
  await page.getByRole("radio", { name: "Tümü", exact: true }).click();
  await expect(page.getByText("Tarihsel katılımcı", { exact: false })).toBeVisible();
  const initialAcceptanceReads = allAcceptanceReads;
  const initialCursorReads = oldCursorReads;
  expect(initialAcceptanceReads).toBeGreaterThan(0);
  expect(initialCursorReads).toBeGreaterThan(0);

  // Restore the exact document-page query key primed before the publication.
  // The acceptance page remains cached under its original document/filter key.
  await page.getByRole("radio", { name: "Bekleyen", exact: true }).click();
  await page.getByRole("combobox", { name: "Belge", exact: true }).selectOption("");
  await page.getByRole("tab", { name: /Belgeler/ }).click();
  await page.getByRole("row").filter({ hasText: ready.name }).click();
  await page.getByRole("button", { name: "Yayına hazırla", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("textbox", { name: /Sürüm/ }).fill("Yeni sentetik sürüm");
  await editor.getByRole("checkbox", { name: /Satış/ }).press("Space");
  await editor.getByRole("button", { name: "Etkiyi göster", exact: true }).click();
  await editor.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await editor.getByRole("button", { name: "Yayınla", exact: true }).click();

  await expect(
    page.getByText("Yeni sentetik sürüm sürümü yayımlandı ve sunucudan yeniden doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(oldCursorReads).toBe(initialCursorReads);
  expect(allAcceptanceReads).toBe(initialAcceptanceReads);
  expect(
    f.requests.filter((request) => request.op === "document_version_publish_v1"),
  ).toHaveLength(1);
  const writeIndex = f.requests.findIndex((request) => request.op === "document_version_publish_v1");
  const resultIndex = f.requests.findIndex(
    (request) =>
      request.op === "management_state_get_v1" &&
      request.r.operation === "document_version_publish_v1",
  );
  expect(writeIndex).toBeGreaterThan(-1);
  expect(resultIndex).toBeGreaterThan(writeIndex);
  expect(
    f.requests.slice(resultIndex + 1).some(
      (request) =>
        request.op === "document_directory_get_v1" &&
        request.r.view === "documents" &&
        !request.r.page.cursor,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("İkinci güncel belge", { exact: true })).toBeVisible();
  expect(oldCursorReads).toBe(initialCursorReads + 1);

  await page.getByRole("tab", { name: /Kabul/ }).click();
  await page
    .getByRole("combobox", { name: "Belge", exact: true })
    .selectOption(document.document_id);
  await page.getByRole("radio", { name: "Tümü", exact: true }).click();
  await expect(page.getByText("Tarihsel katılımcı", { exact: false })).toBeVisible();
  expect(allAcceptanceReads).toBe(initialAcceptanceReads + 1);
});
