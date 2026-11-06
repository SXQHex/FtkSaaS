import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn<() => Promise<{ data: { user: { id: string } | null }; error: Error | null }>>(),
  assurance:
    vi.fn<
      () => Promise<{ data: { nextLevel: string; currentLevel: string }; error: Error | null }>
    >(),
}));
vi.mock("../src/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: { getUser: mocks.user, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
  notFound: () => {
    throw Error("notFound");
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import PersonRoute from "../src/app/organizasyon/[orgId]/merkez/[centerId]/kisi/[personId]/page";
import { personPath } from "../src/lib/person-route";
const ids = {
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
  personId: "019a2b3c-4d5e-7000-8000-000000000003",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
  mocks.assurance.mockResolvedValue({
    data: { nextLevel: "aal1", currentLevel: "aal1" },
    error: null,
  });
});
test.each(["orgId", "centerId", "personId"])(
  "invalid %s cannot enter provider/domain discovery",
  async (field) => {
    await expect(
      PersonRoute({ params: Promise.resolve({ ...ids, [field]: "invalid" }) }),
    ).rejects.toThrow("notFound");
    expect(mocks.user).not.toHaveBeenCalled();
  },
);
test("person links preserve full org/center/person target through native login and MFA", async () => {
  const next = encodeURIComponent(personPath(ids.orgId, ids.centerId, ids.personId));
  mocks.user.mockResolvedValueOnce({ data: { user: null }, error: null });
  await expect(PersonRoute({ params: Promise.resolve(ids) })).rejects.toThrow(
    `redirect:/login?next=${next}`,
  );
  mocks.assurance.mockResolvedValueOnce({
    data: { nextLevel: "aal2", currentLevel: "aal1" },
    error: null,
  });
  await expect(PersonRoute({ params: Promise.resolve(ids) })).rejects.toThrow(
    `redirect:/mfa?next=${next}`,
  );
});
test("authorized person route keeps native user separate from domain account and scoped target", async () => {
  const page = await PersonRoute({ params: Promise.resolve(ids) });
  expect(page.props).toEqual({ ...ids, authUserId: "native-user" });
});
