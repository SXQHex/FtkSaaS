import "../../i18n";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./appearance", async (original) => ({
  ...(await original<typeof import("./appearance")>()),
  saveTheme: save,
}));
import { BackendError } from "../../lib/backend";
import { AppearancePanel } from "./appearance-panel";
import type { ThemeSnapshot } from "./appearance";
afterEach(() => vi.resetAllMocks());
const base: ThemeSnapshot = { theme: "system", version: 0, writable: true };
function Harness({
  refresh,
  initial = base,
}: {
  refresh: () => Promise<ThemeSnapshot>;
  initial?: ThemeSnapshot;
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
  render(<Harness initial={{ ...base, writable: false }} refresh={vi.fn()} />);
  expect(screen.getByRole("radio", { name: "Koyu" })).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});
it("retries an unknown write with the identical intent and version, preserving the latest read", async () => {
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({});
  const refresh = vi
    .fn()
    .mockResolvedValueOnce(base)
    .mockResolvedValueOnce({ ...base, theme: "dark", version: 4 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  const retry = await screen.findByRole("button", { name: "Aynı isteği yeniden dene" });
  expect(screen.getByRole("radio", { name: "Açık" })).toBeDisabled();
  await userEvent.click(retry);
  await screen.findByText("Tema tercihi kaydedildi.");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
  expect(save.mock.calls[0][0]).toMatchObject({ theme: "dark", version: 0 });
  expect(screen.getByRole("radio", { name: "Koyu" })).toHaveAttribute("aria-checked", "true");
});
it("retries only reads after an acknowledged write and blocks another selection until reread", async () => {
  save.mockResolvedValue({});
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new Error("read"))
    .mockResolvedValueOnce({ ...base, theme: "light", version: 2 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Açık" }));
  await screen.findByText("Tema kaydedildi. Güncel tercih okunamadı.");
  expect(screen.getByRole("radio", { name: "Koyu" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await screen.findByText("Tema tercihi kaydedildi.");
  expect(save).toHaveBeenCalledTimes(1);
});
it("requires explicit reload after version conflict and creates a new intent from the returned version", async () => {
  save
    .mockRejectedValueOnce(
      new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: "fixture" }),
    )
    .mockResolvedValueOnce({});
  const refresh = vi.fn().mockResolvedValue({ ...base, theme: "light", version: 9 });
  render(<Harness refresh={refresh} />);
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  await screen.findByText("Tercih başka bir işlemle değişti.", { exact: false });
  expect(
    screen.queryByRole("button", { name: "Aynı isteği yeniden dene" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Güncel tercihi yükle" }));
  await waitFor(() => expect(screen.getByRole("radio", { name: "Koyu" })).toBeEnabled());
  await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
  await screen.findByText("Tema tercihi kaydedildi.");
  expect(save.mock.calls[1][0]).toMatchObject({ theme: "dark", version: 9 });
  expect(save.mock.calls[1][0].key).not.toBe(save.mock.calls[0][0].key);
});
