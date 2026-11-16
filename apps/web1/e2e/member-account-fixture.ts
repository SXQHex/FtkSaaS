import { expect, type Page } from "@playwright/test";
import type { PersonalCalendarLink } from "../src/lib/api-contracts/generated.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
export async function mockMemberAccount(
  page: Page,
  options: {
    unknownCalendar?: boolean;
    ackUnread?: boolean;
    unknownPreference?: boolean;
    denied?: boolean;
    stale?: boolean;
    serviceReady?: boolean;
  } = {},
) {
  await mockOwnReservations(page);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  const links: PersonalCalendarLink[] = [],
    writes: { operation: string; request: Record<string, unknown> }[] = [],
    reads: { operation: string; request: Record<string, unknown> }[] = [],
    results = new Map<string, unknown>();
  let unread = false,
    denied = Boolean(options.denied),
    bump = false,
    version = 3,
    emailVersion = 2,
    email = false;
  const values = {
    in_app_reminders: true,
    package_reminders_enabled: true,
    in_app_marketing: false,
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      request = route.request().postDataJSON();
    reads.push({ operation, request });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = () =>
        route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    if (operation === "member_document_contexts_get_v1")
      return denied
        ? reject()
        : send({ items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (operation === "calendar_links_get_v1") {
      expect(request.org_id).toBeUndefined();
      expect(request.center_id).toBeUndefined();
      if (denied) return reject();
      if (unread) {
        unread = false;
        return route.abort("failed");
      }
      if (options.stale && links.length && !bump) {
        links[0]!.version++;
        bump = true;
      }
      return send({
        items: links,
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
        service_ready: options.serviceReady !== false,
        supported_kinds: ["lessons", "duties"],
      });
    }
    if (operation.startsWith("calendar_link_") && operation !== "calendar_links_get_v1") {
      writes.push({ operation, request });
      const prior = results.get(request.operation_key);
      if (prior) return send(prior);
      let link: PersonalCalendarLink;
      if (operation === "calendar_link_create_v1") {
        expect(request.organization_scope).toEqual({ org_id: I.org });
        expect(request.kinds).toEqual(["lessons"]);
        link = {
          id: "019a7b00-0000-7000-8000-000000000980",
          org_id: I.org,
          kinds: ["lessons"],
          state: "active",
          version: 1,
          created_at: "2026-11-16T12:00:00Z",
        };
        links.push(link);
      } else {
        link = links.find((row) => row.id === request.link_id)!;
        expect(request.expected_version).toBe(link.version);
        link.version++;
        if (operation === "calendar_link_revoke_v1") link.state = "revoked";
      }
      const result = {
        operation_id: I.role,
        primary_id: I.account,
        replayed: false,
        related: [],
        link: { ...link },
        ...(operation !== "calendar_link_revoke_v1"
          ? {
              subscription_url: `https://calendar.example.invalid/calendar/synthetic-${link.version}.ics`,
            }
          : {}),
      };
      results.set(request.operation_key, result);
      if (options.ackUnread) unread = true;
      if (options.unknownCalendar && writes.length === 1) return route.abort("failed");
      return send(result);
    }
    if (
      ["settings_catalog_get_v1", "settings_get_v1", "settings_update_v1"].includes(operation) &&
      request.scope === "member"
    ) {
      expect(request.org_id).toBe(I.org);
      expect(request.center_id).toBeUndefined();
      if (denied) return reject();
      if (operation === "settings_catalog_get_v1")
        return send({
          scope: "member",
          catalog_version: 23,
          defaults: {},
          fields: Object.keys(values).map((key) => ({
            key,
            writable: true,
            consumer: "reminder_settings",
          })),
          notification_delivery: { transactional_in_app_required: true },
        });
      if (operation === "settings_get_v1")
        return send({
          scope: "member",
          version,
          values,
          as_of: "2026-11-16T12:00:00Z",
          overridden_fields: [],
        });
      writes.push({ operation, request });
      if (!results.has(request.operation_key)) {
        expect(request.expected_version).toBe(version);
        Object.assign(values, request.patch);
        version++;
        results.set(request.operation_key, { primary_id: I.self, versions: [], job_ids: [] });
      }
      if (options.unknownPreference && writes.length === 1) return route.abort("failed");
      return send(results.get(request.operation_key));
    }
    if (operation === "notifications_list_v1")
      return send({
        items: [],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
        reminder_email_preference: { enabled: email, version: emailVersion, available: true },
      });
    if (operation === "notification_preferences_set_v1") {
      writes.push({ operation, request });
      expect(request.channel).toBe("email");
      expect(request.purpose).toBe("reminder");
      expect(request.expected_version).toBe(emailVersion);
      email = request.enabled;
      emailVersion++;
      return send({ primary_id: I.self, versions: [], job_ids: [] });
    }
    if (operation === "operation_status_get_v1")
      return send({
        operation: request.operation,
        key: request.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "people", id: I.self },
      });
    return route.fallback();
  });
  await page
    .getByRole("navigation", { name: "Üye menüsü", exact: true })
    .getByRole("link", { name: "Hesabım", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeVisible();
  return {
    links,
    writes,
    reads,
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
export async function confirmCalendar(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name, exact: true }).click();
  return dialog;
}
