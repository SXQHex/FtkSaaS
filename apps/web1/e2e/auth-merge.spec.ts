import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type {
  PersonView,
  Preview,
  ManagementStateView,
} from "../src/lib/api-contracts/generated.js";
const previewId = "019a7b00-0000-7000-8000-000000000081";
async function mockMerge(page: Page) {
  await mockStudio(page);
  const state = {
    decision: "merge" as "merge" | "not_duplicate",
    reason: "",
    merged: false,
    dismissed: false,
    approved: false,
    receiptAvailable: true,
    directoryDenied: false,
    lostReply: false,
    failResult: 0,
    effects: 0,
    keys: new Set<string>(),
    writes: [] as { op: string; key: string }[],
    reads: [] as { status?: string; query?: string; cursor?: string }[],
  };
  const person = (id: string): PersonView => ({
    id,
    display_name: id === I.instructor ? "Örnek Eğitmen" : "Örnek Yönetici",
    version: 3,
    relationships: [{ kind: "student", center_id: I.center, state: "active" }],
    contacts: [],
    discipline_relationships: [],
    ...(state.merged && id === I.instructor ? { linked_person_ids: [I.self] } : {}),
    member_summary: {
      as_of: "2026-11-15T00:00:00Z",
      rights: {
        status: "available",
        available_credits: "9007199254740993",
        available_timed_packages: 2,
      },
      debt: { status: "restricted" },
      next_lesson: { status: "available", lesson: null },
    },
  });
  const versions = () =>
    [I.self, I.instructor].map((id) => ({ entity: { type: "people" as const, id }, version: 3 }));
  const preview = (): Preview => ({
    id: previewId,
    token: "synthetic-capability",
    scope_hash: "synthetic-scope",
    dependencies: {
      versions: versions(),
      policy_hashes: [],
      permission_hash: "synthetic-permission",
    },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
    merge_summary: {
      source_id: I.self,
      target_id: I.instructor,
      affected_center_ids: [I.center],
      required_approval_center_ids: [],
      linked_history: state.decision === "merge",
      reason: state.reason,
      decision: state.decision,
    },
  });
  const review = (kind: "suggested" | "completed" | "not_duplicate"): ManagementStateView => ({
    operation: "person_merge_preview_v1",
    exists: true,
    entity: { type: "people", id: I.instructor },
    state: kind === "suggested" ? "pending" : kind === "completed" ? "accepted" : "rejected",
    versions: versions(),
    as_of: "2026-11-15T00:00:00Z",
    current: {
      operation: "person_merge_preview_v1",
      values: { source_id: I.self, target_id: I.instructor },
    },
    merge_review: {
      state: kind,
      source: { id: I.self, display_name: person(I.self).display_name, version: 3 },
      target: { id: I.instructor, display_name: person(I.instructor).display_name, version: 3 },
      reason: kind === "suggested" ? null : state.reason,
      recorded_at: kind === "suggested" ? null : "2026-11-15T00:00:00Z",
      matching_kinds: kind === "suggested" ? ["email"] : [],
    },
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    const r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.org, data } });
    if (op === "person_get_v1") {
      if (!page.url().endsWith("/people/merge")) return route.fallback();
      expect(r.include_member_summary).toBe(true);
      if (state.failResult && state.merged) {
        state.failResult--;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: I.org },
          },
        });
      }
      return send(person(r.person_id));
    }
    if (op === "management_state_get_v1" && r.operation === "person_merge_preview_v1") {
      const key = r.selector.key;
      state.reads.push({ ...key, cursor: r.page.cursor });
      if (state.directoryDenied)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.org } },
        });
      const kind = key.status as "suggested" | "completed" | "not_duplicate";
      const items =
        kind === "suggested"
          ? !state.merged && !state.dismissed
            ? [review(kind)]
            : []
          : kind === "completed"
            ? state.merged
              ? [review(kind)]
              : []
            : state.dismissed
              ? [review(kind)]
              : [];
      return send({
        items,
        next_cursor: null,
        as_of: "2026-11-15T00:00:00Z",
        merge_review_summary: {
          total: 1,
          filtered: items.length,
          by_state: [{ state: kind, count: items.length }],
        },
      });
    }
    if (op === "management_state_get_v1" && r.operation === "person_merge_approve_v1")
      return send({
        items: [
          {
            operation: "person_merge_approve_v1",
            exists: true,
            entity: { type: "previews", id: previewId },
            state: "pending",
            versions: versions(),
            as_of: "2026-11-15T00:00:00Z",
            current: null,
            merge_approval: {
              source_id: I.self,
              target_id: I.instructor,
              approval_center_id: I.center,
              preview: { id: previewId, token: "synthetic-approval" },
              expires_at: "2099-01-01T00:00:00Z",
              affected_center_ids: [I.center],
              required_approvals: [{ center_id: I.center, approved: state.approved }],
              linked_history: true,
              effects: [],
              reason: "Pinned approval reason",
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-15T00:00:00Z",
      });
    if (op === "person_merge_preview_v1") {
      expect(r).toMatchObject({
        source_id: I.self,
        target_id: I.instructor,
        org_id: I.org,
        center_id: I.center,
      });
      state.reason = r.reason;
      state.decision = r.decision;
      return send(preview());
    }
    if (op === "person_merge_apply_v1" || op === "person_merge_approve_v1") {
      state.writes.push({ op, key: r.operation_key });
      expect(r.preview.id).toBe(previewId);
      if (op === "person_merge_approve_v1") {
        expect(r.approval_center_id).toBe(I.center);
        expect(r.preview.token).toBe("synthetic-approval");
        state.approved = true;
        return send({ primary_id: previewId });
      }
      if (!state.keys.has(r.operation_key)) {
        state.keys.add(r.operation_key);
        state.effects++;
        if (state.decision === "merge") state.merged = true;
        else state.dismissed = true;
      }
      if (state.lostReply) {
        state.lostReply = false;
        return route.abort();
      }
      return send({ primary_id: I.instructor });
    }
    if (op === "operation_status_get_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: state.receiptAvailable,
        result_reference: state.receiptAvailable ? { type: "people", id: I.instructor } : null,
      });
    return route.fallback();
  });
  return state;
}
async function openMerge(page: Page) {
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people/merge`);
  await expect(
    page.getByRole("heading", { name: "Kişileri birleştir", exact: true }),
  ).toBeVisible();
}
async function selectPair(page: Page) {
  await page
    .getByRole("radiogroup", { name: "Birleştirme istekleri", exact: true })
    .getByRole("radio")
    .first()
    .click();
  await expect(
    page.getByRole("grid", { name: "Birleştirilecek kayıtların karşılaştırması", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await page.getByRole("checkbox", { name: /Etkiyi okudum/ }).focus();
  await page.keyboard.press("Space");
}
test("Merge: pinned reason, explicit confirmation, same-key lost reply and read-only post-ack recovery", async ({
  page,
}) => {
  const state = await mockMerge(page);
  await openMerge(page);
  await selectPair(page);
  await expect(
    page.getByText("9.007.199.254.740.993 kredi · 2 süreli paket", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(page.getByLabel("Gerekçe", { exact: false })).toBeFocused();
  await page.getByLabel("Gerekçe", { exact: false }).fill("Fixture first reason");
  await page.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(
    page.getByText("Güncel birleşim önizlemesi yüklendi.", { exact: true }),
  ).toBeVisible();
  await review(page);
  await page.getByLabel("Gerekçe", { exact: false }).fill("Fixture final reason");
  await expect(page.getByRole("checkbox", { name: /Etkiyi okudum/ })).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Kayıtları birleştir", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(
    page.getByText("Güncel birleşim önizlemesi yüklendi.", { exact: true }),
  ).toBeVisible();
  await review(page);
  state.lostReply = true;
  state.failResult = 1;
  await page.getByRole("button", { name: "Kayıtları birleştir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Gerekçe", { exact: false })).toBeDisabled();
  await page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sonucu yeniden oku", exact: true })).toBeVisible();
  const writes = state.writes.length;
  await page.getByRole("button", { name: "Sonucu yeniden oku", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi ve güncel sonuç okundu.", { exact: true }).first(),
  ).toBeVisible();
  expect(state.writes).toHaveLength(writes);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]?.key).toBe(state.writes[1]?.key);
  expect(state.effects).toBe(1);
  expect(state.reason).toBe("Fixture final reason");
});
test("Merge: not-duplicate has its own preview/apply and durable scoped history, mobile AA", async ({
  page,
}) => {
  const state = await mockMerge(page);
  await openMerge(page);
  await selectPair(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByLabel("Gerekçe", { exact: false }).fill("Fixture distinct people");
  await page.getByRole("button", { name: "Kopya değil", exact: true }).click();
  await expect(page.getByText(/Kopya-değil kararı önizlendi/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "merge-not-duplicate-preview-mobile")).violations).toEqual(
    [],
  );
  await review(page);
  await page.getByRole("button", { name: "Kopya değil kararını kaydet", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi ve güncel sonuç okundu.", { exact: true }).first(),
  ).toBeVisible();
  expect(state.merged).toBe(false);
  expect(state.dismissed).toBe(true);
  expect(state.effects).toBe(1);
  await page
    .getByRole("radiogroup", { name: "Birleştirme durumu", exact: true })
    .getByRole("radio", { name: "Kopya değil", exact: true })
    .click();
  await selectPairHistory(page);
  await expect(page.getByText(/Kaydedilen gerekçe: Fixture distinct people/)).toBeVisible();
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
});
async function selectPairHistory(page: Page) {
  await page
    .getByRole("radiogroup", { name: "Birleştirme istekleri", exact: true })
    .getByRole("radio")
    .first()
    .click();
}
test("Merge: a center approval uses only its scoped approval capability", async ({ page }) => {
  const state = await mockMerge(page);
  await openMerge(page);
  await page
    .getByRole("radiogroup", { name: "Birleştirme durumu", exact: true })
    .getByRole("radio", { name: "Merkez onayları", exact: true })
    .click();
  await selectPair(page);
  await expect(page.getByLabel("Gerekçe", { exact: false })).toHaveValue("Pinned approval reason");
  await expect(page.getByLabel("Gerekçe", { exact: false })).toBeDisabled();
  await review(page);
  await page.getByRole("button", { name: "Bu merkez için onay ver", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi ve güncel sonuç okundu.", { exact: true }).first(),
  ).toBeVisible();
  expect(state.approved).toBe(true);
  expect(state.merged).toBe(false);
  expect(state.writes.map((x) => x.op)).toEqual(["person_merge_approve_v1"]);
});

test("Merge: a succeeded receipt with no cached result never replays its writer", async ({
  page,
}) => {
  const state = await mockMerge(page);
  await openMerge(page);
  await selectPair(page);
  await page.getByLabel("Gerekçe", { exact: false }).fill("Fixture receipt recovery");
  await page.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(
    page.getByText("Güncel birleşim önizlemesi yüklendi.", { exact: true }),
  ).toBeVisible();
  await review(page);
  state.lostReply = true;
  state.failResult = 1;
  state.receiptAvailable = false;
  await page.getByRole("button", { name: "Kayıtları birleştir", exact: true }).click();
  await page.getByRole("button", { name: "İşlem durumunu oku", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sonucu yeniden oku", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sonucu yeniden oku", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi ve güncel sonuç okundu.", { exact: true }).first(),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
});

test("Merge: a denied directory clears private selection and offers only explicit retry", async ({
  page,
}) => {
  const state = await mockMerge(page);
  state.directoryDenied = true;
  await openMerge(page);
  await expect(
    page.getByText("Birleştirme istekleri okunamadı. Yeniden dene.", { exact: true }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(1);
  await expect(
    page.getByRole("grid", { name: "Birleştirilecek kayıtların karşılaştırması", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Güncel durumu oku", exact: true }).click();
  await expect.poll(() => state.reads.length).toBe(2);
  expect(state.writes).toHaveLength(0);
});
