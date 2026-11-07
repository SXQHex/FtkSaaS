import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import type { PublicCalendarItem } from "@ftksaas/api-contracts";
import { render } from "./render";
import { PublicApplication } from "../src/components/public/public-application";
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (s: string) => void }) => (
    <button type="button" onClick={() => onSuccess(v7())}>
      Synthetic fresh proof
    </button>
  ),
}));
const publication = { publication_id: v7(), title: "Synthetic public class" } as PublicCalendarItem;
beforeEach(() => sessionStorage.clear());
test("uncertain public submit retries the same business key with fresh proof after remount", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(Error("lost response"))
    .mockResolvedValueOnce(Response.json({ ok: true, data: { accepted: true } }));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup(),
    first = render(<PublicApplication publication={publication} siteKey="synthetic" />);
  await user.type(screen.getByLabelText("E-posta adresi"), "student@example.invalid");
  await user.click(screen.getByRole("button", { name: "Synthetic fresh proof" }));
  await user.click(screen.getByRole("button", { name: "Başvuruyu gönder" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("E-posta adresi")).toBeDisabled();
  const original = JSON.parse(fetcher.mock.calls[0]![1]!.body as string),
    stored = sessionStorage.getItem(`ftksaas:public-application:${publication.publication_id}`)!;
  expect(stored).not.toContain(original.bot_proof);
  first.unmount();
  render(<PublicApplication publication={publication} siteKey="synthetic" />);
  expect(screen.getByRole("button", { name: "Aynı başvuruyu yeniden gönder" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Synthetic fresh proof" }));
  await user.click(screen.getByRole("button", { name: "Aynı başvuruyu yeniden gönder" }));
  expect(
    await screen.findByText("Başvurun alındı. Kesin kayıt için işletmenin dönüşünü bekle."),
  ).toBeVisible();
  const replay = JSON.parse(fetcher.mock.calls[1]![1]!.body as string);
  expect(replay.client_request_key).toBe(original.client_request_key);
  expect(replay.contact).toBe(original.contact);
  expect(replay.bot_proof).not.toBe(original.bot_proof);
  expect(
    sessionStorage.getItem(`ftksaas:public-application:${publication.publication_id}`),
  ).toBeNull();
  vi.unstubAllGlobals();
});
test("definitive validation rejection unlocks email correction rather than trapping a bad request", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ ok: false, error: { code: "VALIDATION_FAILED", retryable: false } }),
    );
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<PublicApplication publication={publication} siteKey="synthetic" />);
  await user.type(screen.getByLabelText("E-posta adresi"), "student@example.invalid");
  await user.click(screen.getByRole("button", { name: "Synthetic fresh proof" }));
  await user.click(screen.getByRole("button", { name: "Başvuruyu gönder" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("E-posta adresi")).toBeEnabled();
  expect(
    sessionStorage.getItem(`ftksaas:public-application:${publication.publication_id}`),
  ).toBeNull();
  vi.unstubAllGlobals();
});
