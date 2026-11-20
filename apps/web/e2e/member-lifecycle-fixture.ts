import { expect, type Page } from "@playwright/test";
import type {
  EntitlementView,
  ProductView,
  Preview,
  ReservationView,
  EventView,
  FinanceView,
} from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
export const lifecycleIds = {
  sale: "019a7b00-0000-7000-8000-000000000070",
  nextSale: "019a7b00-0000-7000-8000-000000000075",
  product: "019a7b00-0000-7000-8000-000000000021",
  version: "019a7b00-0000-7000-8000-000000000023",
  oldVersion: "019a7b00-0000-7000-8000-000000000022",
  reservation: "019a7b00-0000-7000-8000-000000000090",
  secondReservation: "019a7b00-0000-7000-8000-000000000092",
  session: "019a7b00-0000-7000-8000-000000000091",
  event: "019a7b00-0000-7000-8000-000000000094",
  registration: "019a7b00-0000-7000-8000-000000000095",
  debt: "019a7b00-0000-7000-8000-000000000096",
  preview: "019a7b00-0000-7000-8000-000000000097",
};
export async function mockMemberLifecycle(
  page: Page,
  options: {
    reservations?: boolean;
    paged?: boolean;
    event?: boolean;
    unknown?: boolean;
    unread?: boolean;
    denied?: boolean;
    blocked?: boolean;
    studentActive?: boolean;
    studentBlocked?: boolean;
    bindingUnread?: boolean;
  } = {},
) {
  const studio = await mockStudio(page),
    R = lifecycleIds;
  const person = studio.people[0]!;
  person.relationships.push({
    center_id: I.center,
    kind: "student",
    state: options.studentActive ? "active" : "inactive",
  });
  const product: ProductView = {
    id: R.product,
    version_id: R.version,
    terms: {
      name: "Yeni 8 ders",
      kind: "credits",
      booking_mode: "flexible",
      credits: 8,
      price_minor: "100000",
      currency: "TRY",
      freeze: { enabled: false, extends_validity: false },
      refund: { method: "credit_ratio" },
      quota: null,
      scopes: [
        {
          scope_kind: "center_all_disciplines",
          center_id: I.center,
          discipline_id: null,
          usage_targets: ["lesson", "event"],
        },
      ],
    },
  };
  const reservations: ReservationView[] = options.reservations
    ? [
        {
          id: R.reservation,
          session_id: R.session,
          person_id: I.instructor,
          state: "active",
          mode: "flexible",
          version: 2,
        },
        ...(options.paged
          ? [
              {
                id: R.secondReservation,
                session_id: R.session,
                person_id: I.instructor,
                state: "active" as const,
                mode: "flexible" as const,
                version: 2,
              },
            ]
          : []),
      ]
    : [];
  const old: EntitlementView = {
    sale_id: R.sale,
    person_id: I.instructor,
    product_version_id: R.oldVersion,
    start_date: "2026-11-15",
    end_date: "2027-03-15",
    timezone: "Europe/Istanbul",
    state: "active",
    available: 8 - reservations.length - (options.event ? 1 : 0),
    reserved: reservations.length + (options.event ? 1 : 0),
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    kind: "credits",
    booking_mode: "flexible",
    version: 2,
    account_id: I.agreement,
    sale_version: 3,
    sale_state: "active",
    freezes: [],
  };
  const rights = [old];
  const debts: FinanceView["debts"] = [
    {
      id: R.debt,
      remaining_minor: "100000",
      due_at: "2027-01-15T00:00:00Z",
      center_id: I.center,
      version: 1,
    },
  ];
  const event: EventView = {
    id: R.event,
    name: "Sentetik etkinlik",
    center_id: I.center,
    interval: { starts_at: "2027-01-20T16:00:00Z", ends_at: "2027-01-20T18:00:00Z" },
    timezone: "Europe/Istanbul",
    venue: { kind: "external", name: "Sentetik salon", timezone: "Europe/Istanbul" },
    terms: {
      fee_minor: "0",
      currency: "TRY",
      full_payment_required: false,
      allowed_product_version_ids: [R.oldVersion],
      cancellation: {
        cutoff_minutes: 0,
        before_cutoff: "release",
        no_show: "consume",
        after_cutoff: "consume",
      },
      refund: { method: "none" },
    },
    state: "published",
    capacity: { kind: "unlimited" },
    attendance_state: "open",
    assignments: [],
    discipline_ids: [I.discipline],
    version: 2,
    registrations: options.event
      ? [
          {
            id: R.registration,
            person_id: I.instructor,
            display_name: person.display_name,
            state: "active",
            attendance_result: "unmarked",
            version: 2,
          },
        ]
      : [],
  };
  const writes: { operation: string; request: Record<string, unknown> }[] = [],
    previews: { operation: string; request: Record<string, unknown> }[] = [],
    inventoryReads: Record<string, unknown>[] = [];
  const receipt = new Map<string, { operation: string; id: string; type: string }>();
  const reservationSources = new Map(reservations.map((row) => [row.id, R.sale as string]));
  let bindingUnread = options.bindingUnread;
  let unread = false,
    saved = false;
  const stamp = () => new Date().toISOString();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = (code: string) =>
        route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (operation === "person_get_v1" && req.person_id === I.instructor)
      return send({ ...person, membership_started_at: "2026-11-13T12:00:00Z" });
    if (operation === "products_list_v1")
      return send({ items: [product], next_cursor: null, as_of: stamp() });
    if (operation === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      if (options.unread && saved && !unread) {
        unread = true;
        return reject("TEMPORARY_FAILURE");
      }
      return send(rights);
    }
    if (operation === "finance_get_v1")
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "0",
        debts: debts.map((debt) => (debt.id === R.debt && saved ? { ...debt, version: 2 } : debt)),
        movements: { items: [], next_cursor: null, as_of: stamp() },
      });
    if (operation === "reservation_list_v1")
      return send({ items: reservations, next_cursor: null, as_of: stamp() });
    if (operation === "session_get_v1")
      return send({
        id: R.session,
        class_id: I.lesson,
        discipline_id: I.discipline,
        format: "group",
        starts_at: "2027-01-20T16:00:00Z",
        ends_at: "2027-01-20T17:00:00Z",
        state: "planned",
        attendance_state: "open",
        assignments: [],
        version: 3,
        capacity: {
          total: 12,
          held: reservations.filter((row) => row.state === "active").length,
          remaining: 10,
          category_held: null,
          category_remaining: null,
          room_capacity: 20,
        },
      });
    if (operation === "attendance_get_v1") return reject("FORBIDDEN");
    if (operation === "event_get_v1") {
      expect(req.event_id).toBe(R.event);
      return send(event);
    }
    if (operation === "management_state_get_v1" && req.operation === "sale_change_preview_v1") {
      inventoryReads.push(req);
      const target = rights.find((row) => row.sale_id === req.selector.key.sale_id);
      if (!target || target.sale_state !== "active") return reject("NOT_FOUND");
      const saleId = target.sale_id;
      const hideBindings = saleId === R.nextSale && bindingUnread;
      if (hideBindings) bindingUnread = false;
      const records = [
        ...reservations
          .filter(
            (row) =>
              !hideBindings && row.state === "active" && reservationSources.get(row.id) === saleId,
          )
          .map((row) => ({
            entity: { type: "reservations" as const, id: row.id },
            state: row.state,
            version: row.version,
            parent: { type: "sessions", id: R.session },
            person_id: row.person_id,
          })),
        ...(saleId === R.sale
          ? (event.registrations
              ?.filter((row) => row.state === "active")
              .map((row) => ({
                entity: { type: "event_registrations", id: row.id },
                state: row.state,
                version: row.version,
                parent: { type: "events", id: R.event },
                person_id: row.person_id,
              })) ?? [])
          : []),
      ];
      const visible = options.paged
        ? records.slice(req.page?.cursor ? 1 : 0, req.page?.cursor ? records.length : 1)
        : records;
      return send({
        items: visible.map((row) => ({
          operation: req.operation,
          entity: row.entity,
          exists: true,
          state: row.state,
          current: { operation: req.operation, values: { sale_id: saleId } },
          versions: [
            { entity: { type: "sales", id: saleId }, version: target.sale_version },
            { entity: row.entity, version: row.version },
            { entity: row.parent, version: 3 },
          ],
          as_of: stamp(),
          sale_change_record: {
            person_id: row.person_id,
            center_id: I.center,
            parent: row.parent,
            starts_at: "2027-01-20T16:00:00Z",
          },
        })),
        next_cursor:
          options.paged && records.length > 1 && !req.page?.cursor ? "native-next" : null,
        as_of: stamp(),
        sale_change_context: {
          entity: { type: "sales", id: saleId },
          version: target.sale_version,
        },
      });
    }
    if (operation === "management_state_get_v1" && req.operation === "reservation_cancel_v1") {
      const row = reservations.find((row) => row.id === req.selector.key.reservation_id);
      return send({
        items: row
          ? [
              {
                operation: req.operation,
                entity: { type: "reservations" as const, id: row.id },
                exists: true,
                state: row.state,
                versions: [
                  { entity: { type: "reservations" as const, id: row.id }, version: row.version },
                ],
                current: { operation: req.operation, values: { reservation_id: row.id } },
                as_of: stamp(),
              },
            ]
          : [],
        next_cursor: null,
        as_of: stamp(),
      });
    }
    if (
      ["sale_renew_preview_v1", "sale_change_preview_v1", "sale_terminate_preview_v1"].includes(
        operation,
      )
    ) {
      previews.push({ operation, request: req });
      if (options.denied) return reject("FORBIDDEN");
      const version = old.sale_version!;
      const preview: Preview = {
        id: R.preview,
        token: "synthetic-member-lifecycle-capability",
        scope_hash: "synthetic",
        expires_at: "2099-01-01T00:00:00Z",
        dependencies: {
          versions: [{ entity: { type: "sales", id: R.sale }, version }],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
        effects:
          operation === "sale_terminate_preview_v1"
            ? [
                { entity: { type: "sales", id: R.sale }, action: "close" },
                ...reservations.map((row) => ({
                  entity: { type: "reservations" as const, id: row.id },
                  action: "adjust" as const,
                })),
              ]
            : [
                {
                  entity: { type: "sales", id: R.sale },
                  action: "create",
                  amount_minor: "100000",
                  currency: "TRY",
                },
                ...(operation === "sale_change_preview_v1"
                  ? reservations.map((row) => ({
                      entity: { type: "reservations" as const, id: row.id },
                      action: (req.keep_reservation_ids.includes(row.id) ? "adjust" : "cancel") as
                        | "adjust"
                        | "cancel",
                    }))
                  : []),
              ],
        blockers: options.blocked
          ? [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: I.role }]
          : [],
      };
      if (operation !== "sale_terminate_preview_v1")
        preview.sale_lifecycle = {
          previous_sale_id: R.sale,
          product_version_id: R.version,
          start_date: req.start_date,
          end_date: req.end_date,
          previous_end_date: old.end_date,
          gap_days: 0,
          overlap_days: 31,
          offset_minor: "0",
          refund:
            operation === "sale_change_preview_v1"
              ? {
                  method: "credit_ratio",
                  calculated_minor: "100000",
                  debt_reduction_minor: "100000",
                  credit_added_minor: "0",
                  currency: "TRY",
                  consumed: 0,
                  unused: 8,
                  paid_days: 0,
                  debts: [{ debt_id: R.debt, reduction_minor: "100000" }],
                }
              : null,
        };
      return send(preview);
    }
    if (
      ["sale_renew_apply_v1", "sale_change_apply_v1", "sale_terminate_apply_v1"].includes(operation)
    ) {
      writes.push({ operation, request: req });
      const preview = previews.at(-1)!.request;
      expect(req.preview).toEqual({
        id: R.preview,
        token: "synthetic-member-lifecycle-capability",
      });
      const terminate = operation === "sale_terminate_apply_v1",
        renew = operation === "sale_renew_apply_v1";
      if (!renew) {
        old.sale_state = "terminated";
        old.state = "closed";
        old.sale_version!++;
        old.version!++;
        old.available = 0;
      }
      if (!terminate) {
        if (!renew) old.reserved = 0;
        for (const row of reservations)
          if (!renew) {
            row.state = (preview.cancel_reservation_ids as string[]).includes(row.id)
              ? "cancelled"
              : "active";
            row.version++;
            if (row.state === "active") reservationSources.set(row.id, R.nextSale);
          }
        rights.push({
          ...old,
          sale_id: R.nextSale,
          account_id: I.role,
          product_version_id: R.version,
          start_date: preview.start_date as string,
          end_date: preview.end_date as string,
          state: "active",
          sale_state: "active",
          sale_version: 1,
          version: 1,
          available: 8 - (renew ? 0 : reservations.filter((row) => row.state === "active").length),
          reserved: renew ? 0 : reservations.filter((row) => row.state === "active").length,
          consumed: 0,
        });
      }
      saved = true;
      const id = terminate ? R.sale : R.nextSale;
      receipt.set(req.operation_key, { operation, id, type: "sales" });
      if (options.unknown) return route.abort("failed");
      return send({
        operation_id: I.role,
        primary_id: id,
        version: terminate ? old.sale_version : 1,
        replayed: false,
        related: terminate ? [] : [{ type: "sales", id: R.sale }],
      });
    }
    if (operation === "event_registration_cancel_v1") {
      writes.push({ operation, request: req });
      expect(req).toMatchObject({ registration_id: R.registration, expected_version: 2 });
      event.registrations![0]!.state = "cancelled";
      event.registrations![0]!.version++;
      old.reserved--;
      old.available++;
      receipt.set(req.operation_key, {
        operation,
        id: R.registration,
        type: "event_registrations",
      });
      return send({
        operation_id: I.role,
        primary_id: R.registration,
        version: 3,
        replayed: false,
        related: [],
      });
    }
    if (["student_activate_v1", "student_deactivate_v1"].includes(operation)) {
      writes.push({ operation, request: req });
      expect(req.person_id).toBe(I.instructor);
      if (options.studentBlocked) return reject("OPEN_OPERATIONS_EXIST");
      person.relationships.find(
        (row) => row.center_id === I.center && row.kind === "student",
      )!.state = operation === "student_activate_v1" ? "active" : "inactive";
      receipt.set(req.operation_key, { operation, id: I.agreement, type: "center_relationships" });
      return send({
        operation_id: I.role,
        primary_id: I.agreement,
        version: 2,
        replayed: false,
        related: [],
      });
    }
    if (operation === "operation_status_get_v1") {
      const result = receipt.get(req.key);
      if (!result) return reject("NOT_FOUND");
      expect(req.operation).toBe(result.operation);
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: result.type, id: result.id },
      });
    }
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("synthetic@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await expect(page.getByRole("heading", { name: person.display_name, exact: true })).toBeVisible();
  return { writes, previews, inventoryReads, rights, debts, reservations, person, event };
}
