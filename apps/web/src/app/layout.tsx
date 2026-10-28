import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "../components/providers";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: { default: "FtkSaaS", template: "%s · FtkSaaS" }, description: t("description") };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">{t("skip")}</a>
        <NextIntlClientProvider><Providers>{children}</Providers></NextIntlClientProvider>
      </body>
    </html>
  );
}
