import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "./render";
import { PersonCreate } from "../src/components/students/person-create";
import { PersonEdit } from "../src/components/students/person-edit";
import { PersonInvitation } from "../src/components/students/person-invitation";
import {
  createSampleStudentActions,
  sampleStudents,
  sampleStudentScope as scope,
} from "../src/components/admin/student-fixtures";
import { ApiFailure } from "../src/lib/api";
import type { StudentActions } from "../src/lib/students";

const person = sampleStudents[0];
const receipt = { operation_id: person.id, primary_id: person.id, related: [], replayed: false };
function actions() {
  const status = vi.fn<StudentActions["operationResult"]>();
  return {
    ...createSampleStudentActions(),
    create: vi.fn<StudentActions["create"]>().mockResolvedValue(receipt),
    update: vi.fn<StudentActions["update"]>().mockResolvedValue(receipt),
    invite: vi.fn<StudentActions["invite"]>(),
    operationResult: status,
    operationStatus: status,
  };
}
async function createPerson(user: ReturnType<typeof userEvent.setup>, name = "Yeni Kişi") {
  await user.click(screen.getByRole("button", { name: "Kişi kaydı ekle" }));
  await user.type(screen.getByLabelText("Ad soyad"), name);
  await user.click(screen.getByRole("button", { name: "Kişi kaydını oluştur" }));
}
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test("lost create response exposes recovery immediately and replays the identical request", async () => {
  const api = actions();
  api.create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const onCreated = vi.fn<(personId: string) => boolean>(() => true);
  const user = userEvent.setup();
  render(<PersonCreate scope={scope} actions={api} onCreated={onCreated} />);
  await createPerson(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kesildi");
  expect(onCreated).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Aynı isteği tekrar gönder" }));
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
  expect(onCreated).toHaveBeenCalledExactlyOnceWith(person.id);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("completed creation opens an empty usable form for a second person with a new key", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(<PersonCreate scope={scope} actions={api} onCreated={() => true} />);
  await createPerson(user);
  await user.click(screen.getByRole("button", { name: "Kişi kaydı ekle" }));
  expect(screen.getByLabelText("Ad soyad")).toHaveValue("");
  await user.type(screen.getByLabelText("Ad soyad"), "İkinci Kişi");
  await user.click(screen.getByRole("button", { name: "Kişi kaydını oluştur" }));
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[1][0].operation_key).not.toBe(
    api.create.mock.calls[0][0].operation_key,
  );
  expect(api.create.mock.calls[1][0].display_name).toBe("İkinci Kişi");
});

test.each(["create", "edit", "invite"] as const)(
  "%s expiry cannot re-enable replay after a failed status check or remount",
  async (kind) => {
    const api = actions();
    const lost = new TypeError("Failed to fetch");
    api.create.mockRejectedValue(lost);
    api.update.mockRejectedValue(lost);
    api.invite.mockRejectedValue(lost);
    api.operationResult
      .mockImplementationOnce(async (_org, operation, key) => ({
        operation,
        key,
        status: "result_expired",
        result_available: false,
        result_reference: null,
      }))
      .mockRejectedValueOnce(
        new ApiFailure({
          ok: false,
          error: { code: "NOT_FOUND", retryable: false, trace_id: person.id },
        }),
      );
    const component =
      kind === "create" ? (
        <PersonCreate scope={scope} actions={api} onCreated={() => true} />
      ) : kind === "edit" ? (
        <PersonEdit
          scope={scope}
          personId={person.id}
          person={person}
          actions={api}
          onSaved={vi.fn<() => void>()}
        />
      ) : (
        <PersonInvitation scope={scope} person={person} actions={api} />
      );
    const user = userEvent.setup();
    const view = render(component);
    if (kind === "create") await createPerson(user);
    else if (kind === "edit") {
      await user.click(screen.getByRole("button", { name: "Kişi bilgilerini düzenle" }));
      await user.type(screen.getByLabelText("Ad soyad"), " Güncel");
      await user.click(screen.getByRole("button", { name: "Bilgileri kaydet" }));
    } else await user.click(screen.getByRole("button", { name: "Erişim daveti gönder" }));
    await user.click(await screen.findByRole("button", { name: "Sonucu kontrol et" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("saklama süresi doldu");
    expect(
      screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("başarısız olduğu varsayılmaz");
    expect(
      screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
    ).not.toBeInTheDocument();
    view.unmount();
    render(component);
    expect(screen.getByRole("button", { name: "Sonucu kontrol et" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
    ).not.toBeInTheDocument();
    const write = kind === "create" ? api.create : kind === "edit" ? api.update : api.invite;
    expect(write).toHaveBeenCalledTimes(1);
  },
);

test.each(["tr", "en"] as const)(
  "%s profile errors are readable and updates use the fetched version",
  async (locale) => {
    const api = actions();
    api.update.mockRejectedValue(
      new ApiFailure({
        ok: false,
        error: { code: "VERSION_CONFLICT", retryable: false, trace_id: person.id },
      }),
    );
    const onSaved = vi.fn<() => void>();
    const user = userEvent.setup();
    render(
      <PersonEdit
        scope={scope}
        personId={person.id}
        person={{ ...person, version: 7 }}
        actions={api}
        onSaved={onSaved}
      />,
      locale,
    );
    const tr = locale === "tr";
    await user.click(
      screen.getByRole("button", { name: tr ? "Kişi bilgilerini düzenle" : "Edit person details" }),
    );
    await user.click(
      screen.getByRole("button", { name: tr ? "Bilgileri kaydet" : "Save details" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      tr ? "Kaydedilecek bir değişiklik yok." : "There are no changes to save.",
    );
    expect(api.update).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(tr ? "Ad soyad" : "Full name"), " Updated");
    await user.click(
      screen.getByRole("button", { name: tr ? "Bilgileri kaydet" : "Save details" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      tr ? "Kişi bilgileri değişmiş" : "Person details have changed",
    );
    expect(api.update.mock.calls[0][0]).toMatchObject({
      expected_version: 7,
      person_id: person.id,
      patch: { display_name: `${person.display_name} Updated` },
    });
    expect(api.update.mock.calls[0][0].patch).not.toHaveProperty("contacts");
    expect(onSaved).not.toHaveBeenCalled();
  },
);
