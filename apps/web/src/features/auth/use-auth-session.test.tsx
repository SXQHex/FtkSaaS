import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { changed, clear, queryClear, invalidate, unsubscribe, queries, router } = vi.hoisted(() => {
  const clear = vi.fn();
  const queryClear = vi.fn();
  const invalidate = vi.fn();
  return {
    changed: vi.fn(),
    clear,
    queryClear,
    invalidate,
    unsubscribe: vi.fn(),
    queries: { clear, removeQueries: queryClear },
    router: { invalidate },
  };
});
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { onAuthStateChange: changed } }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => queries }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));
import { useAuthSession } from "./use-auth-session";

const actor = "019a7b00-0000-7000-8000-000000000101";
const otherActor = "019a7b00-0000-7000-8000-000000000102";
const firstSession = "019a7b00-0000-7000-8000-000000000103";
const secondSession = "019a7b00-0000-7000-8000-000000000104";
const thirdSession = "019a7b00-0000-7000-8000-000000000105";

function session(userId = actor, sessionId = firstSession, bearer = "original") {
  const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return { user: { id: userId }, access_token: `fixture.${payload}.${bearer}` };
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  changed.mockReturnValue({ data: { subscription: { unsubscribe } } });
  invalidate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
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

it("preserves recovery on the native same-session SIGNED_IN visibility notification", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  changed.mockReturnValue({ data: { subscription: { unsubscribe } } });
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session("recovery-account", firstSession)));
  sessionStorage.setItem("ftk-recovery-account", "recovery-account:native-session-one");
  await act(() => callback("SIGNED_IN", session("recovery-account", firstSession, "focus")));
  expect(sessionStorage.getItem("ftk-recovery-account")).toBe(
    "recovery-account:native-session-one",
  );
  expect(result.current).toBe(true);
  expect(clear).not.toHaveBeenCalled();
  sessionStorage.clear();
});

it("does not purge private Query or the recovery marker for focus, token rotation or MFA in one session", async () => {
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  sessionStorage.setItem("ftk-recovery-account", `${actor}:${firstSession}`);
  await act(() => callback("SIGNED_IN", session(actor, firstSession, "focus")));
  await act(() => callback("TOKEN_REFRESHED", session(actor, firstSession, "refreshed")));
  await act(() => callback("MFA_CHALLENGE_VERIFIED", session(actor, firstSession, "aal2")));
  await act(() => callback("USER_UPDATED", session(actor, firstSession, "updated")));
  expect(clear).not.toHaveBeenCalled();
  expect(queryClear).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(result.current).toBe(true);
  expect(sessionStorage.getItem("ftk-recovery-account")).toBe(`${actor}:${firstSession}`);
});

it("evicts all private cache on a same-user new native session and revalidates routes", async () => {
  let finish!: () => void;
  invalidate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  sessionStorage.setItem("ftk-recovery-account", `${actor}:${firstSession}`);
  await act(() => callback("SIGNED_IN", session(actor, secondSession)));
  expect(result.current).toBe(false);
  expect(queryClear).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem("ftk-recovery-account")).toBeNull();
  await waitFor(() => expect(invalidate).toHaveBeenCalledExactlyOnceWith({ sync: true }));
  await act(async () => {
    finish();
  });
  expect(result.current).toBe(true);
  await act(() => callback("TOKEN_REFRESHED", session(actor, secondSession, "new-token")));
  expect(queryClear).toHaveBeenCalledTimes(1);
});

it("keeps a verified recovery marker for PASSWORD_RECOVERY in the same native session", async () => {
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  sessionStorage.setItem("ftk-recovery-account", `${actor}:${firstSession}`);
  await act(() => callback("PASSWORD_RECOVERY", session(actor, firstSession)));
  expect(clear).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem("ftk-recovery-account")).toBe(`${actor}:${firstSession}`);
  await waitFor(() => expect(result.current).toBe(true));
});

it("purges old actor and unknown-session markers rather than trusting the same user UUID", async () => {
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  sessionStorage.setItem("ftk-recovery-account", `${actor}:${firstSession}`);
  await act(() => callback("SIGNED_IN", { user: { id: actor }, access_token: "opaque" }));
  expect(queryClear).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem("ftk-recovery-account")).toBeNull();
  await waitFor(() => expect(result.current).toBe(true));
  await act(() => callback("SIGNED_IN", session(otherActor, secondSession)));
  expect(clear).toHaveBeenCalledOnce();
  expect(queryClear).toHaveBeenCalledTimes(1);
});

it("retains identity while the observer is disabled for a public page", async () => {
  let finish!: () => void;
  invalidate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender, result } = renderHook(
    ({ enabled }: { enabled: boolean }) => useAuthSession(enabled),
    { initialProps: { enabled: true } },
  );
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  rerender({ enabled: false });
  expect(unsubscribe).toHaveBeenCalledOnce();
  rerender({ enabled: true });
  const resumed = changed.mock.calls[1][0];
  await act(() => resumed("INITIAL_SESSION", session(actor, secondSession)));
  expect(queryClear).toHaveBeenCalledOnce();
  expect(result.current).toBe(false);
  await waitFor(() => expect(invalidate).toHaveBeenCalledExactlyOnceWith({ sync: true }));
  await act(async () => {
    finish();
  });
  expect(result.current).toBe(true);
});

it("does not allow an older route response to reopen a newer session's private screen", async () => {
  let finishOld!: () => void;
  let finishCurrent!: () => void;
  invalidate
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCurrent = resolve;
        }),
    );
  const { result } = renderHook(useAuthSession);
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  await act(() => callback("SIGNED_IN", session(actor, secondSession)));
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  await act(() => callback("SIGNED_IN", session(actor, thirdSession)));
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
  expect(result.current).toBe(false);
  await act(async () => {
    finishOld();
  });
  expect(result.current).toBe(false);
  await act(async () => {
    finishCurrent();
  });
  expect(result.current).toBe(true);
  expect(queryClear).toHaveBeenCalledTimes(2);
});

it("does not reset the MutationCache during same-user reauthentication", async () => {
  const onHandoff = vi.fn();
  const { result } = renderHook(() => useAuthSession(true, onHandoff));
  const callback = changed.mock.calls[0][0];
  await act(() => callback("INITIAL_SESSION", session()));
  await act(() => callback("SIGNED_IN", session(actor, secondSession)));
  expect(queryClear).toHaveBeenCalledOnce();
  expect(clear).not.toHaveBeenCalled();
  expect(onHandoff).toHaveBeenCalledWith(true);
  await waitFor(() => expect(result.current).toBe(true));
  expect(onHandoff).toHaveBeenLastCalledWith(false);
});
