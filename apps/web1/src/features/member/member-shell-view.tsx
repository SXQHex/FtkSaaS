import type { ReactNode } from "react";
import { LinkButton } from "../../components/ui/button";
export function MemberShellView({
  brand,
  subtitle,
  navigationLabel,
  links,
  actions,
  linksDisabled = false,
  children,
}: {
  brand: string;
  subtitle: string;
  navigationLabel: string;
  links: { id: string; label: string; href?: string; icon: ReactNode; current: boolean }[];
  actions?: ReactNode;
  linksDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid h-dvh max-w-5xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden text-sm lg:grid-cols-[auto_1fr] lg:grid-rows-[auto_1fr]">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 lg:col-start-1 lg:row-start-1">
        <div className="min-w-0">
          <p className="break-words font-semibold">{brand}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {actions}
      </header>
      <nav
        aria-label={navigationLabel}
        className="z-30 col-start-1 row-start-3 border-t bg-background px-1 py-2 lg:static lg:col-start-2 lg:row-start-1 lg:self-stretch lg:border-t-0 lg:border-b lg:px-4"
      >
        <ul className="grid grid-cols-5 items-stretch gap-1 lg:flex lg:h-full lg:flex-wrap lg:items-center lg:justify-end">
          {links.map((link) => (
            <li key={link.id} className="min-w-0">
              <LinkButton
                href={link.href}
                isDisabled={linksDisabled || !link.href}
                variant={link.current ? "secondary" : "ghost"}
                aria-current={link.current ? "page" : undefined}
                className={`h-full w-full min-w-0 flex-col gap-1 px-1 py-2 text-center text-xs lg:flex-row lg:px-3 lg:text-sm ${link.current ? "font-bold underline decoration-2 underline-offset-4" : ""}`}
              >
                <span aria-hidden="true">{link.icon}</span>
                <span className="break-words">{link.label}</span>
              </LinkButton>
            </li>
          ))}
        </ul>
      </nav>
      <main className="col-start-1 row-start-2 min-h-0 min-w-0 overflow-y-auto overscroll-contain lg:col-span-2">
        {children}
      </main>
    </div>
  );
}
