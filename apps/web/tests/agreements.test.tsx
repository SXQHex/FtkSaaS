import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgreementVersionView } from "@ftksaas/api-contracts";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { render } from "./render";
import { InstructorAgreements } from "../src/components/agreements/instructor-agreements";
import type { AgreementApi } from "../src/lib/agreements";
import { setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import { ApiFailure } from "../src/lib/api";
const mocks = vi.hoisted(() => ({
  send: vi.fn<(command: import("../src/lib/studio-setup").SetupCommand) => Promise<unknown>>(),
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: mocks.send,
  setupCall: mocks.call,
}));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002",
  discipline = "019a2b3c-4d5e-7000-8000-000000000003",
  agreement = "019a2b3c-4d5e-7000-8000-000000000004";
const scope = { actorId: person, orgId: person, centerId: center };
const row: AgreementVersionView = {
  id: agreement,
  version: 7,
  person_id: person,
  center_id: center,
  discipline_id: discipline,
  format: "group",
  valid: { starts_at: "2026-01-01T10:00:00Z", ends_at: "2028-01-01T10:00:00Z" },
  supersedes_id: null,
  published_at: "2025-12-01T10:00:00Z",
  terms: {
    model: "session_fixed",
    currency: "TRY",
    components: [{ kind: "session_fixed", amount_minor: "120050" }],
    room_fee: { kind: "free", order: "before_instructor_share" },
  },
};
const api = {
  list: vi.fn<AgreementApi["list"]>(),
  disciplines: vi.fn<AgreementApi["disciplines"]>(),
  products: vi.fn<AgreementApi["products"]>(),
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  api.list.mockResolvedValue({ items: [], as_of: "2026-11-06T00:00:00Z", next_cursor: null });
  api.disciplines.mockResolvedValue([
    { id: discipline, name: "Tango", state: "active", version: 1 },
  ]);
  api.products.mockResolvedValue({ items: [], as_of: "2026-11-06T00:00:00Z", next_cursor: null });
  mocks.send.mockResolvedValue({});
});
async function fill(replacement = false) {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", {
      name: replacement ? "Yeni sürüm yayımla" : "Yeni anlaşma oluştur",
    }),
  );
  await screen.findByLabelText("Disiplin");
  if (!replacement) {
    await user.selectOptions(screen.getByLabelText("Disiplin"), discipline);
    await user.selectOptions(screen.getByLabelText("Ders biçimi"), "group");
  }
  for (const [label, value] of [
    ["Geçerlilik başlangıcı", "2027-01-01T13:00"],
    ["Geçerlilik bitişi", "2027-02-01T13:00"],
    ["Para birimi (ISO 4217)", "TRY"],
    ["Gerekçe", "Yeni dönem"],
  ])
    if (label.startsWith("Geçerlilik"))
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    else await user.type(screen.getByLabelText(label), value);
  await user.selectOptions(screen.getByLabelText("Ücret modeli"), "session_fixed");
  await user.selectOptions(screen.getByLabelText("Bileşen türü"), "session_fixed");
  await user.type(screen.getByLabelText("Tutar"), "1500,50");
  await user.selectOptions(screen.getByLabelText("Salon payı türü"), "free");
  await user.selectOptions(
    screen.getByLabelText("Salon payının uygulanma sırası"),
    "before_instructor_share",
  );
  expect(
    Array.from(document.querySelectorAll("input,select"))
      .filter((el) => !(el as HTMLInputElement).checkValidity())
      .map((el) => ({
        label: el.id,
        value: (el as HTMLInputElement).value,
        message: (el as HTMLInputElement).validationMessage,
      })),
  ).toEqual([]);
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
  return user;
}
async function publish(user: ReturnType<typeof userEvent.setup>) {
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
}
test("explicit agreement creation rereads history before notifying and never invents a version", async () => {
  const saved = vi.fn<() => void>();
  render(
    <InstructorAgreements
      scope={scope}
      personId={person}
      timeZone="Europe/Istanbul"
      api={api}
      onPublished={saved}
    />,
  );
  const user = await fill();
  expect(mocks.send).not.toHaveBeenCalled();
  await publish(user);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "instructor_agreement_publish_v1",
    input: {
      org_id: person,
      center_id: center,
      person_id: person,
      discipline_id: discipline,
      format: "group",
      valid: { starts_at: "2027-01-01T10:00:00.000Z", ends_at: "2027-02-01T10:00:00.000Z" },
      terms: { components: [{ kind: "session_fixed", amount_minor: "150050" }] },
    },
  });
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("expected_version");
  expect(api.products).not.toHaveBeenCalled();
});
test("replacement locks source dimensions and publishes the actual prior id and version", async () => {
  api.list.mockResolvedValue({ items: [row], as_of: "2026-11-06T00:00:00Z", next_cursor: null });
  render(
    <InstructorAgreements scope={scope} personId={person} timeZone="Europe/Istanbul" api={api} />,
  );
  const user = await fill(true);
  expect(screen.getByLabelText("Disiplin")).toBeDisabled();
  await publish(user);
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0].input).toMatchObject({
    supersedes_id: agreement,
    expected_version: 7,
  });
});
test("changing terms by adding a component drops the previously approved review", async () => {
  render(
    <InstructorAgreements scope={scope} personId={person} timeZone="Europe/Istanbul" api={api} />,
  );
  const user = await fill();
  await user.click(
    within(screen.getByRole("region", { name: "İşlemi incele" })).getByRole("checkbox"),
  );
  await user.click(screen.getByRole("button", { name: "Bileşen ekle" }));
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("read denial hides monetary terms and creation without inferring permission from a role", async () => {
  api.list.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<InstructorAgreements scope={scope} personId={person} timeZone="UTC" api={api} />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Yeni anlaşma oluştur" })).not.toBeInTheDocument();
  expect(api.disciplines).not.toHaveBeenCalled();
});
test("response loss survives remount and replays the exact agreement despite current read denial", async () => {
  mocks.send.mockRejectedValueOnce(new TypeError("lost"));
  const mounted = render(
    <InstructorAgreements scope={scope} personId={person} timeZone="Europe/Istanbul" api={api} />,
  );
  const user = await fill();
  await publish(user);
  await waitFor(() =>
    expect(sessionStorage.getItem(setupStorageKey(scope, `agreements:${person}`))).not.toBeNull(),
  );
  const original = mocks.send.mock.calls[0][0];
  mounted.unmount();
  expect(discoverPendingOperations(person)).toEqual([
    { scope, slot: `agreements:${person}`, kind: "agreements" },
  ]);
  api.list.mockRejectedValue(new Error("FORBIDDEN"));
  render(
    <InstructorAgreements scope={scope} personId={person} timeZone="Europe/Istanbul" api={api} />,
  );
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  await waitFor(() =>
    expect(sessionStorage.getItem(setupStorageKey(scope, `agreements:${person}`))).toBeNull(),
  );
});
test("a late history response from another person cannot enter the new scope", async () => {
  let resolve!: (value: Awaited<ReturnType<AgreementApi["list"]>>) => void;
  api.list.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = render(
    <InstructorAgreements scope={scope} personId={person} timeZone="UTC" api={api} />,
  );
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <InstructorAgreements scope={scope} personId={discipline} timeZone="UTC" api={api} />
    </NextIntlClientProvider>,
  );
  await screen.findByText("Bu kişi için yayımlanmış anlaşma yok.");
  resolve({ items: [row], as_of: "2026-11-06T00:00:00Z", next_cursor: null });
  await waitFor(() => expect(screen.queryByText("Sürüm 7")).not.toBeInTheDocument());
});
test("using a native agreement version requires an explicit target duty and does not publish", async () => {
  api.list.mockResolvedValue({ items: [row], next_cursor: null, as_of: "2026-11-06T00:00:00Z" });
  const useVersion =
    vi.fn<(value: AgreementVersionView, duty: "instructor" | "assistant") => void>();
  render(
    <InstructorAgreements
      scope={scope}
      personId={person}
      timeZone="UTC"
      api={api}
      requirement={{
        kind: "instructor_agreement",
        blocker_index: 0,
        person_id: person,
        discipline_id: discipline,
        format: "group",
        starts_at: "2027-01-01T00:00:00Z",
      }}
      targetDuties={["instructor", "assistant"]}
      onUseVersion={useVersion}
    />,
  );
  const user = userEvent.setup();
  expect(
    await screen.findByRole("button", { name: "Görev için sürüm 7 seç · Eğitmen" }),
  ).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Görev için sürüm 7 seç · Asistan" }));
  expect(useVersion).toHaveBeenCalledExactlyOnceWith(row, "assistant");
  expect(mocks.send).not.toHaveBeenCalled();
});
