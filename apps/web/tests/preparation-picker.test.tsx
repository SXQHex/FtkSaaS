import { NextIntlClientProvider } from "next-intl";
import { beforeEach, test, expect, vi, afterEach } from "vitest";
import { screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { PreparationPicker } from "../src/components/settings/preparation-picker";
import { setupCall } from "../src/lib/studio-setup";
import { preparationKey } from "../src/lib/agreement-preparations";
import tr from "../messages/tr.json";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  source = { scope: "center" as const, center_id: scope.centerId, key: "daily", version: 7 };
const catalog = {
  scope: "center",
  preparation_templates: {
    permissions: [
      {
        source,
        template: {
          key: "daily",
          name: "Daily",
          grants: [{ permission: "sale.write", enabled: true }],
        },
      },
    ],
  },
};
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());
test("template resolution carries the actual source version and prepares a draft without invoking a writer", async () => {
  vi.mocked(setupCall)
    .mockResolvedValue(catalog as never)
    .mockResolvedValueOnce(catalog as never)
    .mockResolvedValueOnce({
      kind: "permission",
      source,
      permission_requests: [{ permission: "sale.write", enabled: true }],
    } as never);
  const resolved = vi.fn<(value: unknown) => void>();
  render(<PreparationPicker scope={scope} kind="permission" onResolved={resolved} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: tr.settingsEditor.prepare }));
  await user.selectOptions(
    await screen.findByRole("combobox", { name: tr.settingsEditor.template }),
    preparationKey(source),
  );
  await user.click(screen.getAllByRole("button", { name: tr.settingsEditor.prepare }).at(-1)!);
  expect(resolved).toHaveBeenCalledWith({
    kind: "permission",
    source,
    permission_requests: [{ permission: "sale.write", enabled: true }],
  });
  expect(setupCall).toHaveBeenLastCalledWith("settings_preparation_resolve_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    kind: "permission",
    source,
  });
  expect(vi.mocked(setupCall).mock.calls.map((c) => c[0])).toEqual([
    "settings_catalog_get_v1",
    "settings_preparation_resolve_v1",
  ]);
});
test("a late template result cannot populate a different person's permission editor", async () => {
  let finish!: (v: never) => void;
  vi.mocked(setupCall)
    .mockResolvedValue(catalog as never)
    .mockResolvedValueOnce(catalog as never)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const resolved = vi.fn<(value: unknown) => void>(),
    user = userEvent.setup(),
    view = render(
      <PreparationPicker scope={scope} kind="permission" contextKey="A" onResolved={resolved} />,
    );
  await user.click(screen.getByRole("button", { name: tr.settingsEditor.prepare }));
  await user.selectOptions(
    await screen.findByRole("combobox", { name: tr.settingsEditor.template }),
    preparationKey(source),
  );
  await user.click(screen.getAllByRole("button", { name: tr.settingsEditor.prepare }).at(-1)!);
  await waitFor(() => expect(setupCall).toHaveBeenCalledTimes(2));
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <PreparationPicker scope={scope} kind="permission" contextKey="B" onResolved={resolved} />
    </NextIntlClientProvider>,
  );
  await act(async () =>
    finish({
      kind: "permission",
      source,
      permission_requests: [{ permission: "sale.write", enabled: true }],
    } as never),
  );
  expect(resolved).not.toHaveBeenCalled();
});
