import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { ApiFailure } from "../src/lib/api";
import { PersonDisciplines } from "../src/components/students/person-disciplines";
import {
  sampleStudents,
  sampleStudentScope as scope,
} from "../src/components/admin/student-fixtures";
import type { DisciplineActions } from "../src/lib/student-management";
const id = "019a2b3c-4d5e-7000-8000-000000000080";
const person = sampleStudents[0];
function actions() {
  return {
    list: vi
      .fn<DisciplineActions["list"]>()
      .mockResolvedValue([{ id, name: "Tango", state: "active", version: 1 }]),
    save: vi
      .fn<DisciplineActions["save"]>()
      .mockResolvedValue({ operation_id: id, primary_id: id, related: [], replayed: false }),
    status: vi.fn<DisciplineActions["status"]>(),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
async function choose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini düzenle" }));
  await screen.findByRole("option", { name: "Tango" });
  await user.selectOptions(screen.getByLabelText("Disiplin", { exact: true }), id);
}
test("catalog failure offers retry without submitting a relationship", async () => {
  const api = actions();
  api.list.mockRejectedValueOnce(new TypeError("Network unavailable"));
  const user = userEvent.setup();
  render(
    <PersonDisciplines scope={scope} person={person} actions={api} onSaved={vi.fn<() => void>()} />,
  );
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini düzenle" }));
  await user.click(await screen.findByRole("button", { name: "Yeniden dene" }));
  await screen.findByRole("option", { name: "Tango" });
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(api.save).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
test("new relationship uses selected center without a fabricated version and refreshes after commit", async () => {
  const api = actions();
  const saved = vi.fn<() => void>();
  const user = userEvent.setup();
  render(<PersonDisciplines scope={scope} person={person} actions={api} onSaved={saved} />);
  expect(api.list).not.toHaveBeenCalled();
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(api.save).toHaveBeenCalledWith(
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: person.id,
      discipline_id: id,
      kind: "student",
      state: "active",
    }),
  );
  expect(api.save.mock.calls[0][0]).not.toHaveProperty("expected_version");
  expect(sessionStorage.length).toBe(0);
});
test("existing inactive catalog relationship can be deactivated with its own version", async () => {
  const api = actions();
  api.list.mockResolvedValue([{ id, name: "Tango", state: "inactive", version: 99 }]);
  const user = userEvent.setup();
  render(
    <PersonDisciplines
      scope={scope}
      person={{
        ...person,
        discipline_relationships: [
          {
            center_id: scope.centerId,
            discipline_id: id,
            kind: "student",
            state: "active",
            version: 7,
          },
        ],
      }}
      actions={api}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await choose(user);
  await user.selectOptions(screen.getByLabelText("Disiplin öğrenciliği durumu"), "inactive");
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(api.save.mock.calls[0][0]).toMatchObject({ expected_version: 7, state: "inactive" });
});
test("lost response survives remount and replays the exact command", async () => {
  const api = actions();
  api.save.mockRejectedValueOnce(new Error("lost"));
  const saved = vi.fn<() => void>();
  const user = userEvent.setup();
  const view = render(
    <PersonDisciplines scope={scope} person={person} actions={api} onSaved={saved} />,
  );
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
  await screen.findByText(/İşlemin sonucu doğrulanamadı/);
  const command = api.save.mock.calls[0][0];
  view.unmount();
  render(<PersonDisciplines scope={scope} person={person} actions={api} onSaved={saved} />);
  api.status.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "NOT_FOUND", retryable: false, trace_id: "synthetic-trace" },
    }),
  );
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await user.click(screen.getByRole("button", { name: /Aynı isteği/i }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(api.save.mock.calls[1][0]).toEqual(command);
});
test.each([false, true])(
  "expired receipt blocks replay when storage fails: %s",
  async (storageFails) => {
    const api = actions();
    api.save.mockRejectedValue(new Error("lost"));
    const user = userEvent.setup();
    render(
      <PersonDisciplines
        scope={scope}
        person={person}
        actions={api}
        onSaved={vi.fn<() => void>()}
      />,
    );
    await choose(user);
    await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
    await screen.findByText(/İşlemin sonucu doğrulanamadı/);
    const key = api.save.mock.calls[0][0].operation_key;
    api.status.mockResolvedValue({
      operation: "person_discipline_set_v1",
      key,
      status: "result_expired",
      result_available: false,
      result_reference: null,
    });
    if (storageFails)
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage blocked after request");
      });
    await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Aynı isteği/i })).not.toBeInTheDocument(),
    );
    if (!storageFails) {
      api.status.mockResolvedValue({
        operation: "person_discipline_set_v1",
        key,
        status: "in_progress",
        result_available: false,
        result_reference: null,
      });
      await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
    }
    expect(screen.queryByRole("button", { name: /Aynı isteği/i })).not.toBeInTheDocument();
    expect(api.save).toHaveBeenCalledTimes(1);
  },
);
test("blocked storage prevents a write and retains an explicit recovery error", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(
    <PersonDisciplines scope={scope} person={person} actions={api} onSaved={vi.fn<() => void>()} />,
  );
  await choose(user);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
  await screen.findByRole("alert");
  expect(api.save).not.toHaveBeenCalled();
});

test("recovered expired save cannot replay after storage failure and remount", async () => {
  const api = actions();
  api.save.mockRejectedValue(new Error("response lost"));
  const user = userEvent.setup();
  const view = render(
    <PersonDisciplines scope={scope} person={person} actions={api} onSaved={vi.fn<() => void>()} />,
  );
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Disiplin ilişkisini kaydet" }));
  await screen.findByText(/İşlemin sonucu doğrulanamadı/);
  api.status.mockResolvedValue({
    operation: "person_discipline_set_v1",
    key: api.save.mock.calls[0][0].operation_key,
    status: "result_expired",
    result_available: false,
    result_reference: null,
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await screen.findByText(/Bekleyen işlem kaydı güvenle okunamadı/);
  view.unmount();
  render(
    <PersonDisciplines scope={scope} person={person} actions={api} onSaved={vi.fn<() => void>()} />,
  );
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await screen.findByText(/Bekleyen işlem kaydı güvenle okunamadı/);
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(api.save).toHaveBeenCalledTimes(1);
});
