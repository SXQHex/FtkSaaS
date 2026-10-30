import { beforeEach, expect, test, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { render } from "./render";
import { AccountWorkspace } from "../src/components/account/account-workspace";
import type { AccountView } from "@ftksaas/api-contracts";
const mocks = vi.hoisted(() => ({
  profile: vi.fn<() => Promise<{ account: AccountView; version: number }>>(),
  replace: vi.fn<(path: string) => void>(),
  refresh: vi.fn<() => void>(),
  listener: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("../src/lib/account", async (load) => ({
  ...(await load<typeof import("../src/lib/account")>()),
  accountProfile: mocks.profile,
}));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listener = null;
});
test("sign-out discards a late profile response and returns to canonical login", async () => {
  let finish!: (value: { account: AccountView; version: number }) => void;
  mocks.profile.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<AccountWorkspace authUserId="native-one" />);
  await act(async () => {
    mocks.listener?.("SIGNED_OUT", null);
    finish({
      account: { id: "account-one", state: "active", display_name: "Old private name" },
      version: 1,
    });
  });
  expect(mocks.replace).toHaveBeenCalledWith("/login?next=/account");
  expect(screen.queryByDisplayValue("Old private name")).not.toBeInTheDocument();
});
test("changing native accounts prevents the previous account's response from entering the workspace", async () => {
  let finish!: (value: { account: AccountView; version: number }) => void;
  mocks.profile.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<AccountWorkspace authUserId="native-one" />);
  await act(async () => {
    mocks.listener?.("SIGNED_IN", { user: { id: "native-two" } });
    finish({
      account: { id: "account-one", state: "active", display_name: "Old private name" },
      version: 1,
    });
  });
  expect(mocks.replace).toHaveBeenCalledWith("/login?next=/account");
  expect(screen.queryByRole("heading", { name: "Hesap profili" })).not.toBeInTheDocument();
});
