import type { Page } from "@playwright/test";
import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { mockSessionDetail, sessionIds } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";

function legacyPath(session: string) {
  return `/organizasyon/${I.org}/seans/${session}`;
}

async function signIn(page: Page) {
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  const submit = page.getByRole("button", { name: "Giriş yap", exact: true });
  if (test.info().project.use.hasTouch) await submit.tap();
  else await submit.click();
}

test("calendar link opens the student's own reservation in its second center after sign-in", async ({
  page,
}) => {
  const center = "019a7b00-0000-7000-8000-000000000998";
  const { reads, reservations, writes } = await mockOwnReservations(page, {
    secondSessionCenter: center,
    signIn: false,
    projectLinkedReservation: true,
  });
  const session = reservations[1]!.session_id;
  const path = legacyPath(session);
  await page.goto(path);
  await expect(page).toHaveURL(
    (url) => url.pathname === "/login" && url.searchParams.get("next") === path,
  );
  expect(reads).toHaveLength(0);
  await signIn(page);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/member/reservations" &&
      url.searchParams.get("org") === I.org &&
      url.searchParams.get("center") === center &&
      url.searchParams.get("session") === session,
  );
  await expect(page.getByRole("heading", { name: "Rezervasyonlarım", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(1);
  const projections = reads.filter(({ operation }) => operation === "session_get_v1");
  expect(projections).toHaveLength(1);
  expect(projections[0]!.request).toMatchObject({
    org_id: I.org,
    session_id: session,
    include_center_id: true,
  });
  expect(projections[0]!.request).not.toHaveProperty("center_id");
  const reservationsRead = reads.filter((read) => read.operation === "reservation_list_v1");
  expect(reservationsRead).toHaveLength(1);
  expect(reservationsRead[0]!.request).toMatchObject({
    org_id: I.org,
    center_id: center,
    session_id: session,
    person_id: I.self,
    time_filter: "all",
    include_self_summary: true,
  });
  expect(
    reads.filter(({ operation }) => ["calendar_get_v1", "attendance_get_v1"].includes(operation)),
  ).toHaveLength(0);
  await expect(page.getByText("Bekleme listesinde değilsin.", { exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("calendar link reads the own past reservation and attendance in the same exact projection", async ({
  page,
}) => {
  const { reads, reservations, writes } = await mockOwnReservations(page, {
    signIn: false,
    projectLinkedReservation: true,
  });
  const session = reservations[2]!.session_id;
  await page.goto(legacyPath(session));
  await signIn(page);
  await expect(page.getByRole("grid", { name: "Geçmiş", exact: true })).toContainText("Geldi");
  await expect(page.getByText("Sentetik geçmiş ders", { exact: true })).toBeVisible();
  expect(reads.filter(({ operation }) => operation === "reservation_list_v1")).toHaveLength(1);
  expect(reads.filter(({ operation }) => operation === "session_get_v1")).toHaveLength(1);
  expect(reads.filter(({ operation }) => operation === "attendance_get_v1")).toHaveLength(0);
  expect(writes).toHaveLength(0);
});

test("calendar link exposes no reservation when the live member does not own the session row", async ({
  page,
}) => {
  const { reads, reservations, writes } = await mockOwnReservations(page, {
    signIn: false,
    hideLinkedReservation: true,
  });
  const session = reservations[0]!.session_id;
  await page.goto(legacyPath(session));
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(0);
  expect(reads.filter(({ operation }) => operation === "reservation_list_v1")).toHaveLength(1);
  expect(writes).toHaveLength(0);
});

test("calendar link leaves the reservation period unknown when the exact session details are denied", async ({
  page,
}) => {
  const { reservations, writes } = await mockOwnReservations(page, { signIn: false });
  await page.route("**/functions/v1/backend-v1/session_get_v1", async (route) => {
    if (route.request().postDataJSON().include_center_id === true) return route.fallback();
    await route.fulfill({
      status: 403,
      json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
    });
  });
  await page.goto(legacyPath(reservations[0]!.session_id));
  await signIn(page);
  await expect(page.getByText("Yaklaşan rezervasyonlar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("calendar link opens the live assigned instructor session after sign-in", async ({ page }) => {
  const { calendarDiscoveryReads, writes } = await mockSessionDetail(page, {
    instructor: true,
    openDetail: false,
    signIn: false,
  });
  const path = legacyPath(sessionIds.session);
  await page.goto(path);
  await expect(page).toHaveURL(
    (url) => url.pathname === "/login" && url.searchParams.get("next") === path,
  );
  expect(calendarDiscoveryReads).toHaveLength(0);
  await signIn(page);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/instructor/sessions/${sessionIds.session}` &&
      url.searchParams.get("org") === I.org &&
      url.searchParams.get("center") === I.center,
  );
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  expect(calendarDiscoveryReads).toHaveLength(1);
  expect(calendarDiscoveryReads[0]).toMatchObject({
    org_id: I.org,
    session_id: sessionIds.session,
  });
  expect(calendarDiscoveryReads[0]).not.toHaveProperty("center_id");
  expect(writes).toHaveLength(0);
});

test("calendar link does not let a management-only account enter either personal screen", async ({
  page,
}) => {
  const { reads, reservations, writes } = await mockOwnReservations(page, {
    noStudent: true,
    signIn: false,
  });
  const path = legacyPath(reservations[0]!.session_id);
  await page.goto(path);
  await signIn(page);
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true })).toBeVisible();
  expect(reads.filter(({ operation }) => operation === "session_get_v1")).toHaveLength(1);
  expect(reads.filter(({ operation }) => operation === "reservation_list_v1")).toHaveLength(0);
  expect(writes).toHaveLength(0);
});

test("calendar link survives the native MFA gate and safely displays a missing session", async ({
  page,
}) => {
  const calls = await mockNative(page, true);
  const path = legacyPath(sessionIds.session);
  const lookups: unknown[] = [];
  await page.route("**/functions/v1/backend-v1/session_get_v1", async (route) => {
    lookups.push(route.request().postDataJSON());
    await route.fulfill({
      status: 404,
      json: { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: I.role } },
    });
  });
  await page.goto(path);
  await signIn(page);
  await expect(page).toHaveURL(
    (url) => url.pathname === "/mfa" && url.searchParams.get("next") === path,
  );
  await expect(page.getByLabel("Doğrulama kodu")).toBeVisible();
  expect(lookups).toHaveLength(0);
  expect(calls.account).toBe(0);
  await page.getByLabel("Doğrulama kodu").fill("123456");
  const verify = page.getByRole("button", { name: "Doğrula", exact: true });
  if (test.info().project.use.hasTouch) await verify.tap();
  else await verify.click();
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true })).toBeVisible();
  expect(calls.verify).toBe(1);
  expect(lookups).toHaveLength(1);
  expect(lookups[0]).toMatchObject({
    org_id: I.org,
    session_id: sessionIds.session,
    include_center_id: true,
  });
});

test("calendar continuation ignores an external next before and after sign-in", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto(
    `/login?next=${encodeURIComponent(`//example.invalid${legacyPath(sessionIds.session)}`)}`,
  );
  await signIn(page);
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
});
