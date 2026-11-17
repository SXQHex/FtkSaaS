import { expect, type Page } from "@playwright/test";
import type {
  CashSummary,
  EntitlementView,
  PersonView,
  ProductView,
  SalePreview,
  InstructorFinanceEarning,
} from "../src/lib/api-contracts/generated.js";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";

const uid = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const chainIds = {
  product: uid(801),
  version: uid(802),
  debt: uid(803),
  cash: uid(804),
  preview: uid(805),
  program: uid(806),
  earning: uid(807),
};

/** One synthetic native boundary, shared by every page; no reset between chain steps.
 * Native ledger/race guarantees are separately bound to the accepted backend CI tree.
 */
export async function mockProChain(page: Page) {
  const f = await mockSessionDetail(page);
  const { studio, session, attendance } = f;
  studio.roles[0]!.accountAccessGranted = true;
  const C = chainIds;
  const person: PersonView = {
    id: I.self,
    display_name: "Zincir öğrencisi",
    version: 1,
    contacts: [],
    relationships: [],
    discipline_relationships: [],
  };
  let created = false,
    programmed = false,
    sold = false;
  let cash: CashSummary | undefined;
  let programPreview: Record<string, unknown> | undefined;
  const writes: { op: string; request: Record<string, unknown> }[] = [];
  const reads: { op: string; request: Record<string, unknown> }[] = [];
  const product: ProductView = {
    id: C.product,
    version_id: C.version,
    terms: {
      name: "Zincir 8 ders",
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
          scope_kind: "center_discipline",
          center_id: I.center,
          discipline_id: I.discipline,
          usage_targets: ["lesson"],
        },
      ],
    },
  };
  const rights = (): EntitlementView[] =>
    sold
      ? [
          {
            sale_id: S.sale,
            person_id: I.self,
            product_version_id: C.version,
            start_date: "2026-11-01",
            end_date: "2026-11-30",
            timezone: "Europe/Istanbul",
            state: "active",
            sale_state: "active",
            sale_version: 1,
            available: f.reservation ? 7 : 8,
            reserved: f.reservation?.state === "active" ? 1 : 0,
            consumed: attendance.closure_state === "closed" ? 1 : 0,
            deficit: 0,
            quotas: [],
            deficit_scopes: [],
            booking_mode: "flexible",
            kind: "credits",
            available_at_session: f.reservation ? 7 : 8,
            version: 1,
            account_id: C.debt,
            freezes: [],
          },
        ]
      : [];
  const debt = () => (sold && !cash ? "100000" : "0");
  const agreement = () => studio.agreements.at(-1)!;
  const earning = (): InstructorFinanceEarning | undefined =>
    attendance.closure_state === "closed"
      ? {
          kind: "earning",
          display_name: "Örnek Eğitmen",
          session_name: "Sentetik seans",
          agreement_id: agreement().id,
          agreement_version: agreement().version,
          earning: {
            id: C.earning,
            person_id: I.instructor,
            center_id: I.center,
            session_id: S.session,
            event_assignment_id: null,
            amount_minor: agreement().terms.components[0]!.amount_minor!,
            currency: "TRY",
            paid_minor: "0",
            remaining_minor: agreement().terms.components[0]!.amount_minor!,
            overpaid_minor: "0",
            previous_id: null,
            closure_id: null,
            direction: "add",
            created_at: new Date().toISOString(),
            version: 1,
            basis: {
              source: "lesson_agreement",
              currency: "TRY",
              quantity: 1,
              excluded_blocked: 0,
              agreement_id: agreement().id,
            },
          },
        }
      : undefined;

  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: new Date().toISOString(),
    });
    const ack = (id: string) => send({ primary_id: id, changed: [], jobs: [] });
    if (r.org_id) expect(r.org_id).toBe(I.org);
    if (r.center_id) expect(r.center_id).toBe(I.center);
    reads.push({ op, request: r });
    if (
      [
        "person_create_v1",
        "student_activate_v1",
        "program_apply_v1",
        "sale_apply_v1",
        "collection_record_v1",
        "reservation_create_v1",
        "attendance_start_v1",
        "attendance_mark_v1",
        "attendance_close_v1",
      ].includes(op)
    ) {
      writes.push({ op, request: r });
      expect(r.operation_key).toMatch(/^[\da-f-]{36}$/);
    }
    if (op === "person_create_v1") {
      expect(created).toBe(false);
      expect(r.display_name).toBe(person.display_name);
      created = true;
      person.contacts = r.contacts;
      return send({
        operation_id: uid(810),
        primary_id: I.self,
        version: 1,
        replayed: false,
        related: [],
      });
    }
    if (op === "person_get_v1" && r.person_id === I.self) {
      expect(created).toBe(true);
      return send(person);
    }
    if (op === "people_list_v1") return send(list(created ? [person] : []));
    if (op === "student_activate_v1") {
      expect(created).toBe(true);
      expect(r.person_id).toBe(I.self);
      person.relationships = [{ center_id: I.center, kind: "student", state: "active" }];
      person.version++;
      return ack(uid(811));
    }
    if (op === "program_preview_v1") {
      expect(studio.rooms.some((room) => room.id === r.schedule.room_id && room.active)).toBe(true);
      expect(r).toMatchObject({
        class_id: I.lesson,
        schedule: {
          assignments: [{ person_id: I.instructor, duty: "instructor" }],
          capacity: { total: 12 },
        },
      });
      expect(agreement().person_id).toBe(I.instructor);
      expect(agreement().format).toBe(session.format);
      programPreview = r;
      return send({
        id: C.preview,
        token: "synthetic-chain-program",
        scope_hash: "synthetic",
        dependencies: { versions: [] },
        effects: [],
        blockers: [],
        expires_at: "2099-01-01T00:00:00Z",
        sessions: [
          {
            session_id: S.session,
            interval: { starts_at: session.starts_at, ends_at: session.ends_at },
          },
        ],
      });
    }
    if (op === "program_apply_v1") {
      expect(programPreview).toBeDefined();
      expect(programmed).toBe(false);
      expect(r.preview).toEqual({ id: C.preview, token: "synthetic-chain-program" });
      programmed = true;
      return ack(C.program);
    }
    if (op === "calendar_get_v1" && !programmed) return send(list([]));
    if (op === "products_list_v1") return send(list([product]));
    if (op === "entitlements_get_v1") {
      expect(r.person_id).toBe(I.self);
      return send(rights());
    }
    if (op === "reservation_list_v1") {
      expect(r.session_id).toBe(S.session);
      return send(
        list(
          f.reservation
            ? [
                {
                  ...f.reservation,
                  ...(r.include_source_summary
                    ? {
                        source_summary: {
                          status: "available",
                          as_of: new Date().toISOString(),
                          source_sale_id: S.sale,
                          product_version_id: C.version,
                          product_name: product.terms.name,
                          kind: "credits",
                          booking_mode: "flexible",
                          sale_state: "active",
                          state: "active",
                          start_date: "2026-11-01",
                          end_date: "2026-11-30",
                          timezone: "Europe/Istanbul",
                          available_credits: "7",
                          reserved: String(rights()[0]?.reserved ?? 0),
                          consumed: String(rights()[0]?.consumed ?? 0),
                          sale_version: 1,
                        },
                      }
                    : {}),
                },
              ]
            : [],
        ),
      );
    }
    if (op === "sale_preview_v1") {
      expect(programmed).toBe(true);
      expect(person.relationships).toContainEqual({
        center_id: I.center,
        kind: "student",
        state: "active",
      });
      expect(r).toMatchObject({
        person_id: I.self,
        product_version_id: C.version,
        start_date: "2026-11-01",
        end_date: "2026-11-30",
      });
      const preview: SalePreview = {
        id: C.preview,
        token: "synthetic-chain-sale",
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [],
        blockers: [],
        expires_at: "2099-01-01T00:00:00Z",
        sale: {
          person_id: I.self,
          product_version_id: C.version,
          kind: "credits",
          booking_mode: "flexible",
          start_date: r.start_date,
          end_date: r.end_date,
          timezone: "Europe/Istanbul",
          valid_from: "2026-10-31T21:00:00Z",
          valid_until: "2026-11-30T21:00:00Z",
          debt_minor: product.terms.price_minor,
          currency: "TRY",
          granted: 8,
          available: 8,
          reserved: 0,
          consumed: 0,
          quota: null,
          deficits: [],
        },
      };
      return send(preview);
    }
    if (op === "sale_apply_v1") {
      expect(r.preview).toEqual({ id: C.preview, token: "synthetic-chain-sale" });
      expect(sold).toBe(false);
      sold = true;
      return ack(S.sale);
    }
    if (op === "finance_get_v1") {
      expect(r).toMatchObject({ person_id: I.self, currency: "TRY" });
      return send({
        person_id: I.self,
        currency: "TRY",
        credit_available_minor: "0",
        debts: sold
          ? [
              {
                id: C.debt,
                remaining_minor: debt(),
                due_at: "2026-11-01T00:00:00Z",
                center_id: I.center,
                version: cash ? 2 : 1,
              },
            ]
          : [],
        movements: list(cash ? [cash] : []),
      });
    }
    if (op === "finance_directory_get_v1")
      return route.fulfill({
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (op === "management_state_get_v1" && r.operation === "collection_record_v1")
      return send(
        list([
          {
            operation: r.operation,
            exists: true,
            entity: { type: "people", id: I.self },
            state: "active",
            versions: [],
            current: { operation: r.operation, values: { person_id: I.self } },
          },
        ]),
      );
    if (op === "collection_record_v1") {
      expect(sold).toBe(true);
      expect(cash).toBeUndefined();
      expect(r).toMatchObject({
        person_id: I.self,
        amount_minor: product.terms.price_minor,
        currency: "TRY",
      });
      cash = {
        id: C.cash,
        kind: "collection",
        amount_minor: r.amount_minor,
        currency: "TRY",
        occurred_at: r.occurred_at,
        center_id: I.center,
        version: 1,
        previous_id: null,
        payment: r.payment,
      };
      return ack(C.cash);
    }
    if (op === "reservation_create_v1") {
      expect(sold && programmed && !!cash).toBe(true);
      expect(r).toMatchObject({ person_id: I.self, session_id: S.session, source_sale_id: S.sale });
    }
    if (op === "attendance_close_v1") {
      expect(f.reservation?.person_id).toBe(person.id);
      expect(f.reservation?.session_id).toBe(session.id);
      expect(attendance.entries[0]?.result).toBe("attended");
    }
    if (op === "instructor_finance_directory_get_v1") {
      const e = earning();
      const amount = e?.earning.amount_minor ?? "0";
      const totals = [
        {
          currency: "TRY",
          earned_minor: amount,
          paid_minor: "0",
          remaining_minor: amount,
          overpaid_minor: "0",
        },
      ];
      return send({
        view: r.view,
        items:
          r.view === "instructors"
            ? [
                {
                  kind: "instructor",
                  person_id: I.instructor,
                  display_name: "Örnek Eğitmen",
                  totals,
                  agreement_ids: [agreement().id],
                  current_agreement_ids: [agreement().id],
                },
              ]
            : r.view === "earnings" && e
              ? [e]
              : [],
        totals,
        closed_session_count: e ? 1 : 0,
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "report_get_v1") {
      const amount = earning()?.earning.amount_minor ?? "0";
      let rows: Record<string, unknown>[] = [];
      if (r.report === "sales" && sold)
        rows = [
          {
            group_key: `gross_sales:${C.version}`,
            center_id: I.center,
            product_version_id: C.version,
            product_name: product.terms.name,
            currency: "TRY",
            count: 1,
            amount_minor: product.terms.price_minor,
          },
        ];
      if (r.report === "session_metrics" && programmed)
        rows = [
          {
            group_key: "occupancy",
            center_id: I.center,
            session_id: S.session,
            session_name: "Sentetik seans",
            count: f.reservation ? 1 : 0,
            basis_count: 12,
            ratio_bps: f.reservation ? 833 : 0,
          },
          {
            group_key: "attendance_rate",
            center_id: I.center,
            session_id: S.session,
            session_name: "Sentetik seans",
            count: attendance.closure_state === "closed" ? 1 : 0,
            basis_count: 1,
            ratio_bps: attendance.closure_state === "closed" ? 10000 : 0,
          },
        ];
      if (r.report === "collection_breakdown" && cash)
        rows = [
          {
            group_key: "collections",
            center_id: I.center,
            person_id: I.self,
            display_name: person.display_name,
            currency: "TRY",
            count: 1,
            amount_minor: cash.amount_minor,
          },
        ];
      if (r.report === "instructor_balances")
        rows = [
          "earning_accrual",
          "instructor_remaining",
          "instructor_paid",
          "instructor_overpaid",
        ].map((group_key) => ({
          group_key,
          center_id: I.center,
          person_id: I.instructor,
          display_name: "Örnek Eğitmen",
          currency: "TRY",
          count: earning() ? 1 : 0,
          amount_minor: ["instructor_paid", "instructor_overpaid"].includes(group_key)
            ? "0"
            : amount,
        }));
      return send({
        report_kind: r.report,
        as_of: new Date().toISOString(),
        filters: r.filters,
        rows: list(rows),
        totals: rows.map((row) => ({
          group_key: row.group_key,
          currency: row.currency ?? null,
          count: row.count,
          amount_minor: row.amount_minor ?? null,
        })),
      });
    }
    return route.fallback();
  });
  return {
    ...f,
    person,
    product,
    writes,
    reads,
    rights,
    debt,
    earning,
    get cash() {
      return cash;
    },
    get programmed() {
      return programmed;
    },
  };
}
