import { activate } from "./device-input.js";
import type { Page } from "@playwright/test";
import { test, expect } from "./test.js";
import { origin } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { sessionIds as S } from "./session-detail-fixture.js";
import { mockStudioChain, chainIds as C } from "./pro-chain-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

test("Pro same-record journey reconciles setup, person, agreement, program, sale, collection, reservation, attendance and earnings reports", async ({
  page,
}) => {
  await runStudioChain(page, "pro");
});

test("Starter same-record journey collects debt and consumes the right without an agreement or earnings", async ({
  page,
}) => {
  await runStudioChain(page, "starter");
});

async function runStudioChain(page: Page, plan: "pro" | "starter") {
  const starter = plan === "starter";
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-11-17T08:00:00Z"));
  const f = await mockStudioChain(page, plan);
  const base = `${origin}/o/${I.org}/c/${I.center}`;
  async function bookStudent() {
    await page.goto(`${base}/sessions/${S.session}`);
    await activate(page.getByRole("button", { name: "Katılımcı ekle", exact: true }));
    const panel = page.getByRole("dialog");
    await activate(panel.getByRole("button", { name: "Ara", exact: true }));
    await panel.getByLabel("Üye", { exact: true }).selectOption(I.self);
    await panel.getByLabel("Hak kaynağı", { exact: true }).selectOption(S.sale);
    await activate(
      panel.getByRole("checkbox", {
        name: "Seçili kişi, ders ve hak kaynağını kontrol ettim.",
        exact: true,
      }),
      "Space",
    );
    await activate(panel.getByRole("button", { name: "Rezervasyon oluştur", exact: true }));
    return panel;
  }
  if (starter)
    await test.step("Starter slot stays usable when a second room is rejected", async () => {
      await page.goto(`${base}/studio`);
      await activate(page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }));
      await expect(page.getByText("1 / 1 salon kullanılıyor (plan sınırı).")).toBeVisible();
      await activate(page.getByRole("button", { name: "Salon ekle", exact: true }));
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: "Salon adı", exact: true }).fill("İkinci salon");
      await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill("12");
      const denied = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/room_save_v1"),
      );
      await activate(dialog.getByRole("button", { name: "Salonu ekle", exact: true }));
      expect(await (await denied).json()).toMatchObject({
        ok: false,
        error: { code: "PLAN_LIMIT_REACHED" },
      });
      await expect(dialog.getByText(common.studio.resourceRejected)).toBeVisible();
      await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
      await expect(page.getByRole("button", { name: "Ana salon", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "İkinci salon", exact: true })).toHaveCount(0);
    });
  if (!starter)
    await test.step("publish the actual instructor agreement in the same center", async () => {
      await page.goto(`${base}/studio`);
      await activate(page.getByRole("tab", { name: "Anlaşmalar", exact: true }));
      await activate(page.getByRole("button", { name: /Örnek Eğitmen/ }));
      const panel = page.getByRole("dialog");
      await panel.getByLabel("Tutar (en küçük para birimi)", { exact: true }).fill("17500");
      await panel.locator("#agreement-from").fill("2026-11-17T11:30");
      await panel.locator("#agreement-until").fill("2027-01-01T09:00");
      await panel.locator("#agreement-reason").fill("Sentetik Pro zinciri anlaşması");
      await activate(panel.getByRole("checkbox"), "Space");
      await activate(panel.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }));
      await expect(panel).toHaveCount(0);
      expect(f.studio.agreements.at(-1)).toMatchObject({
        person_id: I.instructor,
        supersedes_id: I.agreement,
        version: 2,
        terms: { components: [{ kind: "session_fixed", amount_minor: "17500" }] },
      });
    });
  await test.step("create one person and activate the native student relationship", async () => {
    await page.goto(`${base}/people`);
    await activate(page.getByRole("button", { name: "Üye davet et", exact: true }));
    let panel = page.getByRole("dialog");
    await panel.locator("#people-name").fill(f.person.display_name);
    await panel.locator("#people-email").fill("pro-chain@example.invalid");
    await activate(panel.getByRole("button", { name: "Kişiyi oluştur", exact: true }));
    await expect(panel.getByRole("button", { name: "Daveti gönder", exact: true })).toBeVisible();
    await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    await page.goto(`${base}/people/${I.self}`);
    await expect(
      page.getByRole("heading", { name: f.person.display_name, exact: true }),
    ).toBeVisible();
    await activate(
      page.getByRole("button", { name: common.memberProfile.actions.activate, exact: true }),
    );
    panel = page.getByRole("alertdialog");
    await activate(
      panel.getByRole("button", { name: common.memberProfile.actions.activate, exact: true }),
    );
    await expect(
      panel.getByText(common.memberProfile.studentStates.saved, { exact: true }),
    ).toBeVisible();
    await activate(panel.getByRole("button", { name: common.memberProfile.close, exact: true }));
  });
  await test.step("preview and apply one program with that instructor and the real room", async () => {
    await page.goto(`${base}/schedule`);
    await activate(page.getByRole("button", { name: "Seans ekle", exact: true }));
    const panel = page.getByRole("dialog");
    await activate(panel.getByRole("radio", { name: "Haftalık seri", exact: true }));
    await panel.locator("#schedule-create-class").selectOption(I.lesson);
    await panel.locator("#schedule-create-instructor").selectOption(I.instructor);
    await panel.locator("#schedule-create-room").selectOption(I.room);
    await panel.locator("#schedule-create-capacity").fill("12");
    await panel.locator("#schedule-create-date").fill("2026-11-17");
    await panel.locator("#schedule-create-time").fill("12:00");
    await panel.locator("#schedule-create-duration").fill("60");
    await panel.locator("#schedule-create-weeks").fill("1");
    await activate(panel.getByRole("button", { name: "Sal", exact: true }));
    await activate(panel.getByRole("button", { name: "Seansları önizle", exact: true }));
    await expect(
      panel.getByRole("region", { name: "Oluşacak seanslar", exact: true }),
    ).toBeVisible();
    await activate(panel.getByRole("button", { name: "Seriyi oluştur", exact: true }));
    await expect.poll(() => f.programmed).toBe(true);
    await expect(panel).toHaveCount(0);
  });
  await test.step("sell the immutable eight-credit product and reread its new debt", async () => {
    await page.goto(`${base}/people/${I.self}`);
    await activate(page.getByRole("button", { name: "Paket / hak tahsis et", exact: true }));
    const panel = page.getByRole("dialog");
    await activate(panel.getByRole("radio", { name: f.product.terms.name, exact: true }), "Space");
    await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-01");
    await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-30");
    await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
    await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
    await activate(panel.getByRole("button", { name: "Uygula", exact: true }));
    await expect.poll(() => f.rights()[0]?.available).toBe(8);
    await expect(panel.getByRole("button", { name: "Kapat", exact: true })).toBeVisible();
    expect(f.debt()).toBe("100000");
    await activate(panel.getByRole("button", { name: "Kapat", exact: true }));
  });
  if (starter)
    await test.step("the same Starter student cannot reserve while the sale debt is unpaid", async () => {
      const rejection = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/reservation_create_v1"),
      );
      const panel = await bookStudent();
      expect(await (await rejection).json()).toMatchObject({
        ok: false,
        error: { code: "DEBT_BOOKING_BLOCKED" },
      });
      await expect(panel.getByText(common.sessionDetail.bookingStates.rejected)).toBeVisible();
      expect(f.reservation).toBeUndefined();
      expect(f.rights()[0]).toMatchObject({ available: 8, reserved: 0, consumed: 0 });
      await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    });
  await test.step("collect the exact sale debt and read its cash movement", async () => {
    await page.goto(`${base}/finance`);
    await activate(page.getByRole("button", { name: "Üye bazlı finans", exact: true }));
    await page.getByLabel("Üye", { exact: true }).selectOption(I.self);
    await page.getByLabel("Para birimi", { exact: true }).fill("TRY");
    await activate(page.getByRole("button", { name: "Finansı getir", exact: true }));
    await activate(page.getByRole("button", { name: "Tahsilat al", exact: true }));
    const panel = page.getByRole("dialog");
    await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("100000");
    await activate(panel.getByRole("radio", { name: "Havale", exact: true }));
    await panel.getByLabel("İşlem referansı", { exact: true }).fill("SYNTHETIC-PRO-CHAIN");
    await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-17T11:00");
    await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
    await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
    await activate(panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }));
    await expect(
      panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
    ).toBeVisible();
    expect(f.cash).toMatchObject({
      id: C.cash,
      amount_minor: "100000",
      currency: "TRY",
      occurred_at: "2026-11-17T08:00:00Z",
    });
    expect(f.debt()).toBe("0");
    await activate(panel.getByRole("button", { name: "Kapat", exact: true }));
  });
  await test.step("reserve the same sale, mark the student and close with the assigned instructor", async () => {
    let panel = await bookStudent();
    await expect(
      panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(f.rights()[0]).toMatchObject({
      sale_id: S.sale,
      available: 7,
      reserved: 1,
      consumed: 0,
    });
    await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    await page.clock.setFixedTime(new Date("2026-11-17T09:05:00Z"));
    await activate(page.getByRole("button", { name: "Yoklamayı başlat", exact: true }));
    panel = page.getByRole("alertdialog");
    await panel.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
    await activate(
      panel.getByRole("checkbox", { name: "Seansın şu an başladığını onaylıyorum.", exact: true }),
      "Space",
    );
    await activate(panel.getByRole("button", { name: "Yoklamayı başlat", exact: true }));
    await expect(
      panel.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
    ).toBeVisible();
    await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    await activate(page.getByRole("tab", { name: "Yoklama", exact: true }));
    const tab = page.getByRole("tabpanel", { name: "Yoklama", exact: true });
    await tab
      .getByRole("combobox", { name: `Yoklama — ${f.person.display_name}`, exact: true })
      .selectOption("attended");
    await activate(
      tab.getByRole("button", { name: `Kaydet — ${f.person.display_name}`, exact: true }),
    );
    await expect(
      tab.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
    ).toBeVisible();
    await activate(tab.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
    panel = page.getByRole("alertdialog");
    await activate(
      panel.getByRole("checkbox", { name: "Seans gerçekleşti", exact: true }),
      "Space",
    );
    await activate(panel.getByRole("checkbox", { name: "Örnek Eğitmen", exact: true }), "Space");
    await activate(
      panel.getByRole("checkbox", {
        name: "Yoklama sonuçlarını ve gerçekleşen eğitmenleri kontrol ettim.",
        exact: true,
      }),
      "Space",
    );
    await activate(panel.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
    await expect(
      panel.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
    ).toBeVisible();
    await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    expect(f.rights()[0]).toMatchObject({
      person_id: I.self,
      sale_id: S.sale,
      product_version_id: C.version,
      available: 7,
      reserved: 0,
      consumed: 1,
    });
  });
  if (!starter)
    await test.step("reconcile the closed session and immutable agreement in earnings", async () => {
      await page.goto(`${base}/earnings`);
      await expect(page.getByText("₺175,00", { exact: true }).first()).toBeVisible();
      await activate(page.getByRole("tab", { name: "Satırlar", exact: true }));
      await expect(page.getByText("Sentetik seans", { exact: true })).toBeVisible();
      await expect(page.getByText("Ders anlaşması · Anlaşma v2", { exact: true })).toBeVisible();
      expect(f.earning()).toMatchObject({
        agreement_id: f.studio.agreements.at(-1)!.id,
        agreement_version: 2,
        earning: {
          person_id: I.instructor,
          session_id: S.session,
          amount_minor: "17500",
          remaining_minor: "17500",
        },
      });
    });
  if (starter)
    await test.step("Starter forbids instructor earnings after a successful closure", async () => {
      const denied = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/instructor_finance_directory_get_v1"),
      );
      await page.goto(`${base}/earnings`);
      expect(await (await denied).json()).toMatchObject({
        ok: false,
        error: { code: "PLAN_FEATURE_UNAVAILABLE" },
      });
      expect(f.studio.agreements).toEqual([]);
      expect(f.earning()).toBeUndefined();
    });
  await test.step("reconcile the closed session and sale in reports", async () => {
    await page.goto(`${base}/reports`);
    await expect(page.getByText(`${f.product.terms.name} · TRY`, { exact: true })).toBeVisible();
    await expect(page.getByText(/1\.000,00/).first()).toBeVisible();
    await activate(page.getByRole("tab", { name: "Tahsilat ve borç", exact: true }));
    await expect(page.getByText(f.person.display_name, { exact: true })).toBeVisible();
    await expect(page.getByText(/1\.000,00/).first()).toBeVisible();
    await activate(page.getByRole("tab", { name: "Eğitmen ve adaylar", exact: true }));
    if (starter) {
      await expect(page.getByText("Örnek Eğitmen · Hakediş", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Örnek Eğitmen · Hakediş", { exact: true })).toBeVisible();
      await expect(page.getByText(/175,00/).first()).toBeVisible();
    }
    expect(f.writes.map((row) => row.op)).toEqual([
      "person_create_v1",
      "student_activate_v1",
      "program_apply_v1",
      "sale_apply_v1",
      ...(starter ? ["reservation_create_v1"] : []),
      "collection_record_v1",
      "reservation_create_v1",
      "attendance_start_v1",
      "attendance_mark_v1",
      "attendance_close_v1",
    ]);
    expect(f.debt()).toBe("0");
    expect(f.cash!.amount_minor).toBe(f.product.terms.price_minor);
    expect(
      f.reads.some(
        (row) => row.op === "report_get_v1" && row.request.report === "instructor_balances",
      ),
    ).toBe(true);
  });
}
