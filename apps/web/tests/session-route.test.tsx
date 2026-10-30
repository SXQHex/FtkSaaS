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
import SessionRoute from "../src/app/organizasyon/[orgId]/seans/[sessionId]/page";
const ids = {
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  sessionId: "019a2b3c-4d5e-7000-8000-000000000002",
};
const destination = `/organizasyon/${ids.orgId}/seans/${ids.sessionId}`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.assurance.mockResolvedValue({
    data: { nextLevel: "aal1", currentLevel: "aal1" },
    error: null,
  });
});
test("invalid IDs fail before any provider or domain read", async () => {
  await expect(
    SessionRoute({ params: Promise.resolve({ ...ids, sessionId: "invalid" }) }),
  ).rejects.toThrow("notFound");
  expect(mocks.user).not.toHaveBeenCalled();
});
test("anonymous session link preserves its destination through login", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(SessionRoute({ params: Promise.resolve(ids) })).rejects.toThrow(
    `redirect:/login?next=${encodeURIComponent(destination)}`,
  );
  expect(mocks.assurance).not.toHaveBeenCalled();
});
test("required MFA cannot be bypassed by a deep link and preserves the destination", async () => {
  mocks.assurance.mockResolvedValue({
    data: { nextLevel: "aal2", currentLevel: "aal1" },
    error: null,
  });
  await expect(SessionRoute({ params: Promise.resolve(ids) })).rejects.toThrow(
    `redirect:/mfa?next=${encodeURIComponent(destination)}`,
  );
  mocks.assurance.mockResolvedValue({ data: null, error: new Error("provider unavailable") });
  await expect(SessionRoute({ params: Promise.resolve(ids) })).rejects.toThrow(
    "provider unavailable",
  );
});
test("verified native session renders only the requested tenant and session IDs", async () => {
  const page = await SessionRoute({ params: Promise.resolve(ids) });
  expect(page.props).toEqual({ ...ids, actorId: "user" });
});
