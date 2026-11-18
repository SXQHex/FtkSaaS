import { Link as AriaLink } from "react-aria-components";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LinkButton } from "../../components/ui/button";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";

export function PublicShell({
  name,
  description,
  calendarHref,
  applyHref,
  children,
}: {
  name?: string;
  description?: string;
  calendarHref: string;
  applyHref?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#public-main" className="sr-only focus:not-sr-only focus:block focus:p-3">
        {t(($) => $.publicProgram.skip)}
      </a>
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-3xl flex-wrap items-center gap-4 px-4 py-2">
          {name && (
            <Avatar aria-hidden="true">
              <AvatarFallback>
                {name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toLocaleUpperCase("tr")}
              </AvatarFallback>
            </Avatar>
          )}
          <AriaLink
            href={calendarHref}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="block break-words font-semibold">
              {name ?? t(($) => $.publicProgram.program)}
            </span>
            {description && (
              <span className="block break-words text-sm text-muted-foreground">{description}</span>
            )}
          </AriaLink>
          <nav aria-label={t(($) => $.publicProgram.menu)} className="flex flex-wrap gap-1">
            <LinkButton href={calendarHref} variant="ghost" size="sm">
              {t(($) => $.publicProgram.program)}
            </LinkButton>
            {applyHref && (
              <LinkButton href={applyHref} variant="outline" size="sm">
                {t(($) => $.publicProgram.apply)}
              </LinkButton>
            )}
          </nav>
        </div>
      </header>
      <main id="public-main" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-6 pb-12">
        {children}
      </main>
      <footer className="mx-auto max-w-3xl border-t p-4 text-xs text-muted-foreground">
        {t(($) => $.publicProgram.footer)}
      </footer>
    </div>
  );
}
