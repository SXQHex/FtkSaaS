import type { ReactElement } from "react";
import { render as renderComponent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import en from "../messages/en.json";
export function render(component: ReactElement, locale: "tr" | "en" = "tr") {
  return renderComponent(<NextIntlClientProvider locale={locale} messages={locale === "en" ? en : tr} timeZone="UTC">{component}</NextIntlClientProvider>);
}
