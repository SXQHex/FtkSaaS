"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { FinanceApi } from "../../lib/finance";
import type { SetupScope } from "../../lib/studio-setup";
import type { useSetupCommand } from "../setup/setup-command";
import { CollectionForm } from "./collection-form";
export function CollectionAccess({
  scope,
  view,
  timeZone,
  api,
  command,
}: {
  scope: SetupScope;
  view: FinanceView;
  timeZone: string;
  api: FinanceApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("finance"),
    [allowed, setAllowed] = useState<boolean | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .canCollect(scope, view.person_id)
      .then((value) => {
        if (active) setAllowed(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [scope, view.person_id, api, attempt]);
  if (failed)
    return (
      <div className="space-y-3">
        <p role="alert">{t("permissionFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAllowed(null);
            setAttempt((n) => n + 1);
          }}
        >
          {t("retryPermission")}
        </Button>
      </div>
    );
  if (allowed === null) return <output aria-live="polite">{t("loading")}</output>;
  return allowed ? (
    <CollectionForm scope={scope} view={view} timeZone={timeZone} command={command} />
  ) : null;
}
