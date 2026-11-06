import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "./render";
import { SaleDocumentsPage } from "../src/components/documents/sale-documents-page";
const mocks = vi.hoisted(() => ({
  account: vi.fn<typeof import("../src/lib/api").getAccount>(),
  replace: vi.fn<(path: string) => void>(),
  refresh: vi.fn<() => void>(),
  unsubscribe: vi.fn<() => void>(),
  listener: null as null | ((event: string, session?: { user: { id: string } } | null) => void),
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getAccount: mocks.account,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      onAuthStateChange: (listener: NonNullable<typeof mocks.listener>) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));
vi.mock("../src/components/documents/self-documents", () => ({
  SelfDocuments: ({ scope, context }: { scope: object; context: object }) => (
    <output aria-label="Self scope">{JSON.stringify({ scope, context })}</output>
  ),
}));
const props = {
  authUserId: "native-user",
  orgId: "org",
  centerId: "center",
  productVersionId: "version",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ id: "core-account", state: "active", display_name: "Test" });
});
test("sale link uses the native account reader and only self product context", async () => {
  render(<SaleDocumentsPage {...props} />);
  expect(JSON.parse((await screen.findByLabelText("Self scope")).textContent!)).toEqual({
    scope: { actorId: "core-account", orgId: "org", centerId: "center" },
    context: {
      gate: "sale",
      subject: { type: "product_versions", id: "version" },
      product_version_id: "version",
    },
  });
});
test("account failure never falls back to Auth identity and can be retried", async () => {
  mocks.account.mockRejectedValueOnce(Error("offline"));
  const user = userEvent.setup();
  render(<SaleDocumentsPage {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kurulamadı");
  expect(screen.queryByLabelText("Self scope")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  expect(await screen.findByLabelText("Self scope")).toHaveTextContent("core-account");
});
test.each(["SIGNED_OUT", "SIGNED_IN"])(
  "%s clears an open acceptance before navigating",
  async (event) => {
    render(<SaleDocumentsPage {...props} />);
    await screen.findByLabelText("Self scope");
    act(() => mocks.listener?.(event, { user: { id: "other-user" } }));
    expect(screen.queryByLabelText("Self scope")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?next=%2Forganizasyon%2Forg%2Fpaket%2Fversion%2Fbelgeler%3Fcenter%3Dcenter",
    );
  },
);
test("late account responses cannot reopen a signed-out acceptance", async () => {
  let finish!: (value: Awaited<ReturnType<typeof mocks.account>>) => void;
  mocks.account.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<SaleDocumentsPage {...props} />);
  act(() => mocks.listener?.("SIGNED_OUT"));
  await act(async () => finish({ id: "core-account", state: "active", display_name: "Test" }));
  expect(screen.queryByLabelText("Self scope")).not.toBeInTheDocument();
});
