import { beforeEach, expect, test, vi } from "vitest";
import { agreementApi } from "../src/lib/agreements";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002",
  scope = { actorId: id, orgId: id, centerId: other };
const row = {
  id,
  version: 7,
  person_id: id,
  center_id: other,
  discipline_id: id,
  format: "group",
  valid: { starts_at: "2027-01-01T10:00:00Z", ends_at: null },
  supersedes_id: null,
  published_at: null,
  terms: {
    model: "session_fixed",
    currency: "TRY",
    components: [{ kind: "session_fixed", amount_minor: "10000" }],
    room_fee: { kind: "free", order: "before_instructor_share" },
  },
};
beforeEach(() => vi.resetAllMocks());
test("history uses native person/center scope and server cursor without inferring a management permission", async () => {
  mocks.call.mockResolvedValue({ items: [row], next_cursor: null });
  await agreementApi.list(scope, id, "next");
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith("instructor_agreements_list_v1", {
    org_id: id,
    center_id: other,
    person_id: id,
    page: { limit: 25, sort: "created_at_asc", cursor: "next" },
  });
});
test.each([
  { person_id: other },
  { center_id: id },
  { version: 0 },
  { terms: { ...row.terms, currency: "invalid" } },
  { valid: { starts_at: "bad", ends_at: null } },
])("unreadable or cross-scope history fails closed: %j", async (changed) => {
  mocks.call.mockResolvedValue({ items: [{ ...row, ...changed }], next_cursor: null });
  await expect(agreementApi.list(scope, id)).rejects.toThrow("invalidAgreement");
});
test("duplicate ids and repeated server cursor cannot appear as valid history", async () => {
  mocks.call.mockResolvedValue({ items: [row, row], next_cursor: null });
  await expect(agreementApi.list(scope, id)).rejects.toThrow("invalidAgreement");
  mocks.call.mockResolvedValue({ items: [], next_cursor: "repeat" });
  await expect(agreementApi.list(scope, id, "repeat")).rejects.toThrow("invalidAgreement");
});
