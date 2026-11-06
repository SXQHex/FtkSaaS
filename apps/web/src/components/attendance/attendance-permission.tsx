"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import type { AttendanceApi, AttendanceAction } from "../../lib/attendance";
export function AttendancePermission(props: {
  scope: SetupScope;
  operation: AttendanceAction;
  target: string;
  api: AttendanceApi;
  children: ReactNode;
}) {
  return (
    <Permission key={JSON.stringify([props.scope, props.operation, props.target])} {...props} />
  );
}
function Permission({
  scope,
  operation,
  target,
  api,
  children,
}: {
  scope: SetupScope;
  operation: AttendanceAction;
  target: string;
  api: AttendanceApi;
  children: ReactNode;
}) {
  const t = useTranslations("attendance"),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{ allowed?: boolean; failed?: boolean } | null>(null);
  useEffect(() => {
    const life = new AbortController();
    void api
      .access(scope, operation, target)
      .then((allowed) => {
        if (!life.signal.aborted) setResult({ allowed });
      })
      .catch(() => {
        if (!life.signal.aborted) setResult({ failed: true });
      });
    return () => life.abort();
  }, [scope, operation, target, api, attempt]);
  return !result ? (
    <output aria-live="polite">{t("loading")}</output>
  ) : result.failed ? (
    <div className="space-y-2">
      <p role="alert">{t("permissionFailed")}</p>
      <Button
        variant="outline"
        onClick={() => {
          setResult(null);
          setAttempt((v) => v + 1);
        }}
      >
        {t("retry")}
      </Button>
    </div>
  ) : result.allowed ? (
    children
  ) : null;
}
