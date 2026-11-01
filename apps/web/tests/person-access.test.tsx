import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { PersonAccess } from "../src/components/students/person-access";
import type { AccessActions, AccessOperation } from "../src/lib/person-access";
import { ApiFailure } from "../src/lib/api";
import {
  sampleStudents,
  sampleStudentScope as scope,
} from "../src/components/admin/student-fixtures";
const person = sampleStudents[0];
const id = "019a2b3c-4d5e-7000-8000-000000000080";
function item(operation: AccessOperation, actionable = true): ManagementStateView {
  const entity = {
    type:
      operation === "account_access_revoke_v1"
        ? ("invitations" as const)
        : ("account_links" as const),
    id,
  };
  return {
    operation,
    entity,
    exists: true,
    state: operation === "account_access_revoke_v1" ? "pending" : "active",
    versions: [{ entity, version: 7 }],
    as_of: "2026-11-02T00:00:00Z",
    current:
      operation === "account_access_revoke_v1"
        ? { operation, values: { person_id: person.id, invitation_id: id, actionable } }
        : { operation, values: { person_id: person.id, link_id: id, actionable } },
  };
}
function actions() {
  return {
    list: vi.fn<AccessActions["list"]>().mockImplementation(async (_scope, _person, operation) => ({
      items: [item(operation)],
      next_cursor: null,
      as_of: "2026-11-02T00:00:00Z",
    })),
    save: vi
      .fn<AccessActions["save"]>()
      .mockResolvedValue({ operation_id: id, primary_id: id, related: [], replayed: false }),
    status: vi.fn<AccessActions["status"]>(),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
test("reads both real selectors and requires explicit confirmation and link removal reason", async () => {
  const api = actions();
  const saved = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <PersonAccess scope={scope} personId={person.id} actions={api} revision={0} onSaved={saved} />,
  );
  await user.click(await screen.findByRole("button", { name: "Hesap bağlantısını kaldır" }));
  expect(api.save).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Kaldırmayı onayla" });
  expect(confirm).toBeDisabled();
  await user.type(screen.getByLabelText("Kaldırma gerekçesi"), "Yanlış kişi bağlantısı");
  await user.click(confirm);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(api.save).toHaveBeenCalledWith({
    operation: "account_link_remove_v1",
    input: expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      link_id: id,
      expected_version: 7,
      reason: "Yanlış kişi bağlantısı",
    }),
  });
  expect(api.list.mock.calls.filter((c) => c[2] === "account_link_remove_v1").length).toBe(2);
});
test("non-actionable records remain visible with no mutation control", async () => {
  const api = actions();
  api.list.mockImplementation(async (_s, _p, op) => ({
    items: [item(op, false)],
    next_cursor: null,
    as_of: "2026-11-02T00:00:00Z",
  }));
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await screen.findByText("Bekleyen davet");
  expect(screen.queryByRole("button", { name: "Daveti iptal et" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Hesap bağlantısını kaldır" }),
  ).not.toBeInTheDocument();
});
test("lost response survives remount and only replays the identical command after status check", async () => {
  const api = actions();
  api.save.mockRejectedValueOnce(new TypeError("lost"));
  api.status.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: id } }),
  );
  const user = userEvent.setup();
  const saved = vi.fn<() => void>();
  const view = render(
    <PersonAccess scope={scope} personId={person.id} actions={api} revision={0} onSaved={saved} />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  await user.click(screen.getByRole("button", { name: "İptali onayla" }));
  await screen.findByText(/Sonuç belirsiz/);
  const original = api.save.mock.calls[0][0];
  view.unmount();
  render(
    <PersonAccess scope={scope} personId={person.id} actions={api} revision={0} onSaved={saved} />,
  );
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Sonucu kontrol et" }));
  await user.click(await screen.findByRole("button", { name: "Aynı isteği tekrar gönder" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(api.save.mock.calls[1][0]).toEqual(original);
});
test("storage failure prevents sending the command", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  await user.click(screen.getByRole("button", { name: "İptali onayla" }));
  expect(api.save).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toBeVisible();
});

test("refresh discards a selected stale target before another command can be confirmed", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  expect(screen.getByRole("button", { name: "İptali onayla" })).toBeVisible();
  await user.click(screen.getAllByRole("button", { name: "Listeyi yenile" })[0]);
  expect(screen.queryByRole("button", { name: "İptali onayla" })).not.toBeInTheDocument();
  expect(api.save).not.toHaveBeenCalled();
});
test("expired receipt stays blocked across reopening and NOT_FOUND", async () => {
  const api = actions();
  const user = userEvent.setup();
  api.save.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "OPERATION_RESULT_EXPIRED", retryable: false, trace_id: id },
    }),
  );
  api.status.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: id } }),
  );
  const saved = vi.fn<() => void>();
  const view = render(
    <PersonAccess scope={scope} personId={person.id} actions={api} revision={0} onSaved={saved} />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  await user.click(screen.getByRole("button", { name: "İptali onayla" }));
  await screen.findByText(/Sonuç belirsiz/);
  view.unmount();
  render(
    <PersonAccess scope={scope} personId={person.id} actions={api} revision={0} onSaved={saved} />,
  );
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(saved).not.toHaveBeenCalled();
});
test("lost list permission clears visible records and offers refresh", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await screen.findByText("Bekleyen davet");
  api.list.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: id } }),
  );
  await user.click(screen.getAllByRole("button", { name: "Listeyi yenile" })[0]);
  await screen.findByRole("alert");
  expect(screen.queryByText("Bekleyen davet")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Daveti iptal et" })).not.toBeInTheDocument();
});
test("merged person discovery permits original-source records returned by the scoped backend", async () => {
  const api = actions();
  const user = userEvent.setup();
  api.list.mockImplementation(async (_scope, _person, operation) => {
    const record = item(operation);
    if (
      record.current?.operation === "account_access_revoke_v1" ||
      record.current?.operation === "account_link_remove_v1"
    )
      record.current.values.person_id = "019a2b3c-4d5e-7000-8000-000000000099";
    return { items: [record], next_cursor: null, as_of: "2026-11-02T00:00:00Z" };
  });
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  await user.click(screen.getByRole("button", { name: "İptali onayla" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
  expect(api.save.mock.calls[0][0].input).toMatchObject({ invitation_id: id, expected_version: 7 });
});
test("receipt expiry storage failure blocks replay and new commands", async () => {
  const api = actions();
  const user = userEvent.setup();
  api.save.mockRejectedValueOnce(new TypeError("lost"));
  api.status.mockResolvedValue({
    operation: "account_access_revoke_v1",
    key: id,
    status: "result_expired",
    result_available: false,
    result_reference: null,
  });
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Daveti iptal et" }));
  await user.click(screen.getByRole("button", { name: "İptali onayla" }));
  await screen.findByText(/Sonuç belirsiz/);
  const key = api.save.mock.calls[0][0].input.operation_key;
  api.status.mockResolvedValue({
    operation: "account_access_revoke_v1",
    key,
    status: "result_expired",
    result_available: false,
    result_reference: null,
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await screen.findByText(/Bekleyen işlem kaydı güvenle okunamadı/);
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Daveti iptal et" })).toBeDisabled();
  expect(api.save).toHaveBeenCalledTimes(1);
});
test("cursor conflict hides partial records and refresh restarts discovery from the first page", async () => {
  const api = actions();
  const user = userEvent.setup();
  api.list.mockImplementation(async (_scope, _person, operation, cursor) => {
    if (operation === "account_access_revoke_v1" && cursor)
      throw new ApiFailure({
        ok: false,
        error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
      });
    return {
      items: [item(operation)],
      next_cursor: operation === "account_access_revoke_v1" ? "scoped-next" : null,
      as_of: "2026-11-02T00:00:00Z",
    };
  });
  render(
    <PersonAccess
      scope={scope}
      personId={person.id}
      actions={api}
      revision={0}
      onSaved={vi.fn<() => void>()}
    />,
  );
  await screen.findByText("Bekleyen davet");
  await user.click(screen.getAllByRole("button", { name: "Sonraki sayfa" })[0]);
  await screen.findByRole("alert");
  expect(screen.queryByText("Bekleyen davet")).not.toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Listeyi yenile" })[0]);
  await screen.findByText("Bekleyen davet");
  expect(
    api.list.mock.calls
      .filter((call) => call[2] === "account_access_revoke_v1")
      .map((call) => call[3]),
  ).toEqual([undefined, "scoped-next", undefined]);
});
