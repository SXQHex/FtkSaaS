import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Preview } from "@ftksaas/api-contracts";
import { render } from "./render";
import { ApiFailure } from "../src/lib/api";
import { PersonMerge } from "../src/components/students/person-merge";
import {
  sampleStudents,
  sampleStudentScope as scope,
} from "../src/components/admin/student-fixtures";
import type { MergeActions } from "../src/lib/student-management";
const source = sampleStudents[0],
  target = sampleStudents[1];
const id = "019a2b3c-4d5e-7000-8000-000000000090";
function preview(): Preview {
  return {
    id,
    token: "synthetic-preview-proof",
    scope_hash: "synthetic",
    expires_at: "2099-01-01T00:00:00Z",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [],
    blockers: [],
    merge_summary: {
      source_id: source.id,
      target_id: target.id,
      affected_center_ids: [scope.centerId],
      required_approval_center_ids: [],
      linked_history: true,
    },
  };
}
function actions() {
  return {
    search: vi.fn<MergeActions["search"]>().mockResolvedValue({
      items: [source, target],
      next_cursor: null,
      as_of: "2030-01-01T00:00:00Z",
    }),
    preview: vi.fn<MergeActions["preview"]>().mockResolvedValue(preview()),
    apply: vi
      .fn<MergeActions["apply"]>()
      .mockResolvedValue({ operation_id: id, primary_id: target.id, related: [], replayed: false }),
    status: vi.fn<MergeActions["status"]>(),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
async function inspect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Birleştirmeyi başlat" }));
  await user.click(screen.getByRole("button", { name: "Ara" }));
  await user.click(await screen.findByRole("button", { name: target.display_name }));
  await user.click(screen.getByRole("button", { name: "Birleştirme etkilerini incele" }));
  await screen.findByRole("button", { name: "Kayıtları birleştirmeyi onayla" });
}
test("merge searches actual people, previews the selected direction, and applies only on explicit confirmation", async () => {
  const api = actions(),
    done = vi.fn<(id: string) => void>();
  const user = userEvent.setup();
  render(<PersonMerge scope={scope} person={source} actions={api} onMerged={done} />);
  await inspect(user);
  expect(api.search).toHaveBeenCalledWith(scope.orgId, scope.centerId, "", undefined);
  expect(screen.queryByRole("button", { name: source.display_name })).not.toBeInTheDocument();
  expect(api.preview).toHaveBeenCalledWith({
    org_id: scope.orgId,
    center_id: scope.centerId,
    source_id: source.id,
    target_id: target.id,
  });
  expect(api.apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(target.id));
  expect(api.apply.mock.calls[0][0]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    preview: { id, token: "synthetic-preview-proof" },
  });
  expect(sessionStorage.length).toBe(0);
});
test.each(["blockers", "approvals", "expired"] as const)(
  "%s preview cannot apply",
  async (kind) => {
    const api = actions(),
      p = preview();
    if (kind === "blockers")
      p.blockers = [{ code: "ACCOUNT_LINK_CONFLICT", retryable: false, trace_id: id }];
    if (kind === "approvals") p.merge_summary!.required_approval_center_ids = ["other-center"];
    if (kind === "expired") p.expires_at = "2000-01-01T00:00:00Z";
    api.preview.mockResolvedValue(p);
    const user = userEvent.setup();
    render(
      <PersonMerge
        scope={scope}
        person={source}
        actions={api}
        onMerged={vi.fn<(id: string) => void>()}
      />,
    );
    await inspect(user);
    expect(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" })).toBeDisabled();
    expect(api.apply).not.toHaveBeenCalled();
  },
);
test("changing the target search discards the prior preview", async () => {
  const api = actions();
  const user = userEvent.setup();
  render(
    <PersonMerge
      scope={scope}
      person={source}
      actions={api}
      onMerged={vi.fn<(id: string) => void>()}
    />,
  );
  await inspect(user);
  await user.type(screen.getByLabelText("Hedef kişiyi ara"), "new search");
  expect(
    screen.queryByRole("button", { name: "Kayıtları birleştirmeyi onayla" }),
  ).not.toBeInTheDocument();
  expect(api.apply).not.toHaveBeenCalled();
});
test("lost merge response survives remount and reuses its exact payload", async () => {
  const api = actions(),
    done = vi.fn<(id: string) => void>();
  api.apply.mockRejectedValueOnce(new Error("lost response"));
  const user = userEvent.setup();
  const view = render(<PersonMerge scope={scope} person={source} actions={api} onMerged={done} />);
  await inspect(user);
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await screen.findByText(/Birleştirmenin sonucu doğrulanamadı/);
  const command = api.apply.mock.calls[0][0];
  view.unmount();
  render(<PersonMerge scope={scope} person={source} actions={api} onMerged={done} />);
  api.status.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "NOT_FOUND", retryable: false, trace_id: "synthetic-trace" },
    }),
  );
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await user.click(screen.getByRole("button", { name: "Aynı isteği tekrar gönder" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(target.id));
  expect(api.apply.mock.calls[1][0]).toEqual(command);
});
test("canonical target returned after a committed merge retains the source operation recovery", async () => {
  const api = actions();
  const done = vi.fn<(id: string) => void>();
  api.apply.mockRejectedValueOnce(new Error("response lost after commit"));
  const user = userEvent.setup();
  const view = render(<PersonMerge scope={scope} person={source} actions={api} onMerged={done} />);
  await inspect(user);
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await screen.findByText(/Birleştirmenin sonucu doğrulanamadı/);
  const command = api.apply.mock.calls[0][0];
  view.unmount();
  render(
    <PersonMerge
      scope={scope}
      person={{ ...target, linked_person_ids: [source.id] }}
      actions={api}
      onMerged={done}
    />,
  );
  expect(screen.queryByRole("button", { name: "Birleştirmeyi başlat" })).not.toBeInTheDocument();
  api.status.mockResolvedValue({
    operation: "person_merge_apply_v1",
    key: command.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "people", id: target.id },
  });
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(target.id));
  expect(api.apply).toHaveBeenCalledTimes(1);
  expect(sessionStorage.length).toBe(0);
});
test("a receipt for another target never reports a successful merge", async () => {
  const api = actions(),
    done = vi.fn<(id: string) => void>();
  api.apply.mockRejectedValue(new Error("lost response"));
  const user = userEvent.setup();
  render(<PersonMerge scope={scope} person={source} actions={api} onMerged={done} />);
  await inspect(user);
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await screen.findByText(/Birleştirmenin sonucu doğrulanamadı/);
  api.status.mockResolvedValue({
    operation: "person_merge_apply_v1",
    key: api.apply.mock.calls[0][0].operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "people", id: source.id },
  });
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByText(/Birleştirmenin sonucu doğrulanamadı/)).toBeVisible();
});

test("expired merge receipt fails closed when blocked state cannot be persisted", async () => {
  const api = actions();
  api.apply.mockRejectedValue(new Error("response lost"));
  const user = userEvent.setup();
  render(
    <PersonMerge
      scope={scope}
      person={source}
      actions={api}
      onMerged={vi.fn<(id: string) => void>()}
    />,
  );
  await inspect(user);
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await screen.findByText(/Birleştirmenin sonucu doğrulanamadı/);
  api.status.mockResolvedValue({
    operation: "person_merge_apply_v1",
    key: api.apply.mock.calls[0][0].operation_key,
    status: "result_expired",
    result_available: false,
    result_reference: null,
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage blocked after request");
  });
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await screen.findByText(/Bekleyen işlem kaydı güvenle okunamadı/);
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(api.apply).toHaveBeenCalledTimes(1);
});

test("recovered expired apply cannot replay after storage failure and remount", async () => {
  const api = actions();
  api.apply.mockRejectedValue(new Error("response lost"));
  const user = userEvent.setup();
  const view = render(
    <PersonMerge
      scope={scope}
      person={source}
      actions={api}
      onMerged={vi.fn<(id: string) => void>()}
    />,
  );
  await inspect(user);
  await user.click(screen.getByRole("button", { name: "Kayıtları birleştirmeyi onayla" }));
  await screen.findByText(/Birleştirmenin sonucu doğrulanamadı/);
  api.status.mockResolvedValue({
    operation: "person_merge_apply_v1",
    key: api.apply.mock.calls[0][0].operation_key,
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
    <PersonMerge
      scope={scope}
      person={source}
      actions={api}
      onMerged={vi.fn<(id: string) => void>()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sonucu kontrol et" }));
  await screen.findByText(/Bekleyen işlem kaydı güvenle okunamadı/);
  expect(
    screen.queryByRole("button", { name: "Aynı isteği tekrar gönder" }),
  ).not.toBeInTheDocument();
  expect(api.apply).toHaveBeenCalledTimes(1);
});
