import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "../../i18n";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import { readEarningsDirectory } from "./earnings-read";
import { earningsPresentation } from "./earnings-presentation";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const totals = [
  {
    currency: "TRY",
    earned_minor: "9007199254740993",
    paid_minor: "-1",
    remaining_minor: "9007199254740994",
    overpaid_minor: "0",
  },
];
const person = {
  kind: "instructor",
  person_id: id(4),
  display_name: "Örnek Eğitmen",
  totals,
  agreement_ids: [id(5)],
  current_agreement_ids: [id(5)],
};
const earning = {
  kind: "earning",
  earning: {
    id: id(6),
    person_id: id(9),
    center_id: scope.centerId,
    session_id: id(7),
    event_assignment_id: null,
    amount_minor: "10000",
    currency: "TRY",
    paid_minor: "0",
    remaining_minor: "10000",
    previous_id: null,
    closure_id: null,
    direction: "add",
    created_at: "2026-11-16T12:00:00.000001Z",
    version: 1,
    basis: { source: "lesson_agreement", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  },
  display_name: person.display_name,
  session_name: "Tango başlangıç",
  agreement_id: id(5),
  agreement_version: 3,
};
const payment = {
  kind: "payment",
  id: id(8),
  person_id: id(4),
  display_name: person.display_name,
  root_payment_id: id(8),
  version: 1,
  previous_id: null,
  direction: "increase",
  amount_minor: "10000",
  currency: "TRY",
  occurred_at: "2026-11-16T12:00:00Z",
  payment: null,
  reason: null,
};
const packet = (view: string, items: unknown[]) => ({
  view,
  items,
  totals,
  next_cursor: null,
  as_of: "2026-11-17T12:00:00Z",
  closed_session_count: 7,
});
beforeEach(() => vi.clearAllMocks());
it("uses the native manager reader with explicit center, optional real interval/person and native cursor", async () => {
  mock.call.mockResolvedValue(packet("instructors", [person]));
  const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
  const result = await readEarningsDirectory(scope, "instructors", {
    personId: id(4),
    interval,
    cursor: "cursor",
  });
  expect(result.totals).toEqual(totals);
  expect(result.closed_session_count).toBe(7);
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "instructor_finance_directory_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      view: "instructors",
      person_id: id(4),
      interval,
      page: { limit: 20, cursor: "cursor" },
    }),
  );
});
it("all periods omit interval; historical immutable aliases and agreement metadata are retained", async () => {
  mock.call.mockResolvedValue(packet("earnings", [earning]));
  const result = await readEarningsDirectory(scope, "earnings", { personId: id(4) });
  expect(result.items[0]).toEqual(earning);
  expect(mock.call.mock.calls[0]![1]).not.toHaveProperty("interval");
});
it("reads period counts for the returned instructors without separate person requests", async () => {
  const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
  const rows = [
    { ...person, closed_session_count: 3 },
    { ...person, person_id: id(8), closed_session_count: 0 },
  ];
  mock.call.mockResolvedValueOnce(packet("instructors", rows));
  const data = await readEarningsDirectory(scope, "instructors", {
    interval,
    includeClosedSessionCount: true,
  });
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "instructor_finance_directory_get_v1",
    expect.objectContaining({
      center_id: scope.centerId,
      interval,
      include_closed_session_count: true,
    }),
  );
  expect(
    earningsPresentation(data, "Europe/Istanbul", i18n.getFixedT("tr")).people.map(
      (row) => row.sessions,
    ),
  ).toEqual(["3", "0"]);
  for (const count of [undefined, -1, Number.MAX_SAFE_INTEGER + 1]) {
    mock.call.mockResolvedValueOnce(
      packet("instructors", [{ ...person, closed_session_count: count }]),
    );
    await expect(
      readEarningsDirectory(scope, "instructors", { interval, includeClosedSessionCount: true }),
    ).rejects.toThrow();
  }
});
it("rejects wrong view, duplicate rows/currencies, repeated cursor and unsafe counts or money", async () => {
  for (const response of [
    { ...packet("payments", [person]) },
    { ...packet("instructors", [person, person]) },
    { ...packet("instructors", [person]), totals: [...totals, ...totals] },
    { ...packet("instructors", [person]), next_cursor: "cursor" },
    { ...packet("instructors", [person]), closed_session_count: -1 },
    {
      ...packet("instructors", [
        { ...person, totals: [{ ...totals[0], earned_minor: "9223372036854775808" }] },
      ]),
    },
  ]) {
    mock.call.mockResolvedValue(response);
    await expect(
      readEarningsDirectory(scope, "instructors", { cursor: "cursor" }),
    ).rejects.toThrow();
  }
});
it("rejects foreign center, mismatched basis currency, invalid native version and half-open interval violation at microsecond precision", async () => {
  for (const change of [
    { center_id: id(99) },
    { basis: { ...earning.earning.basis, currency: "USD" } },
    { version: 0 },
    { created_at: "2026-11-16T12:00:00.000002Z" },
  ]) {
    mock.call.mockResolvedValue(
      packet("earnings", [{ ...earning, earning: { ...earning.earning, ...change } }]),
    );
    await expect(
      readEarningsDirectory(scope, "earnings", {
        interval: {
          starts_at: "2026-11-16T12:00:00.000001Z",
          ends_at: "2026-11-16T12:00:00.000002Z",
        },
      }),
    ).rejects.toThrow();
  }
  mock.call.mockResolvedValue(packet("earnings", [earning]));
  await expect(
    readEarningsDirectory(scope, "earnings", {
      interval: {
        starts_at: "2026-11-16T12:00:00.000001Z",
        ends_at: "2026-11-16T12:00:00.000002Z",
      },
    }),
  ).resolves.toBeDefined();
});
it("keeps payment roots and real corrections distinct and rejects malformed chain/reference or method", async () => {
  mock.call.mockResolvedValue(packet("payments", [payment]));
  expect((await readEarningsDirectory(scope, "payments")).items[0]).toEqual(payment);
  for (const change of [
    { root_payment_id: id(99) },
    { previous_id: id(99) },
    { payment: { method: "invented" } },
    { payment: { method: "cash", reference: 9 } },
  ]) {
    mock.call.mockResolvedValue(packet("payments", [{ ...payment, ...change }]));
    await expect(readEarningsDirectory(scope, "payments")).rejects.toThrow();
  }
});
it("does not hide native permission, cursor conflict or transport errors as empty data", async () => {
  const error = new Error("VERSION_CONFLICT");
  mock.call.mockRejectedValue(error);
  await expect(readEarningsDirectory(scope, "instructors")).rejects.toBe(error);
});
it("presents real summary currencies without page sums, integer precision loss or visitor-zone assumptions", async () => {
  mock.call.mockResolvedValue({
    ...packet("instructors", [person]),
    totals: [
      ...totals,
      {
        currency: "EUR",
        earned_minor: "100",
        paid_minor: "0",
        remaining_minor: "100",
        overpaid_minor: "0",
      },
    ],
  });
  const data = await readEarningsDirectory(scope, "instructors");
  const view = earningsPresentation(data, "Europe/Istanbul", i18n.getFixedT("tr"), { [id(4)]: 3 });
  expect(view.people[0]!.sessions).toBe("3");
  expect(view.summary.earned).toContain("90.071.992.547.409,93");
  expect(view.summary.earned).toContain("€1,00");
  expect(view.summary.paid).toContain("-₺0,01");
  expect(view.people[0]!.agreement).toContain("1 etkin anlaşma");
});
it("uses immutable session/agreement and truthful unknown payment metadata", async () => {
  mock.call.mockResolvedValue(packet("earnings", [earning]));
  const view = earningsPresentation(
    await readEarningsDirectory(scope, "earnings"),
    "Europe/Istanbul",
    i18n.getFixedT("tr"),
  );
  expect(view.lines[0]).toMatchObject({
    session: "Tango başlangıç",
    basis: "Ders anlaşması · Anlaşma v3",
    date: expect.stringContaining("15:00"),
  });
  mock.call.mockResolvedValue(packet("payments", [payment]));
  const rows = earningsPresentation(
    await readEarningsDirectory(scope, "payments"),
    "Europe/Istanbul",
    i18n.getFixedT("tr"),
  ).payments;
  expect(rows[0]).toMatchObject({ method: "Yöntem kaydedilmemiş", note: "—", canCorrect: true });
});
