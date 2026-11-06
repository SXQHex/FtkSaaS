import { beforeEach, expect, test, vi } from "vitest";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { AgreementForm } from "../src/components/agreements/agreement-form";
import type { AgreementApi } from "../src/lib/agreements";
import type { PreparedAgreement } from "../src/lib/agreement-preparations";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: unknown) => Promise<unknown>>(),
  send: vi.fn<(command: import("../src/lib/studio-setup").SetupCommand) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: id, centerId: center };
const source = { scope: "organization" as const, key: "tango", version: 3 };
const resolved: PreparedAgreement = {
  kind: "agreement",
  source,
  agreement_request: {
    discipline_id: id,
    format: "group",
    terms: {
      model: "session_fixed",
      currency: "TRY",
      components: [{ kind: "session_fixed", amount_minor: "150050" }],
      room_fee: { kind: "free", order: "before_instructor_share" },
    },
  },
};
const template = { key: "tango", name: "Tango dönemlik", ...resolved.agreement_request };
const api: AgreementApi = {
  list: vi.fn<AgreementApi["list"]>(),
  disciplines: vi.fn<AgreementApi["disciplines"]>(),
  products: vi.fn<AgreementApi["products"]>(),
};
function form(requirement?: import("@ftksaas/api-contracts").ScheduleConfigurationRequirement) {
  return (
    <AgreementForm
      scope={scope}
      personId={id}
      timeZone="UTC"
      api={api}
      onSaved={vi.fn<() => void>()}
      onRejected={vi.fn<(code: string) => void>()}
      onCancel={vi.fn<() => void>()}
      requirement={requirement}
    />
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api.disciplines).mockResolvedValue([
    { id, name: "Tango", state: "active", version: 1 },
  ]);
  mocks.call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? { scope: "center", preparation_templates: { agreements: [{ source, template }] } }
      : resolved,
  );
  mocks.send.mockResolvedValue({});
});
async function choose() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await user.click(await screen.findByRole("button", { name: /Tango dönemlik/ }));
  await screen.findByText("Seçilen şablon: Tango dönemlik");
  return user;
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("Geçerlilik başlangıcı"), {
    target: { value: "2027-01-01T13:00" },
  });
  fireEvent.change(screen.getByLabelText("Geçerlilik bitişi"), {
    target: { value: "2027-02-01T13:00" },
  });
  await user.type(screen.getByLabelText("Gerekçe"), "Yeni dönem");
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
}
test("template discovery is opt-in and resolution still needs actual dates, reason and separate publication confirmation", async () => {
  render(form());
  await screen.findByLabelText("Disiplin");
  expect(mocks.call).not.toHaveBeenCalled();
  const user = await choose();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Geçerlilik başlangıcı")).toHaveValue("");
  await review(user);
  const region = screen.getByRole("region", { name: "İşlemi incele" });
  expect(within(region).getByText(/1\.500,50/)).toBeInTheDocument();
  await user.click(within(region).getByRole("checkbox"));
  await user.click(within(region).getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  const sent = mocks.send.mock.calls[0][0];
  expect(sent.operation).toBe("instructor_agreement_publish_v1");
  expect(sent.input).toMatchObject({
    person_id: id,
    center_id: center,
    discipline_id: id,
    format: "group",
    terms: resolved.agreement_request.terms,
    reason: "Yeni dönem",
  });
  expect(sent.input).not.toHaveProperty("source");
});
test("switching to manual terms drops template review and requires explicit money again", async () => {
  render(form());
  const user = await choose();
  await review(user);
  expect(screen.getByRole("region", { name: "İşlemi incele" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ücreti elle gir" }));
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Para birimi (ISO 4217)")).toHaveValue("");
  expect(mocks.send).not.toHaveBeenCalled();
});
test("failed catalog discovery leaves manual entry available with retry", async () => {
  mocks.call.mockRejectedValue(Error("invalidAgreement"));
  render(form());
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await screen.findByRole("button", { name: "Şablonları yeniden oku" });
  expect(screen.getByLabelText("Para birimi (ISO 4217)")).toBeEnabled();
});
test("closing a pending resolver ignores its late result", async () => {
  let finish: (value: PreparedAgreement) => void = () => {};
  mocks.call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? { scope: "center", preparation_templates: { agreements: [{ source, template }] } }
      : new Promise<PreparedAgreement>((resolve) => {
          finish = resolve;
        }),
  );
  render(form());
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await user.click(await screen.findByRole("button", { name: /Tango dönemlik/ }));
  expect(screen.getByRole("button", { name: "İşlemi incele" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Şablon seçimini kapat" }));
  finish(resolved);
  await waitFor(() => expect(screen.getByRole("button", { name: "İşlemi incele" })).toBeEnabled());
  expect(screen.queryByText("Seçilen şablon: Tango dönemlik")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Para birimi (ISO 4217)")).toHaveValue("");
});
test("program requirements hide incompatible templates rather than changing locked dimensions", async () => {
  const requirement: import("@ftksaas/api-contracts").ScheduleConfigurationRequirement = {
    blocker_index: 0,
    starts_at: "2027-01-01T13:00:00Z",
    kind: "instructor_agreement",
    discipline_id: id,
    format: "private",
    person_id: id,
  };
  render(form(requirement));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await screen.findByText(/Bu kapsam için uygun anlaşma şablonu bulunamadı/);
  expect(screen.queryByRole("button", { name: /Tango dönemlik/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ders biçimi")).toHaveValue("private");
  expect(mocks.call).toHaveBeenCalledOnce();
});
test("a changed template version requires a catalog reload and a new explicit selection", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.call.mockImplementation(async (op) => {
    if (op === "settings_preparation_resolve_v1")
      throw new ApiFailure({
        ok: false,
        error: { code: "VERSION_CONFLICT", retryable: false, trace_id: "synthetic" },
      });
    return { scope: "center", preparation_templates: { agreements: [{ source, template }] } };
  });
  render(form());
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await user.click(await screen.findByRole("button", { name: /Tango dönemlik/ }));
  await screen.findByRole("button", { name: "Şablonları yeniden oku" });
  expect(screen.queryByText("Seçilen şablon: Tango dönemlik")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Para birimi (ISO 4217)")).toBeEnabled();
  const newer = { ...source, version: 4 };
  mocks.call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? { scope: "center", preparation_templates: { agreements: [{ source: newer, template }] } }
      : { ...resolved, source: newer },
  );
  await user.click(screen.getByRole("button", { name: "Şablonları yeniden oku" }));
  expect(screen.queryByText("Seçilen şablon: Tango dönemlik")).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: /Tango dönemlik.*Sürüm 4/ }));
  await screen.findByText("Seçilen şablon: Tango dönemlik");
  expect(mocks.call).toHaveBeenLastCalledWith(
    "settings_preparation_resolve_v1",
    expect.objectContaining({ source: newer }),
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
test("a resolved discipline differing from the chosen template cannot populate the form", async () => {
  mocks.call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? { scope: "center", preparation_templates: { agreements: [{ source, template }] } }
      : {
          ...resolved,
          agreement_request: { ...resolved.agreement_request, discipline_id: center },
        },
  );
  render(form());
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Şablondan hazırla" }));
  await user.click(await screen.findByRole("button", { name: /Tango dönemlik/ }));
  await screen.findByRole("button", { name: "Şablonları yeniden oku" });
  expect(screen.getByLabelText("Disiplin")).toHaveValue("");
  expect(screen.queryByText("Seçilen şablon: Tango dönemlik")).not.toBeInTheDocument();
});
test("lost publication response preserves exact prepared terms on replay without resolving the source again", async () => {
  mocks.send.mockRejectedValueOnce(new TypeError("lost"));
  const mounted = render(form());
  const user = await choose();
  await review(user);
  const region = screen.getByRole("region", { name: "İşlemi incele" });
  await user.click(within(region).getByRole("checkbox"));
  await user.click(within(region).getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const original = mocks.send.mock.calls[0][0];
  mounted.unmount();
  mocks.call.mockRejectedValue(new Error("FORBIDDEN"));
  render(form());
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  expect(original.input).toMatchObject({ terms: resolved.agreement_request.terms });
  expect(mocks.call).toHaveBeenCalledTimes(2);
});
