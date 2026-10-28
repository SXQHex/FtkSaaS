"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Preferences } from "./preferences";
import type {
  AccountView,
  CenterView,
  OrganizationView,
  UserSettingsValues,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ftksaas/ui/components/card";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ftksaas/ui/components/select";
import {
  ApiFailure,
  errorMessageKey,
  getAccount,
  getCenters,
  getOrganizations,
  getUserSettings,
} from "../lib/api";
import {
  accessibleCenters,
  contextStorageKey,
  preferredContext,
  readRememberedContext,
} from "../lib/context";
import { browserClient } from "../lib/supabase/client";

type Snapshot = {
  account: AccountView;
  organizations: OrganizationView[];
  settings: UserSettingsValues;
};
export function Workspace() {
  const router = useRouter();
  const t = useTranslations("workspace");
  const common = useTranslations("common");
  const api = useTranslations("api");
  const { setTheme } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [centers, setCenters] = useState<CenterView[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const organization = snapshot?.organizations.find((item) => item.id === organizationId);
  const center = centers.find((item) => item.id === centerId);
  useEffect(() => {
    if (retry > 0) {
      setSnapshot(null);
      setOrganizationId("");
      setCenterId("");
      setCenters([]);
    }
    let active = true;
    Promise.all([getAccount(), getOrganizations(), getUserSettings()])
      .then(([account, organizations, settings]) => {
        if (!active) return;
        let remembered = null;
        let deviceTheme: string | null = null;
        try {
          remembered = readRememberedContext(localStorage.getItem(contextStorageKey(account.id)));
          deviceTheme = localStorage.getItem("theme");
        } catch {
          /* Device storage may be unavailable. */
        }
        const preferred = preferredContext(settings, remembered, organizations);
        setSnapshot({ account, organizations, settings });
        setOrganizationId(preferred?.org_id ?? "");
        setCenterId(preferred?.center_id ?? "");
        setError("");
        if (!["light", "dark", "system"].includes(deviceTheme ?? "")) {
          setTheme(settings.theme ?? "system");
        }
        document.documentElement.style.fontSize = settings.font_scale
          ? `${settings.font_scale * 100}%`
          : "";
        document.documentElement.dataset.motion = settings.motion ?? "system";
        document.documentElement.dataset.contrast = settings.contrast ?? "system";
      })
      .catch((cause) => {
        if (!active) return;
        setError(errorMessageKey(cause));
        if (
          cause instanceof ApiFailure &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.failure.error.code)
        ) {
          router.replace("/giris?error=session");
          router.refresh();
        }
      });
    return () => {
      active = false;
      document.documentElement.style.fontSize = "";
      delete document.documentElement.dataset.motion;
      delete document.documentElement.dataset.contrast;
    };
  }, [retry, router, setTheme]);
  useEffect(() => {
    if (
      !organization ||
      organization.access_mode === "closed" ||
      organization.access_mode === "bootstrap"
    )
      return;
    let active = true;
    setCentersLoading(true);
    getCenters(organization.id)
      .then((items) => {
        if (!active) return;
        const visible = accessibleCenters(items);
        setCenters(visible);
        setCentersLoading(false);
        setCenterId((current) => (visible.some((item) => item.id === current) ? current : ""));
      })
      .catch((cause) => {
        if (active) {
          setCentersLoading(false);
          setCenterId("");
          setCenters([]);
          setError(errorMessageKey(cause));
        }
      });
    return () => {
      active = false;
    };
  }, [organization]);
  useEffect(() => {
    if (!snapshot?.settings.remember_context || !organization || (centerId && !center)) return;
    try {
      localStorage.setItem(
        contextStorageKey(snapshot.account.id),
        JSON.stringify({
          org_id: organization.id,
          center_id: centerId || null,
          discipline_id: null,
        }),
      );
    } catch {
      /* Device storage is optional; live access remains authoritative. */
    }
  }, [snapshot, organization, centerId, center]);
  useEffect(() => {
    const { data } = browserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSnapshot(null);
        setCenters([]);
        setCenterId("");
        router.replace("/giris");
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  function chooseOrganization(id: string) {
    setOrganizationId(id);
    setCenterId("");
    setCenters([]);
    setError("");
    const next = snapshot?.organizations.find((item) => item.id === id);
    setCentersLoading(next?.access_mode === "normal" || next?.access_mode === "grace");
  }
  async function signOut() {
    setSigningOut(true);
    try {
      const result = await browserClient().auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      setSnapshot(null);
      setCenters([]);
      setCenterId("");
      router.replace("/giris");
      router.refresh();
    } catch {
      setSigningOut(false);
      setError("signOutFailed");
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 p-6 md:p-10">
      <Preferences />
      <Card>
        <CardHeader>
          <CardTitle><h1>{t("title")}</h1></CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <h2 className="text-lg font-medium">{snapshot ? t("greeting", { name: snapshot.account.display_name }) : t("welcome")}</h2>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                <p>{error === "signOutFailed" ? t("signOutFailed") : api(error)}</p>
                <Button variant="outline" className="mt-3 min-h-11" onClick={() => {
                  setSnapshot(null); setOrganizationId(""); setCenterId("");
                  setCenters([]); setError(""); setRetry((value) => value + 1);
                }}>{common("retry")}</Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!snapshot && !error ? <p role="status">{t("loading")}</p> : null}
          {snapshot && !snapshot.organizations.length ? (
            <div><h3>{t("noOrg")}</h3><p>{t("noOrgHelp")}</p></div>
          ) : null}
          {snapshot?.organizations.length ? (
            <>
              <Select value={organizationId} onValueChange={chooseOrganization}>
                <SelectTrigger className="w-full min-h-11" aria-label={t("org")}><SelectValue placeholder={t("org")} /></SelectTrigger>
                <SelectContent>{snapshot.organizations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={centerId} onValueChange={setCenterId} disabled={!centers.length || centersLoading}>
                <SelectTrigger className="w-full min-h-11" aria-label={t("center")}><SelectValue placeholder={t(centersLoading ? "centersLoading" : "center")} /></SelectTrigger>
                <SelectContent>{centers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <div role="status" className="space-y-2 text-sm">
                <p>{organization ? t(organization.access_mode) : t("chooseHelp")}</p>
                {organization ? <p>{organization.access_mode === "closed" ? t("closedHelp")
                  : organization.access_mode === "bootstrap" ? t("bootstrapHelp")
                  : centersLoading ? t("centersHelp") : !centers.length ? t("noCenter")
                  : center ? t("selected", { name: center.name, timezone: center.timezone }) : t("selectCenter")}</p> : null}
              </div>
            </>
          ) : null}
          <Button variant="outline" onClick={signOut} disabled={signingOut} className="min-h-11">
            {common(signingOut ? "signingOut" : "signOut")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
