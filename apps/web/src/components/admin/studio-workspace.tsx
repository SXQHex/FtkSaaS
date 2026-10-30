"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Building2, CalendarDays, CreditCard, Layers3, Users } from "lucide-react";
import type { AccountView, CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Badge } from "@ftksaas/ui/components/badge";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { ScheduleWorkspace } from "../calendar/schedule-workspace";
import { StudentsWorkspace } from "../students/students-workspace";
import { Preferences } from "../preferences";
import { AdminShell, sections, type AdminSection } from "./admin-shell";
import {
  ApiFailure,
  errorMessageKey,
  getAccount,
  getCenters,
  getOrganizations,
  getUserSettings,
} from "../../lib/api";
import { accessibleCenters } from "../../lib/context";
import { browserClient } from "../../lib/supabase/client";

type Studio = { organization: OrganizationView; centers: CenterView[] };
type Snapshot = { account: AccountView; studios: Studio[] };
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function currentSection(): AdminSection {
  const key = window.location.hash.slice(1);
  return sections.includes(key as AdminSection) ? (key as AdminSection) : "overview";
}
const initialSection = (): AdminSection => "overview";
const shortcuts = [
  { section: "schedule", icon: CalendarDays },
  { section: "students", icon: Users },
  { section: "packages", icon: Layers3 },
  { section: "finance", icon: CreditCard },
] as const;

export function StudioWorkspace() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const t = useTranslations("live");
  const nav = useTranslations("admin");
  const common = useTranslations("common");
  const api = useTranslations("api");
  const section = useSyncExternalStore(subscribe, currentSection, initialSection);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let active = true;
    const client = browserClient();
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        active = false;
        setSnapshot(null);
        router.replace("/giris");
        router.refresh();
      }
    });
    async function load() {
      try {
        const [account, organizations, settings] = await Promise.all([
          getAccount(),
          getOrganizations(),
          getUserSettings(),
        ]);
        if (!active) return;
        const studios = await Promise.all(
          organizations.map(async (organization) => ({
            organization,
            centers: ["normal", "grace"].includes(organization.access_mode)
              ? accessibleCenters(await getCenters(organization.id))
              : [],
          })),
        );
        if (!active) return;
        setSnapshot({ account, studios });
        setError("");
        let deviceTheme: string | null = null;
        try {
          deviceTheme = localStorage.getItem("theme");
        } catch {
          /* Storage is optional. */
        }
        if (!["light", "dark", "system"].includes(deviceTheme ?? ""))
          setTheme(settings.theme ?? "system");
        document.documentElement.style.fontSize = settings.font_scale
          ? `${settings.font_scale * 100}%`
          : "";
        document.documentElement.dataset.motion = settings.motion ?? "system";
        document.documentElement.dataset.contrast = settings.contrast ?? "system";
      } catch (cause) {
        if (!active) return;
        setError(errorMessageKey(cause));
        if (
          cause instanceof ApiFailure &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.failure.error.code)
        ) {
          setSnapshot(null);
          router.replace("/giris?error=session");
          router.refresh();
        }
      }
    }
    void load();
    return () => {
      active = false;
      data.subscription.unsubscribe();
      document.documentElement.style.fontSize = "";
      delete document.documentElement.dataset.motion;
      delete document.documentElement.dataset.contrast;
    };
  }, [retry, router, setTheme]);
  async function signOut() {
    setSigningOut(true);
    try {
      const result = await browserClient().auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      setSnapshot(null);
      router.replace("/giris");
      router.refresh();
    } catch {
      setSigningOut(false);
      setError("signOutFailed");
    }
  }
  function navigate(next: AdminSection) {
    window.location.assign(`#${next}`);
  }
  const studioCards = snapshot && (
    <div className="grid gap-4 md:grid-cols-2">
      {snapshot.studios.map(({ organization, centers }) => (
        <Card key={organization.id} className="shadow-none">
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">
                <h2>{organization.name}</h2>
              </CardTitle>
            </div>
            <Badge variant="outline">{t(`access.${organization.access_mode}`)}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {centers.length ? (
              centers.map((center) => (
                <div key={center.id} className="rounded-xl border bg-muted/30 p-4">
                  <h3 className="text-sm font-medium">{center.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("timezone", { timezone: center.timezone })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {t(
                  organization.access_mode === "closed"
                    ? "closedHelp"
                    : organization.access_mode === "bootstrap"
                      ? "bootstrapHelp"
                      : "noCenters",
                )}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
  return (
    <AdminShell
      section={section}
      onNavigate={navigate}
      accountName={snapshot?.account.display_name ?? ""}
      onSignOut={signOut}
      signingOut={signingOut}
    >
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {section === "overview"
              ? snapshot
                ? t("greeting", { name: snapshot.account.display_name })
                : t("welcome")
              : nav(`nav.${section}`)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t(`descriptions.${section}`)}
          </p>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            <p>{error === "signOutFailed" ? t("signOutFailed") : api(error)}</p>
            <Button
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => {
                setSnapshot(null);
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              {common("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!snapshot && !error && (
        <output
          aria-live="polite"
          className="block rounded-xl border bg-card p-6 text-sm text-muted-foreground"
        >
          {t("loading")}
        </output>
      )}
      {snapshot && section === "overview" && (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {shortcuts.map(({ section: key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(key)}
                className="group flex min-h-28 items-center justify-between gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted"
              >
                <span>
                  <Icon className="mb-4 size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{nav(`nav.${key}`)}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>
                  <h2 className="text-base">{t("dailyFlow")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleWorkspace studios={snapshot.studios} />
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>
                  <h2 className="text-base">{t("accountTitle")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="font-medium">{snapshot.account.display_name}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {snapshot.studios.length ? t("studioHelp") : t("noStudioHelp")}
                </p>
                <Button
                  variant="outline"
                  className="h-auto min-h-11 whitespace-normal"
                  onClick={() => navigate(snapshot.studios.length ? "studio" : "settings")}
                >
                  {nav(`nav.${snapshot.studios.length ? "studio" : "settings"}`)}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {snapshot &&
        section === "studio" &&
        (snapshot.studios.length ? (
          studioCards
        ) : (
          <Card className="p-6 shadow-none">
            <h2 className="font-medium">{t("noStudio")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("noStudioHelp")}</p>
          </Card>
        ))}
      {snapshot && section === "settings" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2 className="text-base">{nav("appearance")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Preferences />
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2 className="text-base">{t("accountTitle")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>{snapshot.account.display_name}</p>
              <Button variant="outline" onClick={signOut} disabled={signingOut}>
                {common(signingOut ? "signingOut" : "signOut")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {snapshot && section === "schedule" && <ScheduleWorkspace studios={snapshot.studios} />}
      {snapshot && section === "students" && (
        <StudentsWorkspace studios={snapshot.studios} actorId={snapshot.account.id} />
      )}
      {snapshot &&
        !["overview", "studio", "settings", "schedule", "students"].includes(section) && (
          <Card className="shadow-none">
            <CardContent className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
              <Layers3 aria-hidden="true" className="mb-5 size-8 text-muted-foreground" />
              <h2 className="text-lg font-medium">{t("comingTitle")}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {t("comingDescription")}
              </p>
              <Button
                className="mt-6 h-auto min-h-11 whitespace-normal"
                variant="outline"
                onClick={() => navigate("overview")}
              >
                {t("backToToday")}
              </Button>
            </CardContent>
          </Card>
        )}
    </AdminShell>
  );
}
