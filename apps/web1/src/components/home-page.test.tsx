import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { I18nProvider } from "react-aria-components/I18nProvider";

import { i18n } from "../i18n";
import { HomePage } from "./home-page";

describe("HomePage", () => {
  it("renders Turkish translations and handles interaction", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <I18nProvider locale="tr-TR">
          <HomePage />
        </I18nProvider>
      </I18nextProvider>,
    );

    expect(screen.getByRole("heading", { name: "FtkSaaS" })).toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("Tıklama sayısı: 0");

    await user.click(screen.getByRole("button", { name: "Test Et" }));

    expect(screen.getByRole("status")).toHaveTextContent("Tıklama sayısı: 1");
  });
});
