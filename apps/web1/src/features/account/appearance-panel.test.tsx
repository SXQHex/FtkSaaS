import "../../i18n";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./appearance", async (original) => ({
  ...(await original<typeof import("./appearance")>()),
  saveAppearance: save,
}));
import { BackendError } from "../../lib/backend";
import { AppearancePanel } from "./appearance-panel";
import type { AppearanceSnapshot } from "./appearance";
afterEach(() => vi.resetAllMocks());
const base: AppearanceSnapshot = {
  values: { theme: "system", font_scale: null },
  version: 0,
  writable: { theme: true, font_scale: true },
};
function Harness({
  refresh,
  initial = base,
}: {
  refresh: () => Promise<AppearanceSnapshot>;
  initial?: AppearanceSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <AppearancePanel
      snapshot={snapshot}
      readError={false}
      onRefresh={async () => {
        const next = await refresh();
        setSnapshot(next);
        return next;
      }}
    />
  );
}
it("obeys read-only catalog permission and sends no mutation", async () => {
  render(
    <Harness
      initial={{ ...base, writable: { theme: false, font_scale: false } }}
      refresh={vi.fn()}
    />,
  );
  expect(screen.getByRole("radio", { name: "Koyu" })).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});
it("retries an unknown write with the identical intent and version, preserving the latest read", async () => {
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({});
  const refresh = vi
    .fn()
    .mockResolvedValueOnce(base)
    .mockResolvedValueOnce({ ...base, values: { ...base.values, theme: "dark" }, version: 4 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  const retry = await screen.findByRole("button", { name: "Aynı isteği yeniden dene" });
  expect(screen.getByRole("radio", { name: "Açık" })).toBeDisabled();
  await userEvent.click(retry);
  await screen.findByText("Görünüm tercihi kaydedildi.");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
  expect(save.mock.calls[0][0]).toMatchObject({
    change: { field: "theme", value: "dark" },
    version: 0,
  });
  expect(screen.getByRole("radio", { name: "Koyu" })).toHaveAttribute("aria-checked", "true");
});
it("retries only reads after an acknowledged write and blocks another selection until reread", async () => {
  save.mockResolvedValue({});
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new Error("read"))
    .mockResolvedValueOnce({ ...base, values: { ...base.values, theme: "light" }, version: 2 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Açık" }));
  await screen.findByText("Tercih kaydedildi. Güncel görünüm okunamadı.");
  expect(screen.getByRole("radio", { name: "Koyu" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await screen.findByText("Görünüm tercihi kaydedildi.");
  expect(save).toHaveBeenCalledTimes(1);
});
it("requires explicit reload after version conflict and creates a new intent from the returned version", async () => {
  save
    .mockRejectedValueOnce(
      new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: "fixture" }),
    )
    .mockResolvedValueOnce({});
  const refresh = vi
    .fn()
    .mockResolvedValue({ ...base, values: { ...base.values, theme: "light" }, version: 9 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  await screen.findByText("Tercih başka bir işlemle değişti.", { exact: false });
  expect(
    screen.queryByRole("button", { name: "Aynı isteği yeniden dene" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Güncel tercihi yükle" }));
  await waitFor(() => expect(screen.getByRole("radio", { name: "Koyu" })).toBeEnabled());
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  await screen.findByText("Görünüm tercihi kaydedildi.");
  expect(save.mock.calls[1][0]).toMatchObject({
    change: { field: "theme", value: "dark" },
    version: 9,
  });
  expect(save.mock.calls[1][0].key).not.toBe(save.mock.calls[0][0].key);
});

it("keeps an arbitrary valid scale and independent field permissions, then resends only the frozen scale intent", async () => {
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({});
  const initial: AppearanceSnapshot = {
    ...base,
    values: { ...base.values, font_scale: 1.37 },
    writable: { theme: false, font_scale: true },
  };
  const refresh = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({
      ...initial,
      values: { ...initial.values, font_scale: null },
      version: 7,
    });
  render(<Harness initial={initial} refresh={refresh} />);
  const select = screen.getByRole("combobox", { name: "Ölçek" });
  expect(select).toHaveValue("1.37");
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("radio", { name: "Koyu" })).toBeDisabled();
  await userEvent.selectOptions(select, "system");
  await screen.findByRole("button", { name: "Aynı isteği yeniden dene" });
  expect(select).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Aynı isteği yeniden dene" }));
  await screen.findByText("Görünüm tercihi kaydedildi.");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]);
  expect(save.mock.calls[0][0]).toMatchObject({
    change: { field: "font_scale", value: null },
    version: 0,
  });
  expect(select).toHaveValue("system");
});
