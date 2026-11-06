"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure, errorMessageKey, getAccount } from "../../lib/api";
import { browserClient } from "../../lib/supabase/client";
import { saleDocumentPath } from "../../lib/sale-document-route";
import { Preferences } from "../preferences";
import { SelfDocuments } from "./self-documents";
export function SaleDocumentsPage({
  authUserId,
  orgId,
  centerId,
  productVersionId,
}: {
  authUserId: string;
  orgId: string;
  centerId: string;
  productVersionId: string;
}) {
  const router = useRouter(),
    t = useTranslations("documents"),
    api = useTranslations("api");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; accountId?: string; error?: string } | null>(
    null,
  );
  const key = `${authUserId}:${orgId}:${centerId}:${productVersionId}:${attempt}`;
  useEffect(() => {
    let active = true;
    function leave() {
      active = false;
      setResult(null);
      router.replace(
        `/login?next=${encodeURIComponent(saleDocumentPath(orgId, centerId, productVersionId))}`,
      );
      router.refresh();
    }
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== authUserId))
        leave();
    });
    void getAccount()
      .then((account) => {
        if (active) setResult({ key, accountId: account.id });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (
          cause instanceof ApiFailure &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.failure.error.code)
        ) {
          leave();
          return;
        }
        setResult({ key, error: errorMessageKey(cause) });
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authUserId, orgId, centerId, productVersionId, key, router]);
  const current = result?.key === key ? result : null;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh w-full min-w-0 max-w-3xl space-y-6 px-5 py-6 outline-none wrap-anywhere sm:px-8 sm:py-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" className="h-auto min-h-11 whitespace-normal">
          <Link href="/">{t("backToWorkspace")}</Link>
        </Button>
        <Preferences />
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">{t("saleTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("saleSelfHint")}</p>
      {!current ? (
        <output>{t("loading")}</output>
      ) : current.error ? (
        <div role="alert" className="space-y-3 rounded-lg border p-4">
          <p>{api(current.error)}</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("reload")}
          </Button>
        </div>
      ) : current.accountId ? (
        <SelfDocuments
          headingLevel={2}
          key={key}
          scope={{ actorId: current.accountId, orgId, centerId }}
          context={{
            gate: "sale",
            subject: { type: "product_versions", id: productVersionId },
            product_version_id: productVersionId,
          }}
        />
      ) : null}
    </main>
  );
}
