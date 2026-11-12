import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { I18nProvider } from "react-aria-components";
import { i18n } from "../i18n";
import { SchemaForm } from "./schema-form";

function setup() {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <I18nProvider locale="tr-TR">
        <SchemaForm onSubmit={onSubmit} />
      </I18nProvider>
    </I18nextProvider>,
  );
  return { user, onSubmit, input: screen.getByRole("textbox", { name: "Örnek metin" }) };
}

describe("Standard Schema form with React Aria", () => {
  it("rejects an empty required field and associates the accessible error", async () => {
    const { user, onSubmit, input } = setup();
    expect(input).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Örneği gönder" }));
    expect(await screen.findByText("Bu alan zorunludur.")).toBeVisible();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Bu alan zorunludur.");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rejects an invalid value, clears the error on correction, and submits", async () => {
    const { user, onSubmit, input } = setup();
    await user.type(input, "ab");
    await user.tab();
    expect(await screen.findByText("En az 3 karakter girin.")).toBeVisible();
    expect(input).toHaveAccessibleDescription("En az 3 karakter girin.");
    await user.click(screen.getByRole("button", { name: "Örneği gönder" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(input, "c");
    expect(screen.queryByText("En az 3 karakter girin.")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "Örneği gönder" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ text: "abc" });
    expect(await screen.findByRole("status")).toHaveTextContent("Örnek gönderildi.");
  });

  it("supports keyboard focus, blur validation and keyboard submission", async () => {
    const { user, onSubmit, input } = setup();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab();
    expect(await screen.findByText("Bu alan zorunludur.")).toBeVisible();
    await user.tab({ shift: true });
    expect(input).toHaveFocus();
    await user.keyboard("örnek");
    await user.tab();
    expect(screen.getByRole("button", { name: "Örneği gönder" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ text: "örnek" });
    expect(await screen.findByRole("status")).toHaveTextContent("Örnek gönderildi.");
  });
});
