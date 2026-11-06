"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { WorkspaceLoading } from "../workspace-loading";
import { ApiFailure, getAccount, errorMessageKey } from "../../lib/api";
import { browserClient } from "../../lib/supabase/client";
import { studentActions } from "../../lib/students";
import { disciplineActions, mergeActions } from "../../lib/student-management";
import { accessActions } from "../../lib/person-access";
import { readEntitlements } from "../../lib/products";
import { personPath } from "../../lib/person-route";
const StudentDetail = dynamic(() => import("./students-workspace").then((m) => m.StudentDetail), {
  loading: WorkspaceLoading,
});
export function PersonPage({
  authUserId,
  orgId,
  centerId,
  personId,
}: {
  authUserId: string;
  orgId: string;
  centerId: string;
  personId: string;
}) {
  const t = useTranslations("students"),
    api = useTranslations("api"),
    router = useRouter();
  const readLock = useRef(false);
  const [attempt, setAttempt] = useState(0),
    [revision, setRevision] = useState(0),
    [result, setResult] = useState<{ key: string; accountId?: string; error?: string } | null>(
      null,
    );
  const key = JSON.stringify([authUserId, orgId, centerId, personId, attempt]);
  useEffect(() => {
    const life = new AbortController();
    readLock.current = true;
    function leave() {
      life.abort();
      setResult(null);
      router.replace(`/login?next=${encodeURIComponent(personPath(orgId, centerId, personId))}`);
      router.refresh();
    }
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== authUserId))
        leave();
    });
    void getAccount()
      .then((account) => {
        if (!life.signal.aborted) setResult({ key, accountId: account.id });
      })
      .catch((cause) => {
        if (life.signal.aborted) return;
        if (
          cause instanceof ApiFailure &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.failure.error.code)
        ) {
          leave();
          return;
        }
        setResult({ key, error: errorMessageKey(cause) });
      })
      .finally(() => {
        if (!life.signal.aborted) readLock.current = false;
      });
    function revalidate() {
      if (life.signal.aborted || readLock.current || document.visibilityState !== "visible") return;
      readLock.current = true;
      setResult(null);
      setAttempt((value) => value + 1);
    }
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      life.abort();
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      data.subscription.unsubscribe();
    };
  }, [authUserId, orgId, centerId, personId, key, router]);
  const current = result?.key === key ? result : null;
  return (
    <main className="mx-auto min-w-0 max-w-4xl space-y-6 p-4 sm:p-6">
      <Link href="/#students" className="inline-flex min-h-11 items-center underline">
        {t("backToPeople")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
      {current?.error && <p role="alert">{api(current.error)}</p>}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setResult(null);
          setAttempt((v) => v + 1);
        }}
      >
        {t("retry")}
      </Button>
      {!current && <WorkspaceLoading />}
      {current?.accountId && (
        <StudentDetail
          key={`${key}:${revision}`}
          scope={{ actorId: current.accountId, orgId, centerId }}
          personId={personId}
          centerName={t("directCenterScope")}
          actions={studentActions}
          disciplines={disciplineActions}
          merging={mergeActions}
          access={accessActions}
          entitlements={readEntitlements}
          onSaved={() => setRevision((v) => v + 1)}
          onActivated={() => setRevision((v) => v + 1)}
          onMerged={(id) => router.replace(personPath(orgId, centerId, id))}
        />
      )}
    </main>
  );
}
