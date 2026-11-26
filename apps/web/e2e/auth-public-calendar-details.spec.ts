import type { Page } from "@playwright/test";
import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import {
  preparePublicCalendar as prepare,
  publicCalendarId as id,
  publicDisciplineId,
  otherDisciplineId,
  publicForm,
  mockPublicCalendar,
} from "./public-calendar-fixture.js";
async function openCalendar(page: Page) {
  await page.goto(`/public/test-studio/calendar?center_id=${id}`);
  await expect(page.locator("main h1")).toBeVisible();
}
test("native discipline filter starts a new cursor chain and preserves the UTC interval", async ({
  page,
}) => {
  const state = await prepare(page);
  await activate(page.getByRole("button", { name: "Daha fazla göster", exact: true }));
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Ders türü", exact: true })
    .selectOption(otherDisciplineId);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  expect(state.calls.at(-1)).toMatchObject({
    discipline_id: otherDisciplineId,
    page: { limit: 50, sort: "starts_at_asc" },
  });
  expect(state.calls.at(-1)?.page).not.toHaveProperty("cursor");
  expect(state.calls.at(-1)?.interval).toEqual(state.calls[0]!.interval);
  await page
    .getByRole("combobox", { name: "Ders türü", exact: true })
    .selectOption(publicDisciplineId);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toHaveCount(0);
});
test("published event occupancy and instructors remain independent from private lesson fields", async ({
  page,
}) => {
  const state = await mockPublicCalendar(page);
  const lesson = state.packet.items[0]!;
  state.packet.items = [
    { ...lesson, occupancy: null, instructors: null },
    {
      ...lesson,
      publication_id: "019ab7b0-0000-7000-8000-000000000003",
      kind: "event",
      title: "Açık atölye",
      occupancy: { registered: 7, capacity: null },
      instructors: ["Yayımlanan eğitmen"],
      timezone: "UTC",
    },
  ];
  state.packet.next_cursor = null;
  await openCalendar(page);
  await expect(
    page.getByRole("heading", { name: "Etkinlikler ve atölyeler", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("7 kayıtlı · kapasite sınırsız", { exact: true })).toBeVisible();
  await expect(page.getByText(/Yayımlanan eğitmen/)).toBeVisible();
  await expect(
    page.getByText(
      "Her kayıt kendi yayın saat diliminde gösterilir; saat dilimi kaydın yanında belirtilir.",
      { exact: true },
    ),
  ).toBeVisible();
  const hidden = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Tango programı", exact: true }) });
  await expect(hidden.getByText(/kayıtlı/)).toHaveCount(0);
  await expect(hidden.getByText(/Yayımlanan eğitmen/)).toHaveCount(0);
  expect(state.calls).toHaveLength(1);
});
test("an open bound form alone supplies public application links while preserving center scope", async ({
  page,
}) => {
  const state = await mockPublicCalendar(page);
  state.packet.application = { state: "open", form: structuredClone(publicForm) };
  await openCalendar(page);
  const href = `/public/test-studio/apply?center_id=${id}`;
  await expect(page.getByRole("link", { name: "Başvur", exact: true }).first()).toHaveAttribute(
    "href",
    href,
  );
  await expect(
    page.getByRole("link", { name: "Tango programı için başvur", exact: true }),
  ).toHaveAttribute("href", href);
  expect(state.calls.at(-1)).toMatchObject({
    slug: "test-studio",
    center_id: id,
    include_details: true,
  });
});
test("an unavailable application source never exposes a guessed target or claims a closed publication", async ({
  page,
}) => {
  const state = await mockPublicCalendar(page);
  state.packet.application = { state: "unavailable", form: null };
  await openCalendar(page);
  await expect(page.getByText("Başvuru şu anda kullanılamıyor.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /başvur/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  await expect(page.getByText("Bu sayfa şu an yayında değil", { exact: true })).toHaveCount(0);
});
test("native unavailable publication uses the closed view while an empty available program stays available", async ({
  page,
}) => {
  const state = await mockPublicCalendar(page);
  state.packet.items = [];
  state.packet.next_cursor = null;
  state.packet.publication_state = "unavailable";
  state.packet.organization_profile = null;
  await openCalendar(page);
  await expect(
    page.getByRole("heading", { name: "Bu sayfa şu an yayında değil", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toHaveCount(0);
  expect(state.calls).toHaveLength(1);
  state.packet.publication_state = "available";
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ders programı", exact: true })).toBeVisible();
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toBeVisible();
  expect(state.calls).toHaveLength(2);
});
test("malformed consent metadata fails closed without collecting data or exposing a form link", async ({
  page,
}) => {
  const state = await mockPublicCalendar(page);
  const form = structuredClone(publicForm);
  form.consents[0]!.source_version = "stale";
  state.packet.application = { state: "open", form };
  await openCalendar(page);
  await expect(page.getByText("Program yüklenemedi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /başvur/i })).toHaveCount(0);
  expect(state.calls).toEqual([
    expect.objectContaining({ slug: "test-studio", center_id: id, include_details: true }),
  ]);
});
test("long published text and large native counts fit a dark 320px public page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  const state = await mockPublicCalendar(page);
  state.packet.items[0]!.title = "Tango".repeat(50);
  state.packet.items[0]!.public_conditions = "Koşul".repeat(100);
  state.packet.items[0]!.occupancy = { registered: 2147483647, capacity: 2147483647 };
  state.packet.next_cursor = null;
  await openCalendar(page);
  await expect(page.getByText("2147483647 / 2147483647 kayıtlı", { exact: true })).toBeVisible();
});
