import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SessionDetail } from "../src/components/calendar/session-detail";
const lifecycleWrite = vi.hoisted(() =>
  vi.fn<typeof import("../src/lib/studio-setup").sendSetupCommand>(),
);
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: lifecycleWrite,
}));
const sessionRead = vi.hoisted(() => vi.fn<typeof import("../src/lib/api").getSession>());
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getSession: sessionRead,
}));
import {
  SessionChangeFlow,
  type SessionChangeActions,
} from "../src/components/calendar/session-change";
import { sampleSession, samplePreview } from "../src/components/admin/session-change-fixtures";
const catalog = vi.hoisted(() => vi.fn<typeof import("../src/lib/program").getProgramCatalog>());
vi.mock("../src/lib/program", async (original) => ({
  ...(await original<typeof import("../src/lib/program")>()),
  getProgramCatalog: catalog,
}));
const actions = {
  preview: vi.fn<SessionChangeActions["preview"]>(),
  apply: vi.fn<SessionChangeActions["apply"]>(),
  status: vi.fn<SessionChangeActions["status"]>(),
};
const props = {
  session: sampleSession,
  orgId: "org",
  centerId: "center",
  actorId: "actor",
  timeZone: "Europe/Istanbul",
  onClose: () => {},
  onSaved: () => {},
  actions,
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionRead.mockResolvedValue(sampleSession);
  sessionStorage.clear();
  catalog.mockResolvedValue({
    rooms: [{ id: "room", name: "Yeni salon" }],
    instructors: [{ id: "new", name: "Yeni kişi" }],
    disciplines: [],
    duties: [],
  });
  actions.preview.mockImplementation(async (input) => samplePreview(input));
});
test("resource changes use live catalog IDs and preserve assistant agreements", async () => {
  const assistant = {
    person_id: "assistant",
    duty: "assistant" as const,
    agreement_id: "agreement",
  };
  render(
    <SessionChangeFlow
      {...props}
      session={{
        ...sampleSession,
        assignments: [assistant, { person_id: "old", duty: "instructor" }],
      }}
    />,
  );
  const user = userEvent.setup();
  expect(catalog).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText("Odayı değiştir"));
  await screen.findByRole("option", { name: "Yeni salon" });
  await user.selectOptions(screen.getByLabelText("Yeni oda"), "room");
  await user.click(screen.getByLabelText("Eğitmeni değiştir"));
  await user.selectOptions(screen.getByLabelText("Yeni eğitmen"), "new");
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Kaynak değişikliği");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  expect(catalog).toHaveBeenCalledWith({ actorId: "actor", orgId: "org", centerId: "center" });
  expect(actions.preview).toHaveBeenCalledWith({
    org_id: "org",
    center_id: "center",
    session_id: sampleSession.id,
    reason: "Kaynak değişikliği",
    scope: "single",
    patch: {
      resources: [{ kind: "room", id: "room" }],
      assignments: [assistant, { person_id: "new", duty: "instructor" }],
    },
  });
  expect(actions.apply).not.toHaveBeenCalled();
});
test("a denied catalog cannot produce an empty resource replacement", async () => {
  catalog.mockRejectedValue(Error("forbidden"));
  render(<SessionChangeFlow {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Odayı değiştir"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Kaynaklar okunamadı");
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Değişiklik");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  expect(actions.preview).not.toHaveBeenCalled();
});
test("future series preview sends an explicitly chosen center-timezone offset", async () => {
  render(
    <SessionChangeFlow
      {...props}
      timeZone="Europe/Berlin"
      session={{
        ...sampleSession,
        starts_at: "2030-10-20T00:30:00Z",
        ends_at: "2030-10-20T01:30:00Z",
      }}
    />,
  );
  const user = userEvent.setup();
  const start = screen.getByLabelText("Başlangıç");
  await user.clear(start);
  await user.type(start, "2030-10-20T02:45");
  await user.selectOptions(screen.getByLabelText("Değişiklik kapsamı"), "this_and_future");
  await user.type(screen.getByLabelText("Çift saat yaşanacak tarih"), "2030-10-27");
  await user.click(screen.getByRole("button", { name: "UTC+01:00 kullan" }));
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Seri saati");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  expect(actions.preview.mock.calls[0][0]).toMatchObject({
    scope: "this_and_future",
    offset_choices: [{ date: "2030-10-27", offset_minutes: 60 }],
    patch: { interval: { starts_at: "2030-10-20T00:45:00.000Z", ends_at: "2030-10-20T01:30:00Z" } },
  });
});

test("calendar detail supplies the real center and timezone to its editor", async () => {
  render(
    <SessionDetail
      entry={{
        id: sampleSession.id,
        kind: "session",
        title: "Test dersi",
        startsAt: sampleSession.starts_at,
        endsAt: sampleSession.ends_at,
      }}
      scope={{ orgId: "org", centerId: "center" }}
      actorId="actor"
      timeZone="Europe/Berlin"
      onClose={() => {}}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Seansı düzenle" }));
  expect(sessionRead).toHaveBeenCalledWith("org", "center", sampleSession.id);
  expect(screen.getByRole("region", { name: "Oda ve eğitmen değişikliği" })).toBeVisible();
  await user.click(screen.getByLabelText("Odayı değiştir"));
  await screen.findByRole("option", { name: "Yeni salon" });
  expect(catalog).toHaveBeenCalledWith({ actorId: "actor", orgId: "org", centerId: "center" });
});

test("changing the local start discards previously approved future offsets", async () => {
  render(
    <SessionChangeFlow
      {...props}
      timeZone="Europe/Berlin"
      session={{
        ...sampleSession,
        starts_at: "2030-10-20T00:30:00Z",
        ends_at: "2030-10-20T01:30:00Z",
      }}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Değişiklik kapsamı"), "this_and_future");
  await user.type(screen.getByLabelText("Çift saat yaşanacak tarih"), "2030-10-27");
  await user.click(screen.getByRole("button", { name: "UTC+01:00 kullan" }));
  expect(screen.getByRole("button", { name: "2030-10-27 seçimini kaldır" })).toBeVisible();
  await user.clear(screen.getByLabelText("Başlangıç"));
  expect(
    screen.queryByRole("button", { name: "2030-10-27 seçimini kaldır" }),
  ).not.toBeInTheDocument();
});

test("calendar replacement creation rereads the source and links the actual new session", async () => {
  const newId = "019a2b3c-4d5e-7000-8000-000000000099";
  const changed = vi.fn<() => void>();
  sessionRead.mockResolvedValue({ ...sampleSession, state: "cancelled" });
  lifecycleWrite.mockResolvedValue({
    operation_id: "op",
    primary_id: newId,
    version: 1,
    replayed: false,
    related: [],
  });
  render(
    <SessionDetail
      entry={{
        id: sampleSession.id,
        kind: "session",
        title: "İptal ders",
        startsAt: sampleSession.starts_at,
        endsAt: sampleSession.ends_at,
      }}
      scope={{ orgId: "org", centerId: "center" }}
      actorId="actor"
      timeZone="Europe/Istanbul"
      onClose={() => {}}
      onChanged={changed}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Telafi seansı oluştur" }));
  await user.selectOptions(await screen.findByLabelText("Oda"), "room");
  await user.type(screen.getByLabelText("Seans başlangıcı"), "2030-11-01T19:30");
  await user.type(screen.getByLabelText("Seans bitişi"), "2030-11-01T20:30");
  await user.type(screen.getByLabelText("Kontenjan"), "20");
  await user.click(
    screen.getByLabelText("Kaynak seansı ve yeni rezervasyon gerektiğini onaylıyorum"),
  );
  await user.click(screen.getByRole("button", { name: "Telafi seansını oluştur" }));
  expect(await screen.findByRole("link", { name: "Yeni telafi seansını aç" })).toHaveAttribute(
    "href",
    `/organizasyon/org/seans/${newId}?center=center`,
  );
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(sessionRead).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "Seansı iptal et" })).not.toBeInTheDocument();
});
