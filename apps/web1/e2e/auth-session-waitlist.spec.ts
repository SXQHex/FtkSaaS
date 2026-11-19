import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { WaitlistEntryView, SeatOfferView } from "../src/lib/api-contracts/generated.js";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { expectGridButtonTarget, scanAccessibility } from "./accessibility.js";
const entryId = "019a7b00-0000-7000-8000-000000000091",
  offerId = "019a7b00-0000-7000-8000-000000000092";
async function setup(
  page: Page,
  options: { offered?: boolean; otherPerson?: boolean; denied?: boolean; unknown?: boolean } = {},
) {
  const base = await mockSessionDetail(page, { existing: true });
  // Waitlist commands require a future session, independently of an existing booking.
  base.session.starts_at = new Date(Date.now() + 3600000).toISOString();
  base.session.ends_at = new Date(Date.now() + 7200000).toISOString();
  const stamp = new Date().toISOString();
  let entry: WaitlistEntryView | undefined = options.offered
    ? {
        id: entryId,
        center_id: I.center,
        session_id: S.session,
        person_id: options.otherPerson ? I.instructor : I.self,
        version: 2,
        created_at: stamp,
        joined_at: stamp,
        state: "offered",
        offers: [],
      }
    : undefined;
  let offer: SeatOfferView | undefined = entry
    ? {
        id: offerId,
        entry_id: entryId,
        person_id: entry.person_id,
        session_id: S.session,
        version: 3,
        created_at: stamp,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        state: "active",
      }
    : undefined;
  const writes: { operation: string; request: Record<string, unknown> }[] = [];
  let denied = options.denied,
    dropped = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (
      operation === "management_state_get_v1" &&
      ["waitlist_join_v1", "waitlist_leave_v1"].includes(req.operation)
    ) {
      if (denied)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      const key = req.selector.key,
        isDirectory = key.directory === "session",
        isOffer = key.view === "offers";
      expect(isDirectory ? key.session_id : (key.entry_id ?? key.session_id)).toBe(
        isDirectory || !key.entry_id ? S.session : entryId,
      );
      const visible = entry && (!isOffer || offer);
      const detail = entry
        ? { ...entry, offers: isDirectory && !isOffer ? [] : offer ? [offer] : [] }
        : undefined;
      return send({
        items: !visible
          ? []
          : [
              {
                operation: req.operation,
                exists: true,
                entity: {
                  type: isOffer ? "seat_offers" : "waitlist_entries",
                  id: isOffer ? offerId : entryId,
                },
                state: isOffer ? offer!.state : entry!.state,
                as_of: stamp,
                current: null,
                versions: [
                  { entity: { type: "waitlist_entries", id: entryId }, version: entry!.version },
                  ...(offer
                    ? [{ entity: { type: "seat_offers", id: offerId }, version: offer.version }]
                    : []),
                ],
                waitlist_display_name: "Örnek öğrenci",
                waitlist_detail: detail,
              },
            ],
        next_cursor: null,
        as_of: stamp,
      });
    }
    if (
      [
        "waitlist_join_v1",
        "waitlist_leave_v1",
        "seat_offer_accept_v1",
        "seat_offer_reject_v1",
      ].includes(operation)
    ) {
      writes.push({ operation, request: req });
      if (operation === "waitlist_join_v1") {
        expect(req).toMatchObject({ person_id: I.self, session_id: S.session });
        entry = {
          id: entryId,
          center_id: I.center,
          session_id: S.session,
          person_id: I.self,
          version: 1,
          created_at: stamp,
          joined_at: stamp,
          state: "waiting",
          offers: [],
        };
      } else if (operation === "waitlist_leave_v1") {
        expect(req).toMatchObject({ entry_id: entryId, expected_version: entry!.version });
        entry!.state = "left";
        entry!.version++;
      } else {
        expect(req).toMatchObject({ offer_id: offerId, expected_version: offer!.version });
        offer!.state = operation === "seat_offer_accept_v1" ? "accepted" : "rejected";
        offer!.version++;
        entry!.state = operation === "seat_offer_accept_v1" ? "converted" : "closed";
        entry!.version++;
      }
      if (options.unknown && !dropped) {
        dropped = true;
        return route.abort("failed");
      }
      return send({
        operation_id: I.role,
        primary_id: operation.startsWith("seat_offer") ? offerId : entryId,
        version: offer?.version ?? entry!.version,
        replayed: false,
        related:
          operation === "seat_offer_accept_v1" ? [{ type: "reservations", id: S.reservation }] : [],
      });
    }
    if (operation === "operation_status_get_v1" && req.operation === "waitlist_join_v1") {
      expect(req.key).toBe(writes[0]!.request.operation_key);
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "waitlist_entries", id: entryId },
      });
    }
    return route.fallback();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Bekleme listesi", exact: true }).click();
  return {
    writes,
    restore: () => {
      denied = false;
    },
  };
}
const saved = "İşlem kaydedildi ve güncel sonuç okundu.";
async function confirm(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Onayla", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
}
test("completed mobile waitlist joins and leaves through native versions and keeps actual reservation source", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await page.getByRole("button", { name: "Listeye ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Ara", exact: true }).click();
  await dialog.getByLabel("Üye", { exact: true }).selectOption(I.self);
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Bekleme listesine ekle", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect((await scanAccessibility(page, "session-waitlist-join-mobile")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Listeden çıkar — Örnek öğrenci", exact: true }).click();
  await confirm(page);
  expect(state.writes.map((row) => row.operation)).toEqual([
    "waitlist_join_v1",
    "waitlist_leave_v1",
  ]);
  await expect(page.getByText("Ayrıldı", { exact: true })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "session-waitlist-left-mobile")).violations).toEqual([]);
  await page.getByRole("tab", { name: "Katılımcılar", exact: true }).click();
  await expect(page.getByText(/Satın alınmış paket · 7 ders · Aktif/)).toBeVisible();
});
for (const action of ["accept", "reject"] as const)
  test(`own offer ${action} uses offer ID and rereads its native terminal state`, async ({
    page,
  }) => {
    const state = await setup(page, { offered: true });
    await page
      .getByRole("button", {
        name: action === "accept" ? "Teklifi kabul et" : "Teklifi reddet",
        exact: true,
      })
      .click();
    await confirm(page);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      operation: action === "accept" ? "seat_offer_accept_v1" : "seat_offer_reject_v1",
      request: { offer_id: offerId, expected_version: 3 },
    });
    await expect(page.getByRole("button", { name: "Teklifi kabul et", exact: true })).toHaveCount(
      0,
    );
    expect((await scanAccessibility(page, `session-offer-${action}`)).violations).toEqual([]);
  });
test("directory denial is not empty and unknown join recovers without rewrite", async ({
  page,
}) => {
  const state = await setup(page, { denied: true, unknown: true });
  await expect(
    page.getByText("Bu bölüm okunamadı. Yeniden deneyebilirsin.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bu sayfada bekleyen kayıt yok.", { exact: true })).toHaveCount(0);
  state.restore();
  await page
    .getByRole("tabpanel")
    .getByRole("button", { name: "Yeniden oku", exact: true })
    .click();
  await page.getByRole("button", { name: "Listeye ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Ara", exact: true }).click();
  await dialog.getByLabel("Üye", { exact: true }).selectOption(I.self);
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Bekleme listesine ekle", exact: true }).click();
  await dialog.getByRole("button", { name: "İşlem sonucunu oku", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expectGridButtonTarget(
    page.getByRole("grid", { name: "Bekleme listesi", exact: true }).getByRole("button", {
      name: "Listeden çıkar — Örnek öğrenci",
      exact: true,
    }),
  );
  expect(state.writes).toHaveLength(1);
});
test("another person's visible offer does not expose accept or reject controls", async ({
  page,
}) => {
  const state = await setup(page, { offered: true, otherPerson: true });
  const history = page.getByRole("grid", { name: "Sonuçlanan teklifler", exact: true });
  const offer = history.getByRole("row").filter({ hasText: "Örnek öğrenci" });
  await expect(offer.getByText("Örnek öğrenci", { exact: true })).toBeVisible();
  await expect(offer.getByRole("gridcell").last()).toBeEmpty();
  const waiting = page.getByRole("grid", { name: "Bekleme listesi", exact: true });
  const remove = waiting.getByRole("button", {
    name: "Listeden çıkar — Örnek öğrenci",
    exact: true,
  });
  await expectGridButtonTarget(remove);
  await expect(page.getByRole("button", { name: "Teklifi kabul et", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Teklifi reddet", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
