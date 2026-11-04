import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SessionDocuments } from "../src/components/documents/session-documents";
import { listSessionDocumentContexts, documentReadActions } from "../src/lib/document-requirements";
vi.mock("../src/lib/document-requirements", async (original) => ({
  ...(await original<typeof import("../src/lib/document-requirements")>()),
  listSessionDocumentContexts: vi.fn<typeof listSessionDocumentContexts>(),
  documentReadActions: {
    read: vi.fn<typeof documentReadActions.read>(),
    person: vi.fn<typeof documentReadActions.person>(),
    file: vi.fn<typeof documentReadActions.file>(),
  },
}));
const scope = { actorId: "actor", orgId: "org", centerId: "center" };
const reservation = {
  id: "reservation",
  session_id: "session",
  person_id: "participant",
  state: "active" as const,
  mode: "priority" as const,
  version: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSessionDocumentContexts).mockResolvedValue({
    items: [reservation],
    next_cursor: null,
    as_of: "2026-11-04T00:00:00Z",
  });
  vi.mocked(documentReadActions.read).mockResolvedValue([]);
  vi.mocked(documentReadActions.person).mockResolvedValue({
    id: "participant",
    display_name: "Deniz Örnek",
    version: 1,
    relationships: [],
    discipline_relationships: [],
  });
});
test("session reads only on request and both gates preserve the selected reservation participant", async () => {
  const user = userEvent.setup();
  render(<SessionDocuments scope={scope} sessionId="session" />);
  expect(listSessionDocumentContexts).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Rezervasyon belgelerini göster" }));
  await user.click(await screen.findByRole("button", { name: "Belge gerekliliklerini göster" }));
  await screen.findByText("Deniz Örnek");
  expect(listSessionDocumentContexts).toHaveBeenCalledWith(scope, "session", undefined);
  expect(documentReadActions.read).toHaveBeenLastCalledWith({
    org_id: "org",
    center_id: "center",
    person_id: "participant",
    context: { gate: "reservation", subject: { type: "reservations", id: "reservation" } },
  });
  await user.selectOptions(screen.getByRole("combobox"), "attendance");
  await screen.findByText("Deniz Örnek");
  expect(documentReadActions.read).toHaveBeenLastCalledWith({
    org_id: "org",
    center_id: "center",
    person_id: "participant",
    context: { gate: "attendance", subject: { type: "reservations", id: "reservation" } },
  });
  expect(screen.queryByRole("button", { name: /Kabul et|Onayla/ })).not.toBeInTheDocument();
});
test("a mismatched session cannot become an editable or readable document context", async () => {
  vi.mocked(listSessionDocumentContexts).mockResolvedValue({
    items: [{ ...reservation, session_id: "other" }],
    next_cursor: null,
    as_of: "2026-11-04T00:00:00Z",
  });
  render(<SessionDocuments scope={scope} sessionId="session" />);
  await userEvent.click(screen.getByRole("button", { name: "Rezervasyon belgelerini göster" }));
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Belge gerekliliklerini göster" }),
  ).not.toBeInTheDocument();
  expect(documentReadActions.read).not.toHaveBeenCalled();
});
