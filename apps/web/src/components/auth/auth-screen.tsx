import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Users, Building2 } from "lucide-react";
import { Preferences } from "../preferences";

// Adapted from shadcn login-02/signup-02. Provenance: packages/ui/registry-sources.json.
export async function AuthScreen({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="auth-screen grid min-h-svh outline-none lg:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 font-semibold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm text-primary-foreground">
              FT
            </span>
            FtkSaaS
          </Link>
          <Preferences />
        </header>
        <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <div className="w-full min-w-0 max-w-sm">{children}</div>
        </div>
        <footer className="text-xs text-muted-foreground">{t("brandFooter")}</footer>
      </div>
      <aside
        aria-label={t("brandTitle")}
        className="m-4 ml-0 hidden min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-muted/60 p-12 lg:flex xl:p-16"
      >
        <span className="text-sm text-muted-foreground">{t("brandFooter")}</span>
        <div className="my-16 max-w-lg">
          <div className="mb-10 grid grid-cols-3 gap-3" aria-hidden="true">
            {[CalendarDays, Users, Building2].map((Icon, index) => (
              <div
                key={index}
                className="flex aspect-square items-center justify-center rounded-2xl border bg-background/70"
              >
                <Icon className="size-10 stroke-[1.25] text-foreground/70" />
              </div>
            ))}
          </div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            {t("brandTitle")}
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
            {t("brandDescription")}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{t("brandCaption")}</p>
      </aside>
    </main>
  );
}
