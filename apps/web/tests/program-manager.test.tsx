import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { ProgramManager } from "../src/components/programs/program-manager";
import { ApiFailure } from "../src/lib/api";
const mocks = vi.hoisted(() => ({
  classes: vi.fn<() => Promise<ManagementStateView[]>>(),
  catalog: vi.fn<
    () => Promise<{
      rooms: { id: string; name: string }[];
      disciplines: { id: string; name: string }[];
      instructors: { id: string; name: string }[];
    }>
  >(),
}));
vi.mock("../src/lib/program", async (load) => ({
  ...(await load<typeof import("../src/lib/program")>()),
  getClasses: mocks.classes,
  getProgramCatalog: mocks.catalog,
}));
const scope = { actorId: "actor", orgId: "org", centerId: "center" };
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.catalog.mockResolvedValue({ rooms: [], disciplines: [], instructors: [] });
});
test("changing the center hides the previous center's classes before the new read completes", async () => {
  mocks.classes.mockResolvedValueOnce([
    {
      operation: "class_save_v1",
      exists: true,
      state: "active",
      entity: { type: "classes", id: "class" },
      versions: [{ entity: { type: "classes", id: "class" }, version: 1 }],
      as_of: "2030-01-01T00:00:00Z",
      current: {
        operation: "class_save_v1",
        values: { name: "Previous class", discipline_id: "discipline", external_open: false },
      },
    },
  ]);
  mocks.classes.mockImplementationOnce(() => new Promise(() => {}));
  function ChangingScope() {
    const [centerId, setCenterId] = useState(scope.centerId);
    return (
      <>
        <button onClick={() => setCenterId("other")}>Merkez değiştir</button>
        <ProgramManager
          scope={{ ...scope, centerId }}
          timeZone="Europe/Istanbul"
          onChanged={() => {}}
        />
      </>
    );
  }
  render(<ChangingScope />);
  await screen.findByRole("heading", { name: "Previous class" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Merkez değiştir" }));
  expect(screen.queryByRole("heading", { name: "Previous class" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
});
test("forbidden catalog reads show an error without opening a creation form", async () => {
  mocks.classes.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: "test" } }),
  );
  render(<ProgramManager scope={scope} timeZone="Europe/Istanbul" onChanged={() => {}} />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Sınıf adı")).not.toBeInTheDocument();
});
