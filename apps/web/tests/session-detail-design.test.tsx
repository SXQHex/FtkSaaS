import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SessionDetail } from "../src/components/calendar/session-detail";
import { sampleSession } from "../src/components/admin/session-change-fixtures";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { useState } from "react";

const mocks = vi.hoisted(() => ({
  session: vi.fn<typeof import("../src/lib/api").getSession>(),
  call: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
  send: vi.fn<typeof import("../src/lib/studio-setup").sendSetupCommand>(),
  changed: vi.fn<() => void>(),
}));
vi.mock("../src/lib/api", async (load) => ({
  ...(await load<typeof import("../src/lib/api")>()),
  getSession: mocks.session,
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
}));
const entry = {
  id: sampleSession.id,
  kind: "session" as const,
  title: "Tango başlangıç",
  startsAt: sampleSession.starts_at,
  endsAt: sampleSession.ends_at,
};
const scope = { orgId: "org", centerId: "center" };

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.session.mockResolvedValue(sampleSession);
});
function detail(actorId?: string) {
  return (
    <SessionDetail
      entry={entry}
      scope={scope}
      actorId={actorId}
      timeZone="Europe/Istanbul"
      onClose={() => {}}
      onChanged={mocks.changed}
    />
  );
}

test("session actions are grouped and selecting one does not issue a mutation", async () => {
  render(detail("actor"));
  const actions = await screen.findByRole("region", { name: "Seans işlemleri" });
  const cancel = within(actions).getByRole("button", { name: "Seansı iptal et" });
  const user = userEvent.setup();
  cancel.focus();
  await user.keyboard("{Enter}");
  const context = screen.getByRole("region", { name: "İşlem yapılan seans" });
  expect(context).toHaveTextContent("29 Ekim 2030");
  expect(context).toHaveTextContent("18:00");
  expect(context).toHaveTextContent("Europe/Istanbul");
  expect(context).toHaveFocus();
  expect(screen.getByLabelText("İptal gerekçesi")).toBeVisible();
  expect(mocks.call).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("returning from cancellation refreshes detail and restores focus to the opening action", async () => {
  render(detail("actor"));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Seansı iptal et" }));
  await user.click(screen.getByRole("button", { name: "Seans detayına dön" }));
  const cancel = await screen.findByRole("button", { name: "Seansı iptal et" });
  await waitFor(() => expect(cancel).toHaveFocus());
  expect(mocks.session).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("region", { name: "İşlem yapılan seans" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("a successful cancellation refreshes state and focuses the actions heading when its button disappears", async () => {
  mocks.session
    .mockResolvedValueOnce(sampleSession)
    .mockResolvedValueOnce({ ...sampleSession, state: "cancelled" });
  mocks.call.mockResolvedValue({
    id: "019a2b3c-4d5e-7000-8000-000000000004",
    token: "synthetic",
    scope_hash: "synthetic",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  });
  mocks.send.mockResolvedValue({
    operation_id: "synthetic",
    primary_id: sampleSession.id,
    version: 2,
    replayed: false,
    related: [],
  });
  render(detail("actor"));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Seansı iptal et" }));
  await user.type(screen.getByLabelText("İptal gerekçesi"), "Salon kapalı");
  await user.click(screen.getByRole("button", { name: "İptal etkilerini önizle" }));
  await user.click(await screen.findByLabelText("Gösterilen iptal etkilerini onaylıyorum"));
  await user.click(screen.getByRole("button", { name: "Onayla ve seansı iptal et" }));
  expect(await screen.findByRole("button", { name: "Telafi seansı oluştur" })).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Seans işlemleri" })).toHaveFocus(),
  );
  expect(screen.getByText("İptal edildi", { exact: true })).toBeVisible();
  expect(mocks.changed).toHaveBeenCalledOnce();
  expect(mocks.send).toHaveBeenCalledOnce();
});

test("read-only detail exposes its direct link without management actions", async () => {
  render(detail());
  expect(await screen.findByRole("link", { name: "Seans sayfasını aç" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Seans işlemleri" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Seansı iptal et" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Seansı düzenle" })).not.toBeInTheDocument();
});

test("an actor change dismisses the previous editor and reloads the session", async () => {
  const view = render(detail("first-actor"));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Seansı iptal et" }));
  await user.type(screen.getByLabelText("İptal gerekçesi"), "Önceki hesap");
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      {detail("second-actor")}
    </NextIntlClientProvider>,
  );
  expect(await screen.findByRole("region", { name: "Seans işlemleri" })).toBeVisible();
  expect(screen.queryByLabelText("İptal gerekçesi")).not.toBeInTheDocument();
  expect(screen.queryByText("Önceki hesap")).not.toBeInTheDocument();
  expect(mocks.session).toHaveBeenCalledTimes(2);
  expect(mocks.send).not.toHaveBeenCalled();
});

test("editing a session that crosses midnight keeps the end date visible", async () => {
  mocks.session.mockResolvedValue({
    ...sampleSession,
    starts_at: "2030-10-29T19:00:00Z",
    ends_at: "2030-10-29T23:00:00Z",
  });
  render(detail("actor"));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Seansı iptal et" }));
  const context = screen.getByRole("region", { name: "İşlem yapılan seans" });
  expect(context).toHaveTextContent("29 Ekim 2030");
  expect(context).toHaveTextContent("Bitiş: 30 Ekim 2030");
});

test("Escape closes the detail sheet and restores focus to its calendar opener", async () => {
  function Calendar() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Takvimdeki seans</button>
        {open && (
          <SessionDetail
            entry={entry}
            scope={scope}
            timeZone="Europe/Istanbul"
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }
  render(<Calendar />);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Takvimdeki seans" });
  await user.click(opener);
  await screen.findByRole("link", { name: "Seans sayfasını aç" });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(opener).toHaveFocus());
});
