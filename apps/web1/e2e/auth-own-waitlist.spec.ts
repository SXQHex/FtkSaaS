import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import type { WaitlistEntryView, SeatOfferView } from "../src/lib/api-contracts/generated.js";
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function setup(page: Page, mode: "normal" | "unknown" | "denied" | "expired" = "normal") {
  const base = await mockOwnReservations(page),
    writes: Record<string, unknown>[] = [],
    reads: Record<string, unknown>[] = [];
  const entry: WaitlistEntryView = {
    id: id(970),
    center_id: I.center,
    session_id: id(980),
    person_id: I.self,
    version: 2,
    state: "waiting",
    created_at: "2026-11-16T11:00:00Z",
    joined_at: "2026-11-16T11:00:00Z",
    offers: [],
  };
  const offer: SeatOfferView = {
    id: id(972),
    entry_id: id(971),
    session_id: id(981),
    person_id: I.self,
    version: 3,
    state: "active",
    created_at: entry.created_at,
    expires_at: mode === "expired" ? "2026-11-16T11:59:00Z" : "2026-11-16T13:00:00Z",
  };
  const offered: WaitlistEntryView = {
    ...entry,
    id: offer.entry_id,
    session_id: offer.session_id,
    state: "offered",
    offers: [offer],
  };
  let aborted = false;
  const managed = (value: WaitlistEntryView, asOffer = false) => ({
    operation: "waitlist_join_v1",
    entity: {
      type: asOffer ? "seat_offers" : "waitlist_entries",
      id: asOffer ? offer.id : value.id,
    },
    exists: true,
    state: asOffer ? offer.state : value.state,
    versions: [
      { entity: { type: "waitlist_entries", id: value.id }, version: value.version },
      ...(value.offers.length
        ? [{ entity: { type: "seat_offers", id: offer.id }, version: offer.version }]
        : []),
    ],
    as_of: entry.created_at,
    current: null,
    waitlist_detail: value,
    waitlist_session: {
      id: value.session_id,
      title: asOffer ? "Bilinmeyen seanstaki teklif" : "Rezervasyonsuz bekleme dersi",
      interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
      timezone: "Europe/Istanbul",
      state: "planned",
      version: 1,
    },
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      list = (items: unknown[]) =>
        send({ items, next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (
      op === "management_state_get_v1" &&
      ["waitlist_join_v1", "waitlist_leave_v1"].includes(r.operation)
    ) {
      reads.push(r);
      const key = r.selector.key;
      if (key.directory === "self") {
        expect(key).not.toHaveProperty("person_id");
        expect(key).not.toHaveProperty("session_id");
        if (mode === "denied")
          return route.fulfill({
            status: 403,
            json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
          });
        return list(
          key.view === "entries"
            ? entry.state === "waiting"
              ? [managed(entry)]
              : []
            : offer.state === "active"
              ? [managed(offered, true)]
              : [],
        );
      }
      return list([
        managed(key.entry_id === entry.id || key.session_id === entry.session_id ? entry : offered),
      ]);
    }
    if (["waitlist_leave_v1", "seat_offer_accept_v1", "seat_offer_reject_v1"].includes(op)) {
      writes.push({ op, ...r });
      if (op === "waitlist_leave_v1") {
        expect(r.entry_id).toBe(entry.id);
        expect(r.expected_version).toBe(2);
        entry.state = "left";
        entry.version++;
      } else {
        expect(r.offer_id).toBe(offer.id);
        expect(r.expected_version).toBe(3);
        offer.state = op === "seat_offer_accept_v1" ? "accepted" : "rejected";
        offer.version++;
        offered.state = op === "seat_offer_accept_v1" ? "converted" : "closed";
        offered.version++;
      }
      if (mode === "unknown" && !aborted) {
        aborted = true;
        return route.abort("failed");
      }
      return send({
        primary_id: op === "waitlist_leave_v1" ? entry.id : offer.id,
        operation_id: id(999),
      });
    }
    if (
      op === "operation_status_get_v1" &&
      ["waitlist_leave_v1", "seat_offer_accept_v1", "seat_offer_reject_v1"].includes(r.operation)
    )
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_reference: {
          type: r.operation === "waitlist_leave_v1" ? "waitlist_entries" : "seat_offers",
          id: r.operation === "waitlist_leave_v1" ? entry.id : offer.id,
        },
      });
    if (op === "document_requirements_get_v1") return send([]);
    if (op === "reservation_list_v1" && r.session_id === offer.session_id)
      return list(
        offer.state === "accepted"
          ? [{ ...base.reservations[0], session_id: offer.session_id, state: "active" }]
          : [],
      );
    return route.fallback();
  });
  await page.reload();
  return { writes, reads };
}
async function submit(page: Page, label: string) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", {
      name: "Hak kaynağını ve iptal koşullarını inceledim, işlemi onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await dialog.getByRole("button", { name: label, exact: true }).click();
  return dialog;
}
test("own waiting directory discovers sessions without reservations and leaves with exact native version", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await expect(page.getByText("Rezervasyonsuz bekleme dersi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sıradan çık", exact: true }).click();
  const dialog = await submit(page, "Sıradan çık");
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByText("Rezervasyonsuz bekleme dersi", { exact: true })).toHaveCount(0);
});
test("own unknown leave locks dismissal and reads receipt without repeating writer", async ({
  page,
}) => {
  const state = await setup(page, "unknown");
  await page.getByRole("button", { name: "Sıradan çık", exact: true }).click();
  const dialog = await submit(page, "Sıradan çık");
  await expect(
    dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
for (const action of ["accept", "reject"] as const)
  test(`own active offer ${action} uses exact offer and refreshes both native directories`, async ({
    page,
  }) => {
    const state = await setup(page),
      label = action === "accept" ? "Teklifi kabul et" : "Teklifi reddet";
    await expect(page.getByText("Bilinmeyen seanstaki teklif", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: label, exact: true }).click();
    const dialog = await submit(page, label);
    await expect(
      dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]!.op).toBe(
      action === "accept" ? "seat_offer_accept_v1" : "seat_offer_reject_v1",
    );
  });
test("own directory denial remains unread and expired active offer cannot submit", async ({
  page,
}) => {
  const state = await setup(page, "denied");
  await expect(
    page.getByText("Güncel bekleme listesi ve teklifler okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bekleme listesinde değilsin.", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("elapsed native active offer retains its true state but disables decisions", async ({
  page,
}) => {
  await setup(page, "expired");
  await expect(
    page.getByText("Aktif yer teklifi", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Teklifi kabul et", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Teklifi reddet", exact: true })).toBeDisabled();
});
