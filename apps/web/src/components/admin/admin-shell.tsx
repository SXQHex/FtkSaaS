"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { cn } from "@ftksaas/ui/lib/utils";
import { Preferences } from "../preferences";

export const sections = [
  "overview",
  "schedule",
  "students",
  "packages",
  "finance",
  "reports",
  "studio",
  "settings",
  "inbox",
] as const;
export type AdminSection = (typeof sections)[number];
const icons = {
  overview: LayoutDashboard,
  schedule: CalendarDays,
  students: Users,
  packages: Package,
  finance: CreditCard,
  reports: ChartNoAxesCombined,
  studio: Building2,
  settings: Settings2,
  inbox: Bell,
};
const groups: AdminSection[][] = [
  ["overview", "schedule", "students"],
  ["packages", "finance", "reports"],
  ["studio", "settings"],
];

// sidebar-07 composition adapted to the existing shadcn primitives. No domain access decisions live here.
export function AdminShell({
  section,
  onNavigate,
  accountName,
  children,
  preview = false,
  onSignOut,
  signingOut = false,
}: {
  section: AdminSection;
  onNavigate: (section: AdminSection) => void;
  accountName: string;
  children: ReactNode;
  preview?: boolean;
  onSignOut?: () => void;
  signingOut?: boolean;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  function navigate(next: AdminSection) {
    onNavigate(next);
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
    // Wait for a closing modal's focus restoration before moving to the selected content.
    requestAnimationFrame(() => contentRef.current?.focus());
  }
  const initials = accountName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const searchResults = sections.filter((key) =>
    t(`nav.${key}`).toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  );
  function navigation(compact: boolean) {
    return (
      <>
        <div className={cn("flex h-20 items-center gap-3 px-5", compact && "justify-center px-2")}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">FT</span>
          </div>
          {!compact && (
            <div>
              <span className="text-base font-semibold tracking-tight">FtkSaaS</span>
              <p className="text-xs text-muted-foreground">{t("studioManagement")}</p>
            </div>
          )}
        </div>
        <nav aria-label={t("navigation")} className="flex-1 space-y-6 px-3 py-4">
          {groups.map((group, index) => (
            <div key={group[0]}>
              {!compact && (
                <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
                  {t(`groups.${index}`)}
                </p>
              )}
              <div className="space-y-1">
                {group.map((key) => {
                  const Icon = icons[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      title={compact ? t(`nav.${key}`) : undefined}
                      onClick={() => navigate(key)}
                      aria-current={section === key ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        section === key &&
                          "bg-background font-medium text-foreground shadow-xs ring-1 ring-border",
                        compact && "justify-center px-0",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span className={compact ? "sr-only" : ""}>{t(`nav.${key}`)}</span>
                      {!compact && section === key && (
                        <span
                          className="ml-auto size-1.5 rounded-full bg-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-3 p-3">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setHelpOpen(true);
            }}
            title={compact ? t("help") : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              compact && "justify-center px-0",
            )}
          >
            <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
            <span className={compact ? "sr-only" : ""}>{t("help")}</span>
          </button>
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setPreferencesOpen(true);
              }}
              title={compact ? t("accountPreferences") : undefined}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted",
                compact && "justify-center p-0",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                {initials || "FT"}
              </span>
              {!compact && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {accountName || t("account")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("accountPreferences")}
                    </span>
                  </span>
                  <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
                </>
              )}
              {compact && <span className="sr-only">{t("accountPreferences")}</span>}
            </button>
          </div>
        </div>
      </>
    );
  }
  return (
    <div className="admin-shell min-h-svh bg-muted/40">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar text-sidebar-foreground lg:flex",
          collapsed ? "w-[76px]" : "w-[236px]",
        )}
      >
        {navigation(collapsed)}
      </aside>
      <div className={cn("min-w-0", collapsed ? "lg:pl-[76px]" : "lg:pl-[236px]")}>
        <header className="flex min-h-18 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 sm:px-7">
          <Button
            variant="ghost"
            size="icon"
            className="hidden shrink-0 lg:inline-flex"
            aria-label={t(collapsed ? "expand" : "collapse")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            aria-label={t("openMenu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{t("management")}</span>
            <ChevronRight
              className="hidden size-3.5 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <span className="truncate font-medium">{t(`nav.${section}`)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              className="h-9 gap-2 px-2.5 text-muted-foreground sm:w-44 sm:justify-start"
              onClick={() => setSearchOpen(true)}
              aria-label={t("searchPages")}
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search className="size-4" />
              <span className="hidden text-xs sm:inline">{t("searchPages")}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("nav.inbox")}
              onClick={() => navigate("inbox")}
            >
              <Bell className="size-[18px]" />
            </Button>
          </div>
        </header>
        {preview && (
          <section
            aria-label={t("preview")}
            className="flex flex-wrap items-center justify-between gap-1 border-b bg-background px-5 py-2 text-xs text-muted-foreground sm:px-8"
          >
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
              {t("preview")}
            </span>
            <span>{t("previewNote")}</span>
          </section>
        )}
        <main
          ref={contentRef}
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] p-[20px] outline-none sm:p-8 lg:p-9"
        >
          {children}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-xs text-muted-foreground">
            <span>
              FtkSaaS <span className="mx-1.5 text-border">/</span> {t("studioManagement")}
            </span>
            <span>{preview ? t("previewFooter") : t("workspaceFooter")}</span>
          </footer>
        </main>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(300px,90vw)] gap-0 overflow-y-auto bg-muted"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("navigation")}</SheetTitle>
            <SheetDescription>{t("choosePage")}</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              aria-label={t("close")}
            >
              <X />
            </Button>
          </SheetClose>
          {navigation(false)}
        </SheetContent>
      </Sheet>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent showCloseButton={false} className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("searchPages")}</SheetTitle>
            <SheetDescription>{t("choosePage")}</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              aria-label={t("close")}
            >
              <X />
            </Button>
          </SheetClose>
          <div className="space-y-4 px-4">
            <Input
              aria-label={t("searchPages")}
              placeholder={t("search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="space-y-1">
              {searchResults.map((key) => {
                const Icon = icons[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-muted"
                    onClick={() => navigate(key)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(`nav.${key}`)}
                    <ChevronRight
                      className="ml-auto size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
              {!searchResults.length && (
                <p className="py-6 text-sm text-muted-foreground">{t("noResults")}</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <SheetContent showCloseButton={false} className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("accountPreferences")}</SheetTitle>
            <SheetDescription>{t("preferencesHint")}</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              aria-label={t("close")}
            >
              <X />
            </Button>
          </SheetClose>
          <div className="space-y-8 px-4">
            <Preferences />
            {onSignOut && (
              <Button variant="outline" disabled={signingOut} onClick={onSignOut}>
                <LogOut className="size-4" />
                {common(signingOut ? "signingOut" : "signOut")}
              </Button>
            )}
            {preview && <Badge variant="outline">{t("preview")}</Badge>}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent showCloseButton={false} className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("help")}</SheetTitle>
            <SheetDescription>{t("helpText")}</SheetDescription>
          </SheetHeader>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              aria-label={t("close")}
            >
              <X />
            </Button>
          </SheetClose>
          <div className="space-y-5 px-4 text-sm">
            <p>{t("helpContext")}</p>
            <p>{t("helpSearch")}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
