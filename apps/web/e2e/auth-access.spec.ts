import { activate, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page, Route } from "@playwright/test";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { ManagementStatePage, ManagementStateView } from "@ftksaas/api-contracts";

const invitationId = "019a7b00-0000-7000-8000-000000000021";
const linkId = "019a7b00-0000-7000-8000-000000000022";
const jobId = "019a7b00-0000-7000-8000-000000000023";
const instant = "2026-12-01T12:00:00Z";
async function mockAccess(page: Page) {
  const studio = await mockStudio(page);
  const state = {
    revoked: false,
    linked: true,
    invitationVersion: 2,
    linkVersion: 4,
    lostCancelReply: false,
    failAccounts: false,
    failInvitations: false,
    jobReads: 0,
    invitationLabel: "Fixture Invite",
    studioPeople: studio.people,
    writes: [] as { operation: string; payload: Record<string, unknown> }[],
    reads: [] as { operation: string; key: Record<string, unknown>; cursor?: string }[],
  };
  const send = (route: Route, data: unknown) =>
    route.fulfill({ json: { ok: true, data, trace_id: I.org } });
  const fail = (route: Route) =>
    route.fulfill({
      json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.org } },
    });
  const invitation = (): ManagementStateView => ({
    operation: "account_access_revoke_v1",
    entity: { type: "invitations", id: invitationId },
    exists: true,
    state: state.revoked ? "revoked" : "pending",
    as_of: instant,
    versions: [
      { entity: { type: "invitations", id: invitationId }, version: state.invitationVersion },
    ],
    current: {
      operation: "account_access_revoke_v1",
      values: {
        invitation_id: invitationId,
        person_id: I.instructor,
        center_id: I.center,
        actionable: !state.revoked,
      },
    },
    access_detail: {
      kind: "invitation",
      display_name: state.invitationLabel,
      created_at: instant,
      expires_at: "2027-01-01T12:00:00Z",
      can_resend: !state.linked,
      delivery: { visibility: "restricted" },
    },
  });
  const link = (directory: boolean, second = false): ManagementStateView => {
    const personId = second ? I.self : I.instructor;
    const linked = state.linked && !second;
    const entity =
      directory && !linked
        ? { type: "people" as const, id: personId }
        : { type: "account_links" as const, id: linkId };
    return {
      operation: "account_link_remove_v1",
      entity,
      exists: true,
      state: linked ? "active" : directory ? "active" : "revoked",
      as_of: instant,
      versions: [{ entity, version: directory && !linked ? 3 : state.linkVersion }],
      current: {
        operation: "account_link_remove_v1",
        values: {
          person_id: personId,
          ...(!directory || linked ? { link_id: linkId } : {}),
          actionable: linked,
        },
      },
      ...(directory
        ? {
            access_detail: {
              kind: "person_account" as const,
              person_id: personId,
              display_name: second ? "Fixture Other" : "Fixture Account Link",
              created_at: instant,
              linked,
              can_send_invitation: !linked,
            },
          }
        : {}),
    };
  };
  await page.route("**/functions/v1/backend-v1/management_state_get_v1", (route) => {
    const r = route.request().postDataJSON() as {
      operation: string;
      org_id: string;
      center_id: string;
      selector: { key: Record<string, unknown> };
      page: { cursor?: string };
    };
    if (!["account_access_revoke_v1", "account_link_remove_v1"].includes(r.operation))
      return route.fallback();
    expect(r).toMatchObject({ org_id: I.org, center_id: I.center });
    state.reads.push({ operation: r.operation, key: r.selector.key, cursor: r.page.cursor });
    const directory = r.selector.key.directory === "center";
    if (
      directory &&
      ((state.failAccounts && r.operation === "account_link_remove_v1") ||
        (state.failInvitations && r.operation === "account_access_revoke_v1"))
    )
      return fail(route);
    const row =
      r.operation === "account_access_revoke_v1"
        ? invitation()
        : link(directory, Boolean(r.page.cursor));
    let items = [row];
    if (directory) {
      const status = r.selector.key.status;
      if (
        r.operation === "account_access_revoke_v1" &&
        ((status === "open" && state.revoked) || (status === "closed" && !state.revoked))
      )
        items = [];
      if (
        r.operation === "account_link_remove_v1" &&
        ((status === "linked" && !state.linked) || (status === "unlinked" && state.linked))
      )
        items = [];
      if (
        typeof r.selector.key.query === "string" &&
        !String(row.access_detail?.display_name)
          .toLowerCase()
          .includes(r.selector.key.query.toLowerCase())
      )
        items = [];
    }
    const data: ManagementStatePage = {
      items,
      next_cursor:
        directory &&
        r.operation === "account_link_remove_v1" &&
        r.selector.key.status === "all" &&
        !r.page.cursor
          ? "synthetic-next-page"
          : null,
      as_of: instant,
      ...(directory
        ? {
            access_summary: {
              total: 20,
              filtered: items.length,
              by_state:
                r.operation === "account_access_revoke_v1"
                  ? [{ state: state.revoked ? "revoked" : "pending", count: 20 }]
                  : [
                      { state: "linked", count: state.linked ? 19 : 18 },
                      { state: "unlinked", count: state.linked ? 1 : 2 },
                    ],
            },
          }
        : {}),
    };
    return send(route, data);
  });
  await page.route("**/functions/v1/backend-v1/account_access_revoke_v1", (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.writes.push({ operation: "cancel", payload });
    expect(payload).toMatchObject({ invitation_id: invitationId, expected_version: 2 });
    if (!state.revoked) {
      state.revoked = true;
      state.invitationVersion++;
    }
    if (
      state.lostCancelReply &&
      state.writes.filter((write) => write.operation === "cancel").length === 1
    )
      return route.abort("failed");
    return send(route, {
      operation_id: I.org,
      primary_id: invitationId,
      version: state.invitationVersion,
      replayed: state.writes.length > 1,
      related: [],
    });
  });
  await page.route("**/functions/v1/backend-v1/account_link_remove_v1", (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.writes.push({ operation: "unlink", payload });
    expect(payload).toMatchObject({
      link_id: linkId,
      expected_version: 4,
      reason: "Kontrollü test",
    });
    state.linked = false;
    state.linkVersion++;
    return send(route, {
      operation_id: I.org,
      primary_id: linkId,
      version: state.linkVersion,
      replayed: false,
      related: [],
    });
  });
  await page.route("**/functions/v1/backend-v1/account_access_send_v1", (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.writes.push({ operation: "invite", payload });
    if (payload.person_id !== I.instructor) {
      expect(payload).toMatchObject({ org_id: I.org, center_id: I.center });
      expect(studio.people.map((person) => person.id)).toContain(payload.person_id);
      return send(route, { job_id: jobId });
    }
    expect(payload).toMatchObject({ person_id: I.instructor, org_id: I.org, center_id: I.center });
    return send(route, { job_id: jobId });
  });
  await page.route("**/functions/v1/backend-v1/job_status_get_v1", (route) => {
    state.jobReads++;
    return send(route, {
      id: jobId,
      state: "succeeded",
      progress_count: 1,
      total_count: 1,
      result_reference: null,
      safe_error_code: null,
      email_delivery: { state: "accepted", occurred_at: instant },
    });
  });
  return state;
}
async function openAccess(page: Page) {
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/access`);
  await expect(
    page.getByRole("heading", { name: "Davetler ve hesaplar", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("grid", { name: "Davetler", exact: true })
      .getByText("Fixture Invite", { exact: true }),
  ).toBeVisible();
}

test("Access directory: server filters/cursors, summary scope, independent permissions and mobile AA", async ({
  page,
}) => {
  const state = await mockAccess(page);
  await openAccess(page);
  await expect(page.getByRole("tab", { name: "Davetler 20", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Hesap bağlantıları 1", exact: true })).toBeVisible();
  expect((await scanAccessibility(page, "access-invitations-desktop")).violations).toEqual([]);
  await activate(page.getByRole("tab", { name: /Hesap bağlantıları/ }));
  await activate(page.getByRole("button", { name: "Sonraki", exact: true }));
  await expect(page.getByText("Fixture Other", { exact: true })).toBeVisible();
  await activate(
    page
      .getByRole("radiogroup", { name: "Hesap durumu", exact: true })
      .getByRole("radio", { name: "Bağlı", exact: true }),
  );
  await expect(page.getByText("Fixture Account Link", { exact: true })).toBeVisible();
  expect(state.reads.at(-1)?.key).toMatchObject({
    directory: "center",
    view: "people",
    status: "linked",
  });
  expect(state.reads.at(-1)?.cursor).toBeUndefined();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect((await scanAccessibility(page, "access-accounts-mobile-dark")).violations).toEqual([]);
  state.failAccounts = true;
  await page.reload();
  await expect(
    page
      .getByRole("grid", { name: "Davetler", exact: true })
      .getByText("Fixture Invite", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  await activate(page.getByRole("button", { name: /İptal et — Fixture Invite/ }));
  const dialog = page.getByRole("alertdialog");
  await activate(dialog.getByRole("button", { name: "Daveti iptal et", exact: true }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/access`);
  expect(state.writes.filter((write) => write.operation === "cancel")).toHaveLength(1);
});

test("Access actions: same-key lost-reply recovery, versioned unlink and acknowledged job reread", async ({
  page,
}) => {
  const state = await mockAccess(page);
  state.lostCancelReply = true;
  await openAccess(page);
  await activate(page.getByRole("button", { name: /İptal et — Fixture Invite/ }));
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await activate(dialog.getByRole("button", { name: "Daveti iptal et", exact: true }));
  await expect(dialog.getByRole("button", { name: /Aynı isteği/ })).toBeVisible();
  await attemptOutsideDismissal(dialog);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await activate(dialog.getByRole("button", { name: /Aynı isteği/ }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  const cancels = state.writes.filter((write) => write.operation === "cancel");
  expect(cancels).toHaveLength(2);
  expect(cancels[0]?.payload.operation_key).toBe(cancels[1]?.payload.operation_key);
  expect(state.invitationVersion).toBe(3);
  expect((await scanAccessibility(page, "access-cancel-result-dialog")).violations).toEqual([]);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("tab", { name: /Hesap bağlantıları/ }));
  await activate(page.getByRole("button", { name: /Bağlantıyı kaldır — Fixture Account Link/ }));
  await dialog.getByLabel("Gerekçe", { exact: false }).fill("Kontrollü test");
  await activate(dialog.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "unlink")).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(
    page.getByRole("button", { name: /Bağlama daveti gönder — Fixture Account Link/ }),
  );
  await activate(dialog.getByRole("button", { name: "Daveti gönder", exact: true }));
  await expect(
    dialog.getByRole("button", { name: "Güncel durumu oku", exact: true }),
  ).toBeVisible();
  const before = state.jobReads;
  await activate(dialog.getByRole("button", { name: "Güncel durumu oku", exact: true }));
  await expect.poll(() => state.jobReads).toBeGreaterThan(before);
  expect(state.writes.filter((write) => write.operation === "invite")).toHaveLength(1);
  expect(state.linked).toBe(false);
});

test("M03: an old account cursor rereads after confirmed unlink", async ({ page }) => {
  const state = await mockAccess(page);
  await openAccess(page);
  await activate(page.getByRole("tab", { name: /Hesap bağlantıları/ }));
  await activate(page.getByRole("button", { name: "Sonraki", exact: true }));
  await expect(page.getByText("Fixture Other", { exact: true })).toBeVisible();
  const cursorReads = () =>
    state.reads.filter(
      (read) =>
        read.operation === "account_link_remove_v1" && read.cursor === "synthetic-next-page",
    ).length;
  const oldCursorReads = cursorReads();
  await activate(page.getByRole("button", { name: "Önceki", exact: true }));
  await expect(page.getByText("Fixture Account Link", { exact: true })).toBeVisible();

  const firstPageReads = () =>
    state.reads.filter(
      (read) =>
        read.operation === "account_link_remove_v1" &&
        read.key.directory === "center" &&
        !read.cursor,
    ).length;
  const oldFirstPageReads = firstPageReads();
  await activate(page.getByRole("button", { name: /Bağlantıyı kaldır — Fixture Account Link/ }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: false }).fill("Kontrollü test");
  await activate(dialog.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "unlink")).toHaveLength(1);
  expect(firstPageReads()).toBeGreaterThan(oldFirstPageReads);
  // Invalidation is not a network storm: the old cursor is reread only on return.
  expect(cursorReads()).toBe(oldCursorReads);

  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("button", { name: "Sonraki", exact: true }));
  await expect(page.getByText("Fixture Other", { exact: true })).toBeVisible();
  expect(cursorReads()).toBe(oldCursorReads + 1);
});

test("M03: a forbidden invitation directory never blocks authorized account readback", async ({
  page,
}) => {
  const state = await mockAccess(page);
  state.failInvitations = true;
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/access`);
  await expect(page.getByRole("heading", { name: "Davetler ve hesaplar" })).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("grid", { name: "Davetler" }).getByText("Fixture Invite", { exact: true }),
  ).toHaveCount(0);
  await activate(page.getByRole("tab", { name: /Hesap bağlantıları/ }));
  await expect(page.getByText("Fixture Account Link", { exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: /Bağlantıyı kaldır — Fixture Account Link/ }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: false }).fill("Kontrollü test");
  await activate(dialog.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "unlink")).toHaveLength(1);
  await expect(page.getByRole("alert")).toBeVisible();
});

test("M03: two forbidden post-write directories remain unread until permission returns", async ({
  page,
}) => {
  const state = await mockAccess(page);
  await openAccess(page);
  await activate(page.getByRole("button", { name: /İptal et — Fixture Invite/ }));
  const dialog = page.getByRole("alertdialog");
  state.failInvitations = true;
  state.failAccounts = true;
  await activate(dialog.getByRole("button", { name: "Daveti iptal et", exact: true }));
  await expect(
    dialog.getByText(
      "İşlem kaydedildi; güncel durum henüz okunamadı. Yazıyı tekrarlamadan yeniden oku.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "cancel")).toHaveLength(1);
  // saved-unread is also the immediate post-ACK transitional state. Finish
  // both rejected directory reads before restoring permission.
  const retry = dialog.getByRole("button", { name: "Güncel durumu oku", exact: true });
  await expect(retry).toBeEnabled();
  state.failInvitations = false;
  state.failAccounts = false;
  await activate(retry);
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "cancel")).toHaveLength(1);
});

test("M03: person entry invitation rereads the access directories after job readback", async ({
  page,
}) => {
  const state = await mockAccess(page);
  await openAccess(page);
  const invitationFirstPageReads = () =>
    state.reads.filter(
      (read) =>
        read.operation === "account_access_revoke_v1" &&
        read.key.directory === "center" &&
        !read.cursor,
    ).length;

  await activate(page.getByRole("button", { name: "Üye davet et", exact: true }));
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Ad soyad", { exact: false }).fill("Fixture Entry Invite");
  await sheet.getByLabel("E-posta", { exact: false }).fill("entry@example.invalid");
  await activate(sheet.getByRole("button", { name: "Kişiyi oluştur", exact: true }));
  await expect(sheet.getByText("Kişi kaydedildi. Davet için ayrıca onay ver.")).toBeVisible();
  const afterCreate = invitationFirstPageReads();
  await activate(sheet.getByRole("button", { name: "Daveti gönder", exact: true }));
  await expect.poll(() => state.jobReads).toBe(1);
  await expect.poll(invitationFirstPageReads).toBeGreaterThan(afterCreate);
  const created = state.studioPeople.find(
    (person) => person.display_name === "Fixture Entry Invite",
  );
  expect(created).toBeDefined();
  const invitations = state.writes.filter((write) => write.operation === "invite");
  expect(invitations).toHaveLength(1);
  expect(invitations[0]?.payload.person_id).toBe(created?.id);
});

test("M03: entry invitation readback failure preserves one write and supports recovery", async ({
  page,
}) => {
  const state = await mockAccess(page);
  await openAccess(page);
  await activate(page.getByRole("button", { name: "Üye davet et", exact: true }));
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Ad soyad", { exact: false }).fill("Fixture Entry Recovery");
  await sheet.getByLabel("E-posta", { exact: false }).fill("recovery@example.invalid");
  await activate(sheet.getByRole("button", { name: "Kişiyi oluştur", exact: true }));
  await expect(sheet.getByText("Kişi kaydedildi. Davet için ayrıca onay ver.")).toBeVisible();

  // The person-created notice appears before the required access directory
  // readback completes. Inject failures only after the invitation is actionable.
  const send = sheet.getByRole("button", { name: "Daveti gönder", exact: true });
  await expect(send).toBeEnabled();
  state.failInvitations = true;
  state.failAccounts = true;
  await activate(send);
  await expect(
    sheet.getByText("Davet işi oluşturuldu; güncel durum okunamadı.", { exact: false }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.operation === "invite")).toHaveLength(1);
  const retry = sheet.getByRole("button", { name: "Güncel durumu oku", exact: true });
  await expect(retry).toBeEnabled();
  state.failInvitations = false;
  state.failAccounts = false;
  await activate(retry);
  await expect.poll(() => state.jobReads).toBe(2);
  const created = state.studioPeople.find(
    (person) => person.display_name === "Fixture Entry Recovery",
  );
  expect(created).toBeDefined();
  const invitations = state.writes.filter((write) => write.operation === "invite");
  expect(invitations).toHaveLength(1);
  expect(invitations[0]?.payload.person_id).toBe(created?.id);
});

test("inviting from Members refreshes the warm access directory in the same SPA", async ({
  page,
}) => {
  const state = await mockAccess(page);
  await openAccess(page);
  await activate(page.getByRole("button", { name: "Üyeler", exact: true }));
  await expect(page.getByRole("heading", { name: "Üyeler", exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: "Üye davet et", exact: true }));
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Ad soyad", { exact: false }).fill("Fixture People Invite");
  await sheet.getByLabel("E-posta", { exact: false }).fill("people-invite@example.invalid");
  await activate(sheet.getByRole("button", { name: "Kişiyi oluştur", exact: true }));
  await expect(sheet.getByText("Kişi kaydedildi. Davet için ayrıca onay ver.")).toBeVisible();
  await activate(sheet.getByRole("button", { name: "Daveti gönder", exact: true }));
  await expect(sheet.getByRole("button", { name: "Güncel durumu oku", exact: true })).toBeEnabled();
  state.invitationLabel = "Updated Fixture Invite";
  await activate(sheet.getByRole("button", { name: "Kapat", exact: true }).first());
  await activate(page.getByRole("button", { name: "Davetler ve hesaplar", exact: true }));
  const invites = page.getByRole("grid", { name: "Davetler", exact: true });
  await expect(invites.getByText("Updated Fixture Invite", { exact: true })).toBeVisible();
  await expect(invites.getByText("Fixture Invite", { exact: true })).toHaveCount(0);
  expect(state.writes.filter((write) => write.operation === "invite")).toHaveLength(1);
});
