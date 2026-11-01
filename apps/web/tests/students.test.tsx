import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { FailureEnvelope, PersonView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { StudentDirectory, StudentsWorkspace } from "../src/components/students/students-workspace";
import { StudentChange } from "../src/components/students/student-change";
import {
  sampleStudents,
  sampleStudentScope as scope,
} from "../src/components/admin/student-fixtures";
import { ApiFailure } from "../src/lib/api";
import { studentActions, studentStorageKey, type StudentActions } from "../src/lib/students";

const person = sampleStudents[0];
const page = (items: PersonView[] = [person], next_cursor: string | null = null) => ({
  items,
  next_cursor,
  as_of: "2030-10-29T00:00:00Z",
});
const failure = (code: FailureEnvelope["error"]["code"]) =>
  new ApiFailure({ ok: false, error: { code, retryable: false, trace_id: person.id } });
function actions() {
  return {
    list: vi.fn<StudentActions["list"]>().mockResolvedValue(page()),
    person: vi.fn<StudentActions["person"]>().mockResolvedValue(person),
    change: vi.fn<StudentActions["change"]>().mockResolvedValue({
      operation_id: "operation",
      primary_id: "relationship-not-person",
      related: [],
      replayed: false,
    }),
    status: vi.fn<StudentActions["status"]>(),
    update: vi.fn<StudentActions["update"]>(),
    operationStatus: vi.fn<StudentActions["operationStatus"]>(),
    create: vi.fn<StudentActions["create"]>(),
    invite: vi.fn<StudentActions["invite"]>(),
    jobStatus: vi.fn<StudentActions["jobStatus"]>(),
    operationResult: vi.fn<StudentActions["operationResult"]>(),
  };
}
function directory(api: StudentActions) {
  return render(<StudentDirectory scope={scope} centerName="Fethiye" actions={api} />);
}
function change(
  api: StudentActions,
  actorId = scope.actorId,
  freshPerson: PersonView | undefined = person,
) {
  return render(
    <StudentChange
      scope={{ ...scope, actorId }}
      personId={person.id}
      person={freshPerson}
      centerName="Fethiye"
      actions={api}
      onSaved={vi.fn<() => void>()}
    />,
  );
}
async function deactivate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Öğrenciliği pasifleştir" }));
  expect(screen.getByRole("button", { name: "Pasifleştirmeyi onayla" })).toBeDisabled();
  await user.type(screen.getByLabelText("Pasifleştirme gerekçesi"), "  Döneme ara verdi  ");
  await user.click(screen.getByRole("button", { name: "Pasifleştirmeyi onayla" }));
}
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test("search resets the scoped cursor and a late page cannot replace new results", async () => {
  const api = actions();
  let finish!: (result: ReturnType<typeof page>) => void;
  api.list
    .mockResolvedValueOnce(page([person], "page-2"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(page([sampleStudents[1]]));
  const user = userEvent.setup();
  directory(api);
  await screen.findByRole("button", { name: /Deniz Örnek/ });
  await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
  expect(api.list.mock.calls[1][0].cursor).toBe("page-2");
  await user.type(screen.getByLabelText("Öğrenci ara"), " Selin ");
  await user.click(screen.getByRole("button", { name: "Ara" }));
  expect(await screen.findByRole("button", { name: /Selin Örnek/ })).toBeVisible();
  expect(api.list.mock.calls[2][0]).toEqual({
    orgId: scope.orgId,
    centerId: scope.centerId,
    query: "Selin",
    cursor: undefined,
  });
  await act(async () => finish(page([sampleStudents[2]])));
  expect(screen.queryByRole("button", { name: /Ece Örnek/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Önceki sayfa" })).toBeDisabled();
});

test("failed refresh hides old rows and retry does not invent empty data", async () => {
  const api = actions();
  api.list
    .mockResolvedValueOnce(page())
    .mockRejectedValueOnce(failure("FORBIDDEN"))
    .mockResolvedValueOnce(page([]));
  const user = userEvent.setup();
  directory(api);
  await screen.findByRole("button", { name: /Deniz Örnek/ });
  await user.click(screen.getByRole("button", { name: "Listeyi yenile" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Deniz Örnek/ })).not.toBeInTheDocument();
  expect(screen.queryByText("Bu sayfada öğrenci yok")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByText("Bu sayfada öğrenci yok")).toBeVisible();
});

test("live center switch isolates search, pages, selection and late data", async () => {
  let finish!: (result: ReturnType<typeof page>) => void;
  const list = vi
    .spyOn(studentActions, "list")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(page([sampleStudents[1]]));
  const user = userEvent.setup();
  render(
    <StudentsWorkspace
      actorId="actor"
      studios={[
        {
          organization: {
            id: "org",
            name: "Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
          },
          centers: ["A", "B"].map((id) => ({
            id,
            name: id,
            accessible: true,
            timezone: "Europe/Istanbul",
            state: "active",
            version: 1,
          })),
        },
      ]}
    />,
  );
  await user.type(screen.getByLabelText("Öğrenci ara"), "draft search");
  await user.click(screen.getByRole("button", { name: "Studio / B" }));
  expect(await screen.findByRole("button", { name: /Selin Örnek/ })).toBeVisible();
  expect(screen.getByLabelText("Öğrenci ara")).toHaveValue("");
  expect(list.mock.calls[1][0]).toEqual({
    orgId: "org",
    centerId: "B",
    query: "",
    cursor: undefined,
  });
  await act(async () => finish(page()));
  expect(screen.queryByRole("button", { name: /Deniz Örnek/ })).not.toBeInTheDocument();
});

test("detail reads current contacts and current center relationships; save refreshes detail and list", async () => {
  const api = actions();
  api.person
    .mockResolvedValueOnce({
      ...person,
      display_name: "Deniz Güncel",
      relationships: [
        { center_id: "other", kind: "instructor", state: "active" },
        { center_id: scope.centerId, kind: "student", state: "inactive" },
        ...person.relationships,
      ],
    })
    .mockResolvedValueOnce({
      ...person,
      relationships: [{ center_id: scope.centerId, kind: "student", state: "inactive" }],
      contacts: undefined,
    });
  const user = userEvent.setup();
  directory(api);
  await user.click(await screen.findByRole("button", { name: /Deniz Örnek/ }));
  expect(await screen.findByRole("heading", { name: "Deniz Güncel" })).toBeVisible();
  expect(api.person).toHaveBeenCalledWith(scope.orgId, scope.centerId, person.id);
  expect(screen.getByText("İletişim bilgisi doğrulandı")).toBeVisible();
  expect(screen.queryByText("Eğitmen")).not.toBeInTheDocument();
  expect(screen.queryByText(/kullanıcı hesabı/i)).not.toBeInTheDocument();
  await deactivate(user);
  expect(await screen.findByText("Öğrencilik işlemi kaydedildi")).toBeVisible();
  expect(api.change).toHaveBeenCalledTimes(1);
  expect(api.change.mock.calls[0][0]).toMatchObject({
    operation: "student_deactivate_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: person.id,
      reason: "Döneme ara verdi",
    },
  });
  await user.click(screen.getByRole("button", { name: "Güncel öğrenci bilgilerini göster" }));
  expect(await screen.findByRole("button", { name: "Öğrenciliği etkinleştir" })).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "İletişim" })).getByText(
      "Bu görünümde iletişim bilgisi paylaşılmıyor.",
    ),
  ).toBeVisible();
  expect(api.list).toHaveBeenCalledTimes(2);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: /Deniz Örnek/ })).toHaveFocus();
});

test("open operations block deactivation without fake success or a local state change", async () => {
  const api = actions();
  api.change.mockRejectedValue(failure("OPEN_OPERATIONS_EXIST"));
  const user = userEvent.setup();
  change(api);
  await deactivate(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("açık işlemleri var");
  expect(screen.queryByText("Öğrencilik işlemi kaydedildi")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Öğrenciliği pasifleştir" })).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});

test("lost response survives remount, permission loss preserves uncertainty, same payload replays once", async () => {
  const api = actions();
  api.change
    .mockRejectedValueOnce(new Error("lost response"))
    .mockRejectedValueOnce(failure("FORBIDDEN"));
  const user = userEvent.setup();
  const first = change(api);
  await deactivate(user);
  await screen.findByText("İşlem sonucu henüz doğrulanamadı");
  const command = api.change.mock.calls[0][0];
  first.unmount();
  change(api);
  expect(screen.queryByRole("button", { name: "Öğrenciliği pasifleştir" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Aynı isteği tekrar gönder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("yetkin yok");
  expect(api.change.mock.calls[1][0]).toEqual(command);
  expect(sessionStorage.getItem(studentStorageKey(scope, person.id))).toContain(
    command.input.operation_key,
  );
  api.status.mockImplementation(async (_org, operation, key) => ({
    operation,
    key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "center_relationships", id: "relationship-not-person" },
  }));
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  expect(await screen.findByText("Öğrencilik işlemi kaydedildi")).toBeVisible();
  expect(api.status).toHaveBeenCalledWith(
    scope.orgId,
    command.operation,
    command.input.operation_key,
  );
  expect(sessionStorage.length).toBe(0);
});

test("another account cannot recover the pending write and a missing detail still allows result checks", async () => {
  const api = actions();
  api.change.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup();
  const first = change(api);
  await deactivate(user);
  await screen.findByText("İşlem sonucu henüz doğrulanamadı");
  first.unmount();
  const other = change(api, "other-actor");
  expect(screen.queryByRole("button", { name: "Sonucu kontrol et" })).not.toBeInTheDocument();
  other.unmount();
  api.person.mockRejectedValue(failure("FORBIDDEN"));
  directory(api);
  await user.click(await screen.findByRole("button", { name: /Deniz Örnek/ }));
  expect(await within(screen.getByRole("dialog")).findByRole("alert")).toBeVisible();
  expect(screen.getByRole("button", { name: "Sonucu kontrol et" })).toBeVisible();
});

test("expired receipt blocks replay after remount and NOT_FOUND never clears the pending command", async () => {
  const api = actions();
  api.change.mockRejectedValue(new Error("offline"));
  api.status
    .mockRejectedValueOnce(failure("NOT_FOUND"))
    .mockImplementationOnce(async (_org, operation, key) => ({
      operation,
      key,
      status: "result_expired",
      result_available: false,
      result_reference: null,
    }));
  const user = userEvent.setup();
  const first = change(api);
  await deactivate(user);
  await screen.findByText("İşlem sonucu henüz doğrulanamadı");
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("başarısız olduğu varsayılmaz");
  expect(sessionStorage.length).toBe(1);
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("saklama süresi doldu");
  first.unmount();
  change(api);
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Öğrenciliği pasifleştir" })).not.toBeInTheDocument();
});

test("storage failure prevents dispatch and malformed or cross-person recovery fails closed", async () => {
  const api = actions();
  const user = userEvent.setup();
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw new Error("storage blocked");
  });
  const first = change(api);
  await deactivate(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("Yeni işlem gönderilmedi");
  expect(api.change).not.toHaveBeenCalled();
  first.unmount();
  sessionStorage.setItem(
    studentStorageKey(scope, person.id),
    JSON.stringify({
      command: {
        operation: "student_activate_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          person_id: "other",
          operation_key: person.id,
        },
      },
    }),
  );
  change(api);
  expect(screen.getByRole("alert")).toHaveTextContent("güvenle okunamadı");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("double confirmation sends once and an unmounted response cannot erase recovery", async () => {
  const api = actions();
  let finish!: (result: Awaited<ReturnType<StudentActions["change"]>>) => void;
  api.change.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  const first = change(api);
  await user.click(screen.getByRole("button", { name: "Öğrenciliği pasifleştir" }));
  await user.type(screen.getByLabelText("Pasifleştirme gerekçesi"), "Ara verdi");
  await user.dblClick(screen.getByRole("button", { name: "Pasifleştirmeyi onayla" }));
  expect(api.change).toHaveBeenCalledTimes(1);
  first.unmount();
  await act(async () =>
    finish({ operation_id: "op", primary_id: "relationship", related: [], replayed: false }),
  );
  change(api);
  expect(screen.getByRole("button", { name: "Sonucu kontrol et" })).toBeVisible();
});

test("activation is explicit, has no fabricated version or reason and reports the backend plan limit", async () => {
  const api = actions();
  api.change.mockRejectedValue(failure("PLAN_LIMIT_REACHED"));
  const user = userEvent.setup();
  change(api, scope.actorId, { ...person, relationships: [] });
  await user.click(screen.getByRole("button", { name: "Öğrenciliği etkinleştir" }));
  expect(api.change).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Etkinleştirmeyi onayla" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("öğrenci sınırına");
  expect(api.change.mock.calls[0][0].operation).toBe("student_activate_v1");
  expect(api.change.mock.calls[0][0].input).not.toHaveProperty("reason");
  expect(api.change.mock.calls[0][0].input).not.toHaveProperty("expected_version");
});

test("saving a person edit refreshes the directory as well as the profile", async () => {
  const api = actions();
  api.update.mockResolvedValue({
    operation_id: person.id,
    primary_id: person.id,
    related: [],
    replayed: false,
  });
  api.list
    .mockResolvedValueOnce(page())
    .mockResolvedValue(page([{ ...person, display_name: "Yeni ad" }]));
  const user = userEvent.setup();
  directory(api);
  await user.click(await screen.findByRole("button", { name: /Deniz Örnek/ }));
  await user.click(await screen.findByRole("button", { name: "Kişi bilgilerini düzenle" }));
  const field = screen.getByLabelText("Ad soyad");
  await user.clear(field);
  await user.type(field, "Yeni ad");
  await user.click(screen.getByRole("button", { name: "Bilgileri kaydet" }));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  expect(api.person).toHaveBeenCalledTimes(2);
});
