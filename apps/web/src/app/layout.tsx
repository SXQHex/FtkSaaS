import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Providers } from "../components/providers";
export const metadata: Metadata = {
  title: { default: "FtkSaaS", template: "%s · FtkSaaS" },
  description: "Stüdyo yönetim alanı",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          İçeriğe geç
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
