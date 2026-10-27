"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, CalendarDays, Home, Menu, Users, Wallet, Settings } from "lucide-react";
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
import { Badge } from "@ftksaas/ui/components/badge";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ftksaas/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@ftksaas/ui/components/sheet";
import {
  ApiFailure,
  errorMessage,
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
const sections = [
  { title: "Takvim", Icon: CalendarDays },
  { title: "Kişiler", Icon: Users },
  { title: "Finans", Icon: Wallet },
  { title: "Ayarlar", Icon: Settings },
];
const modeText = {
  bootstrap: "Kurulum bekliyor",
  normal: "Çalışma alanı açık",
  grace: "Abonelik ek süresi",
  closed: "Erişim kapalı",
};
function Navigation() {
  return (
    <nav aria-label="Ana gezinme" className="space-y-2">
      <a
        href="/"
        aria-current="page"
        className="flex min-h-11 items-center gap-3 rounded-md bg-accent px-3 font-medium text-accent-foreground"
      >
        <Home className="size-4" aria-hidden="true" />
        Başlangıç
      </a>
      {sections.map(({ title, Icon }) => (
        <button
          type="button"
          key={title}
          disabled
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-muted-foreground"
        >
          <Icon className="size-4" aria-hidden="true" />
          <span>{title}</span>
          <span className="ml-auto text-xs">Hazırlanıyor</span>
        </button>
      ))}
    </nav>
  );
}
export function Workspace() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
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
        try {
          remembered = readRememberedContext(localStorage.getItem(contextStorageKey(account.id)));
        } catch {
          /* Device storage may be unavailable. */
        }
        const preferred = preferredContext(settings, remembered, organizations);
        setSnapshot({ account, organizations, settings });
        setOrganizationId(preferred?.org_id ?? "");
        setCenterId(preferred?.center_id ?? "");
        setError("");
        setTheme(settings.theme ?? "system");
        document.documentElement.style.fontSize = settings.font_scale
          ? `${settings.font_scale * 100}%`
          : "";
        document.documentElement.dataset.motion = settings.motion ?? "system";
        document.documentElement.dataset.contrast = settings.contrast ?? "system";
      })
      .catch((cause) => {
        if (!active) return;
        setError(errorMessage(cause));
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
          setError(errorMessage(cause));
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
    const result = await browserClient().auth.signOut({ scope: "local" });
    if (result.error) {
      setSigningOut(false);
      setError("Çıkış tamamlanamadı. Yeniden dene.");
      return;
    }
    setSnapshot(null);
    router.replace("/giris");
    router.refresh();
  }
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r bg-card p-6 lg:block">
        <p className="mb-12 text-xl font-extrabold tracking-tight">FtkSaaS</p>
        <Navigation />
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center gap-4 border-b bg-card px-5 py-4 lg:px-9">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                className="min-h-11 lg:hidden"
                variant="outline"
                size="icon"
                aria-label="Menüyü aç"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="px-6 pt-8">FtkSaaS</SheetTitle>
              <SheetDescription className="sr-only">Uygulama bölümleri</SheetDescription>
              <div className="p-6">
                <Navigation />
              </div>
            </SheetContent>
          </Sheet>
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Select
              value={organizationId}
              onValueChange={chooseOrganization}
              disabled={!snapshot?.organizations.length}
            >
              <SelectTrigger className="w-full min-h-11" aria-label="Kuruluş seç">
                <SelectValue placeholder="Kuruluş seç" />
              </SelectTrigger>
              <SelectContent>
                {snapshot?.organizations.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={centerId}
              onValueChange={setCenterId}
              disabled={!centers.length || centersLoading}
            >
              <SelectTrigger className="w-full min-h-11" aria-label="Merkez seç">
                <SelectValue
                  placeholder={centersLoading ? "Merkezler yükleniyor…" : "Merkez seç"}
                />
              </SelectTrigger>
              <SelectContent>
                {centers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="min-h-11 w-28" aria-label="Görünüm">
                <SelectValue placeholder="Sistem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistem</SelectItem>
                <SelectItem value="light">Açık</SelectItem>
                <SelectItem value="dark">Koyu</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={signOut} disabled={signingOut} className="min-h-11">
              {signingOut ? "Çıkılıyor…" : "Çıkış yap"}
            </Button>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-5 py-9 lg:px-9 lg:py-12">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Çalışma alanın</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {snapshot ? `Merhaba, ${snapshot.account.display_name}` : "Hoş geldin"}
            </h1>
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
              Kuruluşunu ve merkezini seçerek çalışma bağlamını belirle.
            </p>
          </div>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                <p>{error}</p>
                <Button
                  variant="outline"
                  className="mt-3 min-h-11"
                  onClick={() => {
                    setSnapshot(null);
                    setOrganizationId("");
                    setCenterId("");
                    setCenters([]);
                    setError("");
                    setRetry((value) => value + 1);
                  }}
                >
                  Yeniden yükle
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!snapshot && !error ? (
            <p role="status">Hesabın ve erişebildiğin kuruluşlar yükleniyor…</p>
          ) : null}
          {snapshot && !snapshot.organizations.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Bağlı kuruluş bulunamadı</CardTitle>
                <CardDescription>
                  Hesabınla eşleşen erişilebilir bir kuruluş bulunamadı. Kuruluş yöneticinle
                  iletişime geç.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
          {snapshot?.organizations.length ? (
            <Card className="shadow-none">
              <CardHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-accent">
                  <Building2 className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{organization?.name ?? "Çalışma alanını seç"}</CardTitle>
                <CardDescription>
                  {organization
                    ? modeText[organization.access_mode]
                    : "Üstteki kuruluş seçicisinden devam et."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {organization ? (
                  <>
                    <Badge variant="secondary">{modeText[organization.access_mode]}</Badge>
                    <p className="text-sm leading-relaxed">
                      {organization.access_mode === "closed"
                        ? "Kuruluşun erişimi kapalı. Abonelik durumu için kuruluş sahibiyle iletişime geç."
                        : organization.access_mode === "bootstrap"
                          ? "Kuruluşun ilk kurulum ve ödeme adımları bekleniyor. Bu ekran kurulum işlemi başlatmaz."
                          : centersLoading
                            ? "Erişilebilir merkezlerin yükleniyor."
                            : !centers.length
                              ? "Erişilebilir aktif bir merkez bulunamadı."
                              : center
                                ? `${center.name} merkezindesin. İş zamanı: ${center.timezone}.`
                                : "Devam etmek için bir merkez seç."}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    </div>
  );
}
