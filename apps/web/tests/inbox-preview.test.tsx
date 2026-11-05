import { expect, test, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { InboxPreview } from "../src/components/admin/inbox-preview";
vi.mock("../src/components/preferences", () => ({
  Preferences: () => <p>Örnek görünüm tercihleri</p>,
}));
test("synthetic preview preserves the read filter and exposes only authorized history fields", async () => {
  const user = userEvent.setup();
  render(<InboxPreview />);
  const feed = () => within(screen.getByRole("region", { name: "Bildirim kutusu" }));
  await user.click(feed().getByRole("checkbox", { name: "Yalnız okunmamış" }));
  await user.click(await feed().findByRole("button", { name: "Kayıt geçmişi" }));
  const history = within(screen.getByRole("dialog"));
  await history.findByText("Örnek yönetici");
  expect(screen.queryByText("private-new")).not.toBeInTheDocument();
  expect(screen.queryByText("private-old")).not.toBeInTheDocument();
  await user.click(history.getByRole("button", { name: "Sonraki sayfa" }));
  await history.findByText("İkinci örnek aktör");
  await user.keyboard("{Escape}");
  await user.click(feed().getByRole("button", { name: "Okundu olarak işaretle" }));
  await user.click(await feed().findByRole("button", { name: "Okundu olarak onayla" }));
  await feed().findByText("Okunmuş", { exact: true });
  expect(feed().getByRole("checkbox")).not.toBeChecked();
  expect(feed().getByRole("heading", { name: "Bildirim kutusu" })).toHaveFocus();
});
test("synthetic lost-response status recovery and preference save reuse source components", async () => {
  const user = userEvent.setup();
  render(<InboxPreview />);
  const preferences = () => within(screen.getByRole("region", { name: "Bildirim tercihleri" }));
  await user.click(await preferences().findByRole("checkbox"));
  await user.click(preferences().getByRole("button", { name: "Değişikliği incele" }));
  await user.click(preferences().getByRole("button", { name: "Tercihimi kaydet" }));
  await preferences().findByText("Uygulama içi pazarlama açık.");
  expect(preferences().getByRole("heading")).toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: "Sonraki okundu işleminde yanıt kaybını örnekle" }),
  );
  const feed = () => within(screen.getByRole("region", { name: "Bildirim kutusu" }));
  await user.click(await feed().findByRole("button", { name: "Okundu olarak işaretle" }));
  await user.click(await feed().findByRole("button", { name: "Okundu olarak onayla" }));
  await feed().findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  await user.click(feed().getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await feed().findByText("Bu görünümde bildirim yok.");
  expect(preferences().getByRole("checkbox")).toBeChecked();
});

test("an unsaved marketing approval survives unrelated inbox preview actions", async () => {
  const user = userEvent.setup();
  render(<InboxPreview />);
  const preferences = within(screen.getByRole("region", { name: "Bildirim tercihleri" }));
  await user.click(await preferences.findByRole("checkbox"));
  await user.click(preferences.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(
    screen.getByRole("button", { name: "Sonraki okundu işleminde yanıt kaybını örnekle" }),
  );
  expect(preferences.getByRole("checkbox")).toBeChecked();
  expect(preferences.getByRole("button", { name: "Tercihimi kaydet" })).toBeInTheDocument();
});
