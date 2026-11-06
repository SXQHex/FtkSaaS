import { beforeEach, expect, test, vi } from "vitest";
import { agreementPreparations } from "../src/lib/agreement-preparations";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: unknown) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001";
const center = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: id, centerId: center };
const source = { scope: "organization" as const, key: "tango", version: 3 };
const template = {
  key: "tango",
  name: "Tango",
  discipline_id: id,
  format: "group" as const,
  terms: {
    model: "session_fixed" as const,
    currency: "TRY",
    components: [{ kind: "session_fixed" as const, amount_minor: "150050" }],
    room_fee: { kind: "free" as const, order: "before_instructor_share" as const },
  },
};
beforeEach(() => vi.resetAllMocks());
test("lists actual center catalog sources, keeping organization identity and version", async () => {
  mocks.call.mockResolvedValue({
    scope: "center",
    preparation_templates: { agreements: [{ source, template }] },
  });
  expect(await agreementPreparations.list(scope)).toEqual([{ source, template }]);
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith("settings_catalog_get_v1", {
    org_id: id,
    center_id: center,
    scope: "center",
  });
});
test("resolves a source through the read-only API with no person, dates or operation key", async () => {
  const resolved = {
    kind: "agreement",
    source,
    agreement_request: { discipline_id: id, format: "group", terms: template.terms },
  };
  mocks.call.mockResolvedValue(resolved);
  expect(await agreementPreparations.resolve(scope, source)).toEqual(resolved);
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith("settings_preparation_resolve_v1", {
    org_id: id,
    center_id: center,
    kind: "agreement",
    source,
  });
});
test("rejects foreign center sources and duplicate source identities", async () => {
  mocks.call.mockResolvedValue({
    scope: "center",
    preparation_templates: {
      agreements: [{ source: { ...source, scope: "center", center_id: id }, template }],
    },
  });
  await expect(agreementPreparations.list(scope)).rejects.toThrow("invalidAgreement");
  mocks.call.mockResolvedValue({
    scope: "center",
    preparation_templates: {
      agreements: [
        { source, template },
        { source, template },
      ],
    },
  });
  await expect(agreementPreparations.list(scope)).rejects.toThrow("invalidAgreement");
});
test("rejects a resolve response for another version or kind and invalid pay terms", async () => {
  mocks.call.mockResolvedValue({
    kind: "agreement",
    source: { ...source, version: 4 },
    agreement_request: { discipline_id: id, format: "group", terms: template.terms },
  });
  await expect(agreementPreparations.resolve(scope, source)).rejects.toThrow("invalidAgreement");
  mocks.call.mockResolvedValue({ kind: "package", source });
  await expect(agreementPreparations.resolve(scope, source)).rejects.toThrow("invalidAgreement");
  mocks.call.mockResolvedValue({
    kind: "agreement",
    source,
    agreement_request: { discipline_id: id, format: "group", terms: {} },
  });
  await expect(agreementPreparations.resolve(scope, source)).rejects.toThrow("invalidAgreement");
});
test("same-key organization and center templates remain independent sources", async () => {
  const local = { scope: "center" as const, center_id: center, key: source.key, version: 5 };
  mocks.call.mockResolvedValue({
    scope: "center",
    preparation_templates: {
      agreements: [
        { source, template },
        { source: local, template },
      ],
    },
  });
  expect(await agreementPreparations.list(scope)).toEqual([
    { source, template },
    { source: local, template },
  ]);
});
