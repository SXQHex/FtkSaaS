import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import { readOwnDebt, readOwnPackages, readOwnFinanceCurrencies } from "./member-entitlements-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  person = id(4);
beforeEach(() => vi.clearAllMocks());
it("reads exact native self debt currencies and discards contacts and other summaries", async () => {
  const debt = {
    status: "available",
    by_currency: [
      { currency: "TRY", remaining_minor: "9007199254740993" },
      { currency: "USD", remaining_minor: "100" },
    ],
  };
  mock.call.mockResolvedValue({
    id: person,
    contacts: [{ value: "private@example.invalid" }],
    member_summary: { debt },
  });
  expect(await readOwnDebt(scope, person)).toEqual(debt);
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "person_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: person,
      include_member_summary: true,
    }),
  );
});
it("preserves no-debt versus restricted instead of turning an unread balance into zero", async () => {
  for (const debt of [
    { status: "available", by_currency: [] },
    { status: "restricted" },
    { status: "not_enabled" },
  ]) {
    mock.call.mockResolvedValue({ id: person, member_summary: { debt } });
    expect(await readOwnDebt(scope, person)).toEqual(debt);
  }
});
it("rejects a different person and malformed or repeated native currency amounts", async () => {
  for (const response of [
    { id: id(9), member_summary: { debt: { status: "restricted" } } },
    {
      id: person,
      member_summary: {
        debt: { status: "available", by_currency: [{ currency: "TRY", remaining_minor: "1.5" }] },
      },
    },
    {
      id: person,
      member_summary: {
        debt: {
          status: "available",
          by_currency: [
            { currency: "TRY", remaining_minor: "1" },
            { currency: "TRY", remaining_minor: "2" },
          ],
        },
      },
    },
  ]) {
    mock.call.mockResolvedValue(response);
    await expect(readOwnDebt(scope, person)).rejects.toThrow();
  }
});
it("keeps calendar validity dates and native counts without guessing a purchased total", async () => {
  mock.call.mockResolvedValue([
    {
      sale_id: id(8),
      person_id: person,
      kind: "credits",
      state: "active",
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      timezone: "America/New_York",
      available: 3,
      reserved: 2,
      consumed: 3,
      deficit: 0,
      quotas: [],
      deficit_scopes: [],
      account_id: id(99),
      purchase_summary: { product_name: "Satın alınan sabit sürüm", initial_credits: 8 },
    },
  ]);
  const rows = await readOwnPackages(scope, person);
  expect(rows[0]).toMatchObject({ id: id(8), counts: { available: 3, reserved: 2, consumed: 3 } });
  expect(rows[0]!.validity).toContain("1 Kas");
  expect(rows[0]!.validity).toContain("30 Kas");
  expect(rows[0]).toMatchObject({
    name: "Satın alınan sabit sürüm",
    usage: { consumed: 3, total: 8 },
  });
  expect(mock.call).toHaveBeenCalledWith(
    "entitlements_get_v1",
    expect.objectContaining({ include_purchase_summary: true }),
  );
  expect(rows[0]).not.toHaveProperty("account_id");
});

it("discovers all real finance currencies without guessing a default and rejects another subject", async () => {
  mock.call.mockResolvedValue({
    person_id: person,
    currencies: ["TRY", "USD"],
    as_of: "2026-11-17T12:00:00Z",
  });
  expect(await readOwnFinanceCurrencies(scope, person)).toEqual(["TRY", "USD"]);
  expect(mock.call.mock.calls[0]![1]).not.toHaveProperty("person_id");
  mock.call.mockResolvedValue({ person_id: person, currencies: [], as_of: "2026-11-17T12:00:00Z" });
  expect(await readOwnFinanceCurrencies(scope, person)).toEqual([]);
  for (const source of [
    { person_id: id(9), currencies: ["USD"] },
    { person_id: person, currencies: ["TRY", "TRY"] },
    { person_id: person, currencies: ["invalid"] },
  ]) {
    mock.call.mockResolvedValue({ ...source, as_of: "2026-11-17T12:00:00Z" });
    await expect(readOwnFinanceCurrencies(scope, person)).rejects.toThrow();
  }
});

it("timed purchase keeps native null initial credits and missing immutable summary is unread", async () => {
  const timed = {
    sale_id: id(8),
    person_id: person,
    kind: "timed",
    state: "active",
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    timezone: "Europe/Istanbul",
    available: 0,
    reserved: 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    purchase_summary: { product_name: "Süreli sabit sürüm", initial_credits: null },
  };
  mock.call.mockResolvedValue([timed]);
  const rows = await readOwnPackages(scope, person);
  expect(rows[0]?.name).toBe("Süreli sabit sürüm");
  expect(rows[0]).not.toHaveProperty("usage");
  mock.call.mockResolvedValue([
    { ...timed, purchase_summary: { ...timed.purchase_summary, initial_credits: 1 } },
  ]);
  await expect(readOwnPackages(scope, person)).rejects.toThrow("MEMBER_PURCHASE_UNAVAILABLE");
  mock.call.mockResolvedValue([{ ...timed, purchase_summary: undefined }]);
  await expect(readOwnPackages(scope, person)).rejects.toThrow("MEMBER_PURCHASE_UNAVAILABLE");
});
