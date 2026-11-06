import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn<() => Promise<{ data: { user: { id: string } | null }; error: Error | null }>>(),
  assurance: vi.fn<
    () => Promise<{
      data: { nextLevel: string; currentLevel: string } | null;
      error: Error | null;
    }>
  >(),
}));
vi.mock("../src/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: { getUser: mocks.user, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import SaleDocumentsRoute from "../src/app/organizasyon/[orgId]/paket/[productVersionId]/belgeler/page";
const ids = {
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  productVersionId: "019a2b3c-4d5e-7000-8000-000000000002",
};
const center = "019a2b3c-4d5e-7000-8000-000000000003";
const destination = `/organizasyon/${ids.orgId}/paket/${ids.productVersionId}/belgeler?center=${center}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.assurance.mockResolvedValue({
    data: { nextLevel: "aal1", currentLevel: "aal1" },
    error: null,
  });
});
test.each(["orgId", "productVersionId"] as const)(
  "invalid %s fails before any provider or domain read",
  async (field) => {
    await expect(
      SaleDocumentsRoute({
        params: Promise.resolve({ ...ids, [field]: "invalid" }),
        searchParams: Promise.resolve({ center }),
      }),
    ).rejects.toThrow("notFound");
    expect(mocks.user).not.toHaveBeenCalled();
  },
);
test("anonymous sale document link preserves its destination through login", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(
    SaleDocumentsRoute({ params: Promise.resolve(ids), searchParams: Promise.resolve({ center }) }),
  ).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(destination)}`);
  expect(mocks.assurance).not.toHaveBeenCalled();
});
test("required MFA cannot be bypassed by a deep link and preserves the destination", async () => {
  mocks.assurance.mockResolvedValue({
    data: { nextLevel: "aal2", currentLevel: "aal1" },
    error: null,
  });
  await expect(
    SaleDocumentsRoute({ params: Promise.resolve(ids), searchParams: Promise.resolve({ center }) }),
  ).rejects.toThrow(`redirect:/mfa?next=${encodeURIComponent(destination)}`);
  mocks.assurance.mockResolvedValue({ data: null, error: new Error("provider unavailable") });
  await expect(
    SaleDocumentsRoute({ params: Promise.resolve(ids), searchParams: Promise.resolve({ center }) }),
  ).rejects.toThrow("provider unavailable");
});
test("verified native session renders only the requested tenant and product version IDs", async () => {
  const page = await SaleDocumentsRoute({
    params: Promise.resolve(ids),
    searchParams: Promise.resolve({ center }),
  });
  expect(page.props).toEqual({ ...ids, centerId: center, authUserId: "user" });
});

test.each([
  "invalid",
  ["019a2b3c-4d5e-7000-8000-000000000003", "019a2b3c-4d5e-7000-8000-000000000004"],
])("invalid or ambiguous center context fails closed: %s", async (center) => {
  await expect(
    SaleDocumentsRoute({ params: Promise.resolve(ids), searchParams: Promise.resolve({ center }) }),
  ).rejects.toThrow("notFound");
  expect(mocks.user).not.toHaveBeenCalled();
});

test("missing center fails before authentication", async () => {
  await expect(SaleDocumentsRoute({ params: Promise.resolve(ids) })).rejects.toThrow("notFound");
  expect(mocks.user).not.toHaveBeenCalled();
});
