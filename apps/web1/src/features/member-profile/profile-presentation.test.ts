import { expect, it } from "vitest";
import type { FinanceView } from "../../lib/api-contracts/generated";
import { scopedProfileDebt } from "./profile-presentation";
it("adds the full scoped native debt amounts with bigint without recalculating claims or mixing currency", () => {
  const source: FinanceView = {
    person_id: "019a7b00-0000-7000-8000-000000000006",
    currency: "TRY",
    credit_available_minor: "0",
    debts: [
      {
        id: "019a7b00-0000-7000-8000-000000000075",
        due_at: "2026-11-15T00:00:00Z",
        remaining_minor: "9007199254740993",
      },
      {
        id: "019a7b00-0000-7000-8000-000000000076",
        due_at: "2026-11-16T00:00:00Z",
        remaining_minor: "7",
      },
    ],
    movements: { items: [], next_cursor: null, as_of: "2026-11-15T13:00:00Z" },
  };
  expect(scopedProfileDebt(source)).toBe("₺90.071.992.547.410,00");
  expect(scopedProfileDebt({ ...source, debts: [] })).toBe("₺0,00");
  expect(scopedProfileDebt({ ...source, currency: "USD" })).not.toContain("₺");
  expect(source.debts[0]!.remaining_minor).toBe("9007199254740993");
});
