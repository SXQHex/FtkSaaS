import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "./render";
import { sampleStudents } from "../src/components/admin/student-fixtures";
import { PersonPage } from "../src/components/students/person-page";
const mocks = vi.hoisted(() => ({
  account: vi.fn<typeof import("../src/lib/api").getAccount>(),
  person: vi.fn<typeof import("../src/lib/api").getPerson>(),
  replace: vi.fn<(url: string) => void>(),
  refresh: vi.fn<() => void>(),
  unsubscribe: vi.fn<() => void>(),
  listener: null as null | ((event: string, session?: { user: { id: string } }) => void),
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/lib/api", async (load) => ({
  ...(await load<typeof import("../src/lib/api")>()),
  getAccount: mocks.account,
  getPerson: mocks.person,
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
// Render the production detail shell; optional panels remain lazy and no write permission is inferred.
const props = { authUserId: "native-user", orgId: "org", centerId: "center", personId: "person" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({
    id: "domain-account",
    display_name: "Synthetic",
    state: "active",
  });
  mocks.person.mockResolvedValue({
    ...sampleStudents[0]!,
    id: "person",
    display_name: "Synthetic Person",
    version: 7,
    relationships: [],
    discipline_relationships: [],
    contacts: [],
  });
  sessionStorage.clear();
});
test("direct person page reads only its supplied org/center/person and backend account", async () => {
  render(<PersonPage {...props} />);
  await screen.findByRole("heading", { name: "Synthetic Person" });
  expect(mocks.person).toHaveBeenCalledWith("org", "center", "person");
  expect(screen.getByRole("link", { name: "Kişilere dön" })).toHaveAttribute("href", "/#students");
});
test("focus revalidation removes old details and a revoked person read cannot restore them", async () => {
  render(<PersonPage {...props} />);
  await screen.findByRole("heading", { name: "Synthetic Person" });
  mocks.person.mockRejectedValue(new Error("FORBIDDEN"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(screen.queryByRole("heading", { name: "Synthetic Person" })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.person).toHaveBeenCalledTimes(2));
  await screen.findByRole("alert");
  expect(screen.queryByRole("heading", { name: "Synthetic Person" })).not.toBeInTheDocument();
});
test("late account read after native account switch cannot mount another person's details", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof mocks.account>>) => void;
  mocks.account.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<PersonPage {...props} />);
  act(() => mocks.listener?.("SIGNED_IN", { user: { id: "another-user" } }));
  await act(async () => resolve({ id: "old-account", display_name: "Old", state: "active" }));
  expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("/login?next="));
  expect(mocks.person).not.toHaveBeenCalled();
});

test("a late former person read cannot restore details after scope revalidation denies access", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof mocks.person>>) => void;
  mocks.person
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValue(new Error("FORBIDDEN"));
  render(<PersonPage {...props} />);
  await waitFor(() => expect(mocks.person).toHaveBeenCalledOnce());
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(mocks.person).toHaveBeenCalledTimes(2));
  await act(async () =>
    resolve({
      ...sampleStudents[0]!,
      id: "person",
      display_name: "Late Secret",
      discipline_relationships: [],
    }),
  );
  expect(screen.queryByRole("heading", { name: "Late Secret" })).not.toBeInTheDocument();
});
