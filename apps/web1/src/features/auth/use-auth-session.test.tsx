import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { changed, clear, invalidate, unsubscribe, queries, router } = vi.hoisted(() => {
  const clear = vi.fn();
  const invalidate = vi.fn();
  return {
    changed: vi.fn(),
    clear,
    invalidate,
    unsubscribe: vi.fn(),
    queries: { clear },
    router: { invalidate },
  };
});
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { onAuthStateChange: changed } }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => queries }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));
import { useAuthSession } from "./use-auth-session";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("hides cached content immediately on signout until protected routes are reevaluated", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  changed.mockReturnValue({ data: { subscription: { unsubscribe } } });
  let finish!: () => void;
  invalidate.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const { result, unmount } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", { user: { id: "old-account" } }));
  await act(() => callback("SIGNED_OUT", null));
  expect(result.current).toBe(false);
  expect(clear).toHaveBeenCalledOnce();
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ sync: true }));
  await act(async () => {
    finish();
  });
  expect(result.current).toBe(true);
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
