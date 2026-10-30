import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { NextIntlClientProvider, useFormatter, useTimeZone, useTranslations } from "next-intl";
import { Providers } from "../src/components/providers";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
afterEach(() => vi.restoreAllMocks());

function browserTimezone(timeZone: string) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...original.call(this), timeZone };
  });
}

const instant = new Date("2026-10-30T00:00:00Z");
const timeOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
function Dates() {
  const format = useFormatter();
  const t = useTranslations();
  const timeZone = useTimeZone();
  return (
    <>
      <p>{t("label")}</p>
      <output data-testid="time-zone">{timeZone}</output>
      <time data-testid="device-time">{format.dateTime(instant, timeOptions)}</time>
      <time data-testid="center-time">
        {format.dateTime(instant, { ...timeOptions, timeZone: "Asia/Tokyo" })}
      </time>
    </>
  );
}
function App({ locale = "en" }: { locale?: "en" | "tr" }) {
  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ label: "Inherited message" }}
    >
      <Providers>
        <Dates />
      </Providers>
    </NextIntlClientProvider>
  );
}

test.each(["Europe/Istanbul", "America/New_York", "UTC"])(
  "browser timezone %s becomes the shared formatter default without changing a center override",
  async (timeZone) => {
    browserTimezone(timeZone);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("time-zone")).toHaveTextContent(timeZone));
    expect(screen.getByTestId("device-time")).toHaveTextContent(
      new Intl.DateTimeFormat("en", { ...timeOptions, timeZone }).format(instant),
    );
    expect(screen.getByTestId("center-time")).toHaveTextContent("09:00");
    expect(screen.getByText("Inherited message")).toBeVisible();
  },
);

test("server output hydrates without a mismatch before adopting the browser timezone", async () => {
  browserTimezone("Europe/Istanbul");
  const html = renderToString(<App locale="tr" />);
  expect(html).toContain('data-testid="device-time">00:00');
  expect(html).toContain('data-testid="time-zone">UTC');
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const recoverableError = vi.fn<(error: unknown) => void>();
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <App locale="tr" />, { onRecoverableError: recoverableError });
    });
    expect(screen.getByTestId("device-time")).toHaveTextContent("03:00");
    expect(screen.getByTestId("center-time")).toHaveTextContent("09:00");
    expect(recoverableError).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});
