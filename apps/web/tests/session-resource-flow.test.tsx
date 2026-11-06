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
const agreementRows = vi.hoisted(() =>
  vi.fn<typeof import("../src/lib/agreements").agreementApi.list>(),
);
vi.mock("../src/lib/agreements", async (load) => {
  const original = await load<typeof import("../src/lib/agreements")>();
  return {
    ...original,
    agreementApi: {
      ...original.agreementApi,
      list: agreementRows,
      disciplines: async () => [
        { id: "019a2b3c-4d5e-7000-8000-000000000012", name: "Tango", state: "active", version: 1 },
      ],
    },
  };
});
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
  agreementRows.mockResolvedValue({ items: [], next_cursor: null, as_of: "2030-01-01T00:00:00Z" });
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

test("a session agreement blocker opens native agreement recovery and drops the old preview", async () => {
  actions.preview.mockImplementation(async (input) => ({
    ...samplePreview(input),
    blockers: [{ code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: "trace" }],
    configuration_requirement: {
      kind: "instructor_agreement",
      blocker_index: 0,
      person_id: "019a2b3c-4d5e-7000-8000-000000000004",
      discipline_id: "019a2b3c-4d5e-7000-8000-000000000005",
      format: "group",
      starts_at: sampleSession.starts_at,
    },
  }));
  render(<SessionChangeFlow {...props} />);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Toplam kontenjan"));
  await user.type(screen.getByLabelText("Toplam kontenjan"), "30");
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Anlaşma kontrolü");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await user.click(await screen.findByRole("button", { name: "Anlaşmayı incele" }));
  expect(screen.queryByRole("heading", { name: "Değişecek seanslar (1)" })).not.toBeInTheDocument();
  expect(actions.apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Değişikliğe dön" }));
  expect(screen.getByLabelText("Değişiklik gerekçesi")).toHaveValue("Anlaşma kontrolü");
  expect(screen.getByRole("status")).toHaveTextContent("yeniden önizleyin");
});

test("session duty editing retains existing agreement references while adding a second instructor", async () => {
  catalog.mockResolvedValue({
    rooms: [],
    instructors: [{ id: "two", name: "İkinci eğitmen" }],
    disciplines: [],
    duties: [{ id: "two", name: "İkinci eğitmen", duty: "instructor" }],
  });
  const original = { person_id: "old", duty: "instructor" as const, agreement_id: "current-terms" };
  actions.preview.mockImplementation(async (input) => {
    const preview = samplePreview(input);
    return {
      ...preview,
      sessions: preview.sessions?.map((item) => ({
        ...item,
        assignments: [
          original,
          { person_id: "two", duty: "instructor" },
          { person_id: "resolved-assistant", duty: "assistant" },
        ],
      })),
    };
  });
  render(<SessionChangeFlow {...props} session={{ ...sampleSession, assignments: [original] }} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Görev listesini değiştir"));
  await user.click(await screen.findByLabelText("old · Eğitmen"));
  await user.click(screen.getByLabelText("old · Eğitmen"));
  await user.click(screen.getByLabelText("İkinci eğitmen · Eğitmen"));
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "İkinci eğitmen eklenmesi");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  expect(actions.preview.mock.calls[0][0].patch).toEqual({
    assignments: [original, { person_id: "two", duty: "instructor" }],
  });
  expect(screen.getByRole("list", { name: "Önizleme görev listesi" })).toHaveTextContent(
    "İkinci eğitmen",
  );
  expect(screen.getByRole("list", { name: "Önizleme görev listesi" })).toHaveTextContent(
    "resolved-assistant",
  );
  expect(actions.apply).not.toHaveBeenCalled();
});

test("turning off explicit duty replacement leaves capacity edits independent", async () => {
  render(<SessionChangeFlow {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Görev listesini değiştir"));
  await user.click(screen.getByLabelText("Görev listesini değiştir"));
  await user.clear(screen.getByLabelText("Toplam kontenjan"));
  await user.type(screen.getByLabelText("Toplam kontenjan"), "30");
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Sadece kontenjan");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  expect(actions.preview.mock.calls[0][0].patch).toEqual({
    capacity: { total: 30, categories: null },
  });
});
test("published agreement is explicitly chosen for the blocked duty before a fresh preview and separate apply", async () => {
  const person = "019a2b3c-4d5e-7000-8000-000000000004",
    oldId = "019a2b3c-4d5e-7000-8000-000000000005",
    newId = "019a2b3c-4d5e-7000-8000-000000000006";
  const centerId = "019a2b3c-4d5e-7000-8000-000000000002";
  const old: import("@ftksaas/api-contracts").AgreementVersionView = {
    id: oldId,
    person_id: person,
    center_id: centerId,
    discipline_id: sampleSession.discipline_id,
    format: "group",
    version: 1,
    valid: { starts_at: "2030-01-01T00:00:00Z", ends_at: "2030-10-28T00:00:00Z" },
    supersedes_id: null,
    published_at: null,
    terms: {
      model: "session_fixed",
      currency: "TRY",
      components: [{ kind: "session_fixed", amount_minor: "150000" }],
      room_fee: { kind: "free", order: "before_instructor_share" },
    },
  };
  const updated = {
    ...old,
    id: newId,
    version: 2,
    supersedes_id: oldId,
    valid: { starts_at: sampleSession.starts_at, ends_at: "2031-01-01T00:00:00Z" },
  };
  agreementRows.mockResolvedValue({
    items: [old],
    next_cursor: null,
    as_of: "2030-01-01T00:00:00Z",
  });
  lifecycleWrite.mockImplementation(async () => {
    agreementRows.mockResolvedValue({
      items: [updated],
      next_cursor: null,
      as_of: "2030-10-29T00:00:00Z",
    });
    return { operation_id: newId, primary_id: newId, replayed: false, related: [] };
  });
  const requirement = {
    kind: "instructor_agreement" as const,
    blocker_index: 0 as const,
    person_id: person,
    discipline_id: sampleSession.discipline_id,
    format: "group" as const,
    starts_at: sampleSession.starts_at,
  };
  actions.preview.mockImplementationOnce(async (input) => ({
    ...samplePreview(input),
    blockers: [{ code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: "synthetic" }],
    configuration_requirement: requirement,
  }));
  actions.preview.mockImplementation(async (input) => ({
    ...samplePreview(input),
    id: "019a2b3c-4d5e-7000-8000-000000000007",
    token: "fresh-native-preview",
  }));
  actions.apply.mockResolvedValue({
    operation_id: "019a2b3c-4d5e-7000-8000-000000000008",
    primary_id: sampleSession.id,
    version: 2,
    replayed: false,
    related: [],
  });
  catalog.mockResolvedValue({
    rooms: [],
    instructors: [{ id: "new", name: "Yeni kişi" }],
    disciplines: [],
    duties: [{ id: "new", name: "Yeni kişi", duty: "instructor" }],
  });
  render(
    <SessionChangeFlow
      {...props}
      orgId="019a2b3c-4d5e-7000-8000-000000000001"
      centerId={centerId}
      session={{
        ...sampleSession,
        assignments: [
          { person_id: person, duty: "instructor", agreement_id: oldId },
          { person_id: person, duty: "assistant", agreement_id: "same-person-assistant-terms" },
          { person_id: "helper", duty: "assistant", agreement_id: "assistant-terms" },
        ],
      }}
    />,
  );
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Toplam kontenjan"));
  await user.type(screen.getByLabelText("Toplam kontenjan"), "30");
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Yeni anlaşma");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await user.click(await screen.findByRole("button", { name: "Anlaşmayı incele" }));
  await user.click(await screen.findByRole("button", { name: "Yeni sürüm yayımla" }));
  await screen.findByLabelText("Geçerlilik başlangıcı");
  const { fireEvent, within } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("Geçerlilik başlangıcı"), {
    target: { value: "2030-10-29T18:00" },
  });
  fireEvent.change(screen.getByLabelText("Geçerlilik bitişi"), {
    target: { value: "2031-01-01T18:00" },
  });
  await user.type(screen.getByLabelText("Para birimi (ISO 4217)"), "TRY");
  await user.selectOptions(screen.getByLabelText("Ücret modeli"), "session_fixed");
  await user.selectOptions(screen.getByLabelText("Bileşen türü"), "session_fixed");
  await user.type(screen.getByLabelText("Tutar"), "1500");
  await user.selectOptions(screen.getByLabelText("Salon payı türü"), "free");
  await user.selectOptions(
    screen.getByLabelText("Salon payının uygulanma sırası"),
    "before_instructor_share",
  );
  await user.type(screen.getByLabelText("Gerekçe"), "Yeni dönem");
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
  await user.click(await screen.findByRole("button", { name: "Görev için sürüm 2 seç · Eğitmen" }));
  expect(actions.preview).toHaveBeenCalledOnce();
  expect(actions.apply).not.toHaveBeenCalled();
  await user.click(await screen.findByLabelText(`${person} · Eğitmen`));
  await user.click(screen.getByLabelText(`${person} · Eğitmen`));
  await user.click(screen.getByLabelText("Yeni kişi · Eğitmen"));
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  expect(actions.preview.mock.calls[1][0].patch.assignments).toEqual([
    { person_id: person, duty: "assistant", agreement_id: "same-person-assistant-terms" },
    { person_id: "helper", duty: "assistant", agreement_id: "assistant-terms" },
    { person_id: person, duty: "instructor", agreement_id: newId },
    { person_id: "new", duty: "instructor" },
  ]);
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  await waitFor(() => expect(actions.apply).toHaveBeenCalledOnce());
  expect(actions.apply.mock.calls[0][0].preview).toEqual({
    id: "019a2b3c-4d5e-7000-8000-000000000007",
    token: "fresh-native-preview",
  });
});
