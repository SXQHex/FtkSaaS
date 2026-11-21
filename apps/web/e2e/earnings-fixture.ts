import { expect, type Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import type {
  DigitalAgreementView,
  InstructorFinanceEarning,
  InstructorFinancePayment,
  InstructorFinancePerson,
} from "@ftksaas/api-contracts";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const earningsIds = {
  earning: id(910),
  payment: id(911),
  created: id(912),
  correction: id(913),
};
export async function mockEarnings(
  page: Page,
  options: {
    unknown?: boolean;
    ackUnread?: boolean;
    denied?: boolean;
    paginate?: boolean;
    peoplePagination?: boolean;
    staleCorrect?: boolean;
    denyWrite?: boolean;
    agreementDocument?: () => DigitalAgreementView | "FORBIDDEN";
  } = {},
) {
  const studio = await mockStudio(page);
  const reads: Record<string, any>[] = [],
    writes: Record<string, any>[] = [],
    receipts: Record<string, any>[] = [];
  const agreementReads: string[] = [];
  const earning: InstructorFinanceEarning = {
    kind: "earning",
    display_name: "Örnek Eğitmen",
    session_name: "Tango başlangıç",
    agreement_id: I.agreement,
    agreement_version: 1,
    earning: {
      id: earningsIds.earning,
      person_id: I.instructor,
      center_id: I.center,
      session_id: I.lesson,
      event_assignment_id: null,
      amount_minor: "100000",
      currency: "TRY",
      paid_minor: "20000",
      remaining_minor: "80000",
      overpaid_minor: "0",
      previous_id: null,
      closure_id: null,
      direction: "add",
      created_at: "2026-11-10T12:00:00Z",
      version: 1,
      basis: {
        source: "lesson_agreement",
        currency: "TRY",
        quantity: 1,
        excluded_blocked: 0,
        agreement_id: I.agreement,
      },
    },
  };
  const payments: InstructorFinancePayment[] = [
    {
      kind: "payment",
      id: earningsIds.payment,
      person_id: I.instructor,
      display_name: "Örnek Eğitmen",
      root_payment_id: earningsIds.payment,
      version: 1,
      previous_id: null,
      direction: "increase",
      amount_minor: "20000",
      currency: "TRY",
      occurred_at: "2026-11-10T12:00:00Z",
      payment: { method: "cash" },
      reason: null,
    },
  ];
  const total = () => [
    {
      currency: "TRY",
      earned_minor: "100000",
      paid_minor: earning.earning.paid_minor,
      remaining_minor: earning.earning.remaining_minor,
      overpaid_minor: "0",
    },
    {
      currency: "EUR",
      earned_minor: "5000",
      paid_minor: "0",
      remaining_minor: "5000",
      overpaid_minor: "0",
    },
  ];
  const person = (): InstructorFinancePerson => ({
    kind: "instructor",
    person_id: I.instructor,
    display_name: "Örnek Eğitmen",
    totals: total(),
    agreement_ids: [I.agreement],
    current_agreement_ids: [I.agreement],
  });
  let unknown = options.unknown,
    failAfterAck = false;
  const committed = new Map<string, { id: string; operation: string }>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      deny = () =>
        route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    if (op === "instructor_agreement_get_v1" && options.agreementDocument) {
      expect(r).toMatchObject({ org_id: I.org, center_id: I.center, agreement_id: I.agreement });
      agreementReads.push(r.agreement_id);
      const agreement = options.agreementDocument();
      return agreement === "FORBIDDEN" ? deny() : send(agreement);
    }
    if (op === "instructor_agreement_accept_v1")
      throw Error("Manager must never accept an instructor's agreement");
    if (op === "instructor_account_get_v1")
      throw Error("Manager must never impersonate a self instructor");
    if (op === "instructor_finance_directory_get_v1") {
      reads.push(r);
      expect(r.org_id).toBe(I.org);
      expect(r.center_id).toBe(I.center);
      if (options.denied) return deny();
      if (failAfterAck && r.view === "payments") {
        failAfterAck = false;
        return route.abort();
      }
      const second = {
        ...person(),
        person_id: id(999),
        display_name: "İkinci eğitmen",
        agreement_ids: [],
        current_agreement_ids: [],
      };
      const instructor =
        r.person_id === second.person_id || r.page.cursor === "native-people-next"
          ? second
          : person();
      let items: unknown[] =
        r.view === "instructors"
          ? [instructor]
          : r.view === "earnings"
            ? [
                {
                  ...earning,
                  display_name:
                    r.person_id === second.person_id ? second.display_name : earning.display_name,
                  earning: {
                    ...earning.earning,
                    person_id: r.person_id ?? earning.earning.person_id,
                  },
                },
              ]
            : payments;
      if (options.paginate && r.view === "earnings" && r.page.cursor)
        items = [
          {
            ...earning,
            earning: {
              ...earning.earning,
              id: id(920),
              amount_minor: "100",
              currency: "EUR",
              remaining_minor: "100",
              basis: { ...earning.earning.basis, currency: "EUR" },
            },
            session_name: "Etkinlik hakedişi",
          },
        ];
      const next =
        options.peoplePagination && r.view === "instructors" && !r.person_id && !r.page.cursor
          ? "native-people-next"
          : options.paginate && r.view === "earnings" && !r.page.cursor
            ? "native-next"
            : null;
      return send({
        view: r.view,
        items,
        totals: total(),
        closed_session_count: r.person_id ? 3 : 7,
        next_cursor: next,
        as_of: "2026-11-17T12:00:00Z",
      });
    }
    if (
      op === "management_state_get_v1" &&
      ["instructor_payment_record_v1", "instructor_payment_correct_v1"].includes(r.operation)
    )
      return send({
        items: [
          {
            exists: true,
            entity: {
              type:
                r.operation === "instructor_payment_record_v1" ? "people" : "instructor_payments",
              id: r.selector.key.person_id ?? r.selector.key.payment_id,
            },
            current: { operation: r.operation, values: r.selector.key },
            versions: [],
            state: "active",
          },
        ],
        next_cursor: null,
      });
    if (op === "instructor_payment_record_v1" || op === "instructor_payment_correct_v1") {
      writes.push(r);
      expect(r.org_id).toBe(I.org);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("note");
      if (options.denyWrite) return deny();
      if (unknown) {
        unknown = false;
        return route.abort();
      }
      if (options.staleCorrect && op === "instructor_payment_correct_v1") {
        options.staleCorrect = false;
        const root = payments[0]!;
        root.version = 2;
        payments.push({
          ...root,
          id: id(914),
          version: 1,
          previous_id: root.id,
          direction: "decrease",
          amount_minor: "100",
          reason: "Başka işlem",
        });
        earning.earning.paid_minor = "19900";
        earning.earning.remaining_minor = "80100";
        return route.fulfill({
          json: {
            ok: false,
            error: { code: "VERSION_CONFLICT", retryable: false, trace_id: I.role },
          },
        });
      }
      let result = committed.get(r.operation_key);
      if (!result) {
        if (op === "instructor_payment_record_v1") {
          expect(r.earning_ids).toEqual([earningsIds.earning]);
          expect(r.person_id).toBe(I.instructor);
          payments.push({
            ...payments[0]!,
            id: earningsIds.created,
            root_payment_id: earningsIds.created,
            amount_minor: r.amount_minor,
            occurred_at: r.occurred_at,
            payment: r.payment,
          });
          result = { id: earningsIds.created, operation: op };
          earning.earning.paid_minor = (
            BigInt(earning.earning.paid_minor) + BigInt(r.amount_minor)
          ).toString();
        } else {
          const root = payments.find((value) => value.id === r.payment_id)!;
          expect(r.expected_version).toBe(root.version);
          root.version++;
          payments.push({
            ...root,
            id: earningsIds.correction,
            previous_id: root.id,
            version: 1,
            amount_minor: r.correction.amount_minor,
            direction: r.correction.direction,
            occurred_at: r.correction.occurred_at,
            reason: r.reason,
            payment: r.payment,
          });
          result = { id: root.id, operation: op };
          earning.earning.paid_minor = (
            BigInt(earning.earning.paid_minor) +
            (r.correction.direction === "decrease" ? -1n : 1n) * BigInt(r.correction.amount_minor)
          ).toString();
        }
        earning.earning.remaining_minor = (100000n - BigInt(earning.earning.paid_minor)).toString();
        committed.set(r.operation_key, result);
      }
      if (options.ackUnread) {
        options.ackUnread = false;
        failAfterAck = true;
      }
      return send({
        operation_id: id(930),
        primary_id: result.id,
        replayed: false,
        related: [],
        version: 1,
      });
    }
    if (
      op === "operation_status_get_v1" &&
      ["instructor_payment_record_v1", "instructor_payment_correct_v1"].includes(r.operation)
    ) {
      receipts.push(r);
      const saved = committed.get(r.key);
      return send({
        operation: r.operation,
        key: r.key,
        status: saved ? "succeeded" : "not_found",
        result_available: !!saved,
        result_reference: saved ? { type: "instructor_payments", id: saved.id } : null,
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/earnings`);
  await expect(page.getByRole("heading", { name: "Hakediş", exact: true })).toBeVisible();
  return { studio, reads, agreementReads, writes, receipts, payments, earning, committed };
}
export async function fillEarningsPayment(page: Page) {
  const row = page.getByRole("row").filter({ hasText: "Örnek Eğitmen" });
  await row.getByRole("button", { name: "Ödeme kaydet", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Para birimi", exact: true }).selectOption("TRY");
  const check = dialog.getByRole("checkbox").first();
  await check.focus();
  await check.press("Space");
  await expect(check).toBeChecked();
  await dialog.getByLabel("Tutar · TRY", { exact: true }).fill("100,00");
  await dialog.getByLabel("Tarih", { exact: true }).fill("2026-11-16T14:00");
  await dialog.getByRole("combobox", { name: "Yöntem", exact: true }).selectOption("bank_transfer");
  await dialog.getByLabel("İşlem referansı", { exact: true }).fill("E2E-TRANSFER");
  return dialog;
}
