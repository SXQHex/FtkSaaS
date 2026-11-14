import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { reviewStudioAccessibility } from "./studio-accessibility-review.js";
import { writeFile } from "node:fs/promises";
import { mockStudio, openStudio, studioIds } from "./studio-fixture.js";

async function newRoom(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Salon ekle", exact: true }).click();
  return page.getByRole("dialog");
}

test("Studio flow: unknown room result replays its key once and preserves zero capacity", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoom(page);
  await dialog
    .getByRole("textbox", { name: "Salon adı", exact: true })
    .fill("Sıfır kontenjanlı salon");
  await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill("0");
  state.nextWrite = "unknown";
  await dialog.getByRole("button", { name: "Salonu ekle", exact: true }).click();
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect((await scanAccessibility(page, "studio-room-unknown")).violations).toEqual([]);
  await retry.click();
  await expect(dialog).toHaveCount(0);
  const writes = state.writes.filter((write) => write.operation === "room_save_v1");
  expect(writes).toHaveLength(2);
  expect(writes[0]!.key).toBe(writes[1]!.key);
  expect(state.effects.filter((effect) => effect === "room_save_v1")).toHaveLength(1);
  expect(state.rooms.at(-1)).toMatchObject({ name: "Sıfır kontenjanlı salon", capacity: 0 });
  expect(writes[0]!.payload).not.toHaveProperty("expected_version");
});

test("Studio flow: acknowledged room never writes again after a failed summary read", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoom(page);
  await dialog
    .getByRole("textbox", { name: "Salon adı", exact: true })
    .fill("Okuma yeniden deneme salonu");
  await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill("12");
  state.failedReads.add("management_state_get_v1");
  await dialog.getByRole("button", { name: "Salonu ekle", exact: true }).click();
  await expect(dialog.getByText(/Değişiklik kaydedildi; güncel liste okunamadı/)).toBeVisible();
  expect(state.effects).toEqual(["room_save_v1"]);
  expect((await scanAccessibility(page, "studio-room-ack-read-failure")).violations).toEqual([]);
  state.failedReads.clear();
  await dialog.getByRole("button", { name: "Listeyi yeniden yükle", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Okuma yeniden deneme salonu", exact: true }),
  ).toBeVisible();
});

test("Studio flow: stale room version needs an explicit fresh read and new intent", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Ana salon", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = dialog.getByRole("textbox", { name: "Salon adı", exact: true });
  await expect(name).toBeEditable();
  await name.fill("Yerel taslak");
  state.rooms[0]!.version = 3;
  state.rooms[0]!.name = "Sunucudaki son ad";
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/Kayıt başka bir işlemle değişti/)).toBeVisible();
  await expect(name).toHaveValue("Yerel taslak");
  await dialog.getByRole("button", { name: "Güncel kaydı yükle", exact: true }).click();
  await expect(name).toHaveValue("Sunucudaki son ad");
  await name.fill("Son sürümle kayıt");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.map((write) => write.payload.expected_version)).toEqual([2, 3]);
  expect(new Set(state.writes.map((write) => write.key)).size).toBe(2);
  expect(state.effects).toEqual(["room_save_v1"]);
});

test("Studio flow: closure appends using the center version and inclusive local days", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await page.getByRole("tab", { name: "Kapanışlar", exact: true }).click();
  await page.getByRole("button", { name: "Kapanış ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Europe\/Istanbul merkez saat dilimine/)).toBeVisible();
  await dialog.locator('[name="target"]').selectOption(studioIds.room);
  await dialog.locator('[name="from"]').fill("2030-06-01");
  await dialog.locator('[name="to"]').fill("2030-06-02");
  await dialog.locator('[name="reason"]').selectOption({ label: "Bakım ya da tadilat" });
  await dialog.getByRole("button", { name: "Kapanışı kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.payload).toMatchObject({
    expected_version: 7,
    resource: { kind: "room", id: studioIds.room },
    interval: { starts_at: "2030-05-31T21:00:00Z", ends_at: "2030-06-02T21:00:00Z" },
  });
  expect(state.closures).toHaveLength(1);
  expect(state.effects).toEqual(["availability_exception_save_v1"]);
});

test("Studio flow: replacement terms reset approval and unknown publication never duplicates", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await page.getByRole("tab", { name: "Anlaşmalar", exact: true }).click();
  await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Tutar (en küçük para birimi)", { exact: true });
  await expect(amount).toHaveValue("12550");
  await amount.fill("25000");
  await dialog.locator("#agreement-from").fill("2030-01-01T09:00");
  await dialog.locator("#agreement-until").fill("2031-01-01T09:00");
  await dialog.locator("#agreement-reason").fill("Fixture ileri yürürlük sürümü");
  const approval = dialog.getByRole("checkbox");
  await dialog.getByText("Etkiyi okudum", { exact: true }).click();
  await expect(approval).toBeChecked();
  await amount.fill("26000");
  await expect(approval).not.toBeChecked();
  await dialog.getByText("Etkiyi okudum", { exact: true }).click();
  state.nextWrite = "unknown";
  await dialog.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }).click();
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  expect((await scanAccessibility(page, "studio-agreement-unknown")).violations).toEqual([]);
  await retry.click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.key).toBe(state.writes[1]!.key);
  expect(state.effects).toEqual(["instructor_agreement_publish_v1"]);
  expect(state.agreements).toHaveLength(2);
  expect(state.agreements[0]!.terms.components[0]!.amount_minor).toBe("12550");
  expect(state.agreements[1]).toMatchObject({
    supersedes_id: studioIds.agreement,
    version: 2,
    terms: { components: [{ kind: "session_fixed", amount_minor: "26000" }] },
  });
});

test("Studio flow: scoped setup distinguishes ready documents and missing confirmed delivery", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.setupStatus = {
    document_published: true,
    member_invitation_sent: false,
    as_of: "2026-11-14T12:00:00Z",
  };
  const setupRequests: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.endsWith("/centers_list_v1") &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON();
      if (body.include_setup_status) setupRequests.push(body);
    }
  });
  await openStudio(page);
  await expect(
    page.getByText("Yürürlükte, dosyası hazır bir belge yayını var.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bu merkezde sağlayıcı onaylı hesap daveti gönderimi yok.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62.5");
  expect(setupRequests.length).toBeGreaterThan(0);
  expect(
    setupRequests.every(
      (request) => request.org_id === studioIds.org && request.center_id === studioIds.center,
    ),
  ).toBe(true);
  expect(state.writes).toEqual([]);
});

test("Studio flow: a verified active assignment cannot submit a duplicate grant", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.accountLinked = true;
  state.roles[0]!.accountAccessGranted = true;
  await openStudio(page);
  await page.getByRole("button", { name: "Eğitmen ekle", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }).click();
  await dialog.getByRole("button", { name: "Kişi ara", exact: true }).click();
  await dialog.locator("#existing-instructor-person").selectOption(studioIds.instructor);
  await dialog.getByRole("button", { name: "Kuruluma devam et", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Doğrulanmış hesaba eğitmen yetkisi bağlı", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("#instructor-role-grant")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Bağlı hesaba rolü uygula", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
  state.roles[0]!.accountAccessGranted = false;
  await dialog.getByRole("button", { name: "Hesap bağını kontrol et", exact: true }).click();
  await expect(dialog.getByText("Görev etkin", { exact: true })).toBeVisible();
  await expect(dialog.locator("#instructor-role-grant")).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  const review = await reviewStudioAccessibility(page, "studio-verified-binding-grant-label");
  expect(review.violations).toEqual([]);
  await writeFile(".tmp/e12-grant-manual-review.json", JSON.stringify(review, null, 2));
  expect(state.writes).toEqual([]);
});
