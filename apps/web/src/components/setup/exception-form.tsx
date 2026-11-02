"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ResourceRef } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { exceptionInterval, setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand, errorKey } from "./setup-command";

export function ExceptionForm({
  scope,
  resource,
  onSaved,
}: {
  scope: SetupScope;
  resource: ResourceRef;
  onSaved?: () => void;
}) {
  const t = useTranslations("setup");
  const [version, setVersion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  function refresh() {
    setVersion(null);
    setError("");
    setRetry((n) => n + 1);
  }
  const command = useSetupCommand(scope, `exception:${resource.kind}:${resource.id}`, () => {
    refresh();
    onSaved?.();
  });
  useEffect(() => {
    let active = true;
    async function load() {
      let cursor: string | null | undefined;
      do {
        const data = await setupCall("centers_list_v1", {
          org_id: scope.orgId,
          page: { limit: 50, ...(cursor ? { cursor } : {}) },
        });
        const center = data.items.find((row) => row.id === scope.centerId);
        if (center) {
          if (active) setVersion(center.version);
          return;
        }
        cursor = data.next_cursor;
      } while (cursor);
      if (active) setError("NOT_FOUND");
    }
    void load().catch((cause) => {
      if (active) setError(errorKey(setupError(cause)));
    });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, retry]);
  const id = `exception-${resource.kind}-${resource.id}`;
  return (
    <form
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!version) return;
        const data = new FormData(event.currentTarget);
        try {
          const interval = exceptionInterval(String(data.get("start")), String(data.get("end")));
          setError("");
          void command.run({
            operation: "availability_exception_save_v1",
            input: {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              expected_version: version,
              resource,
              interval,
              reason: String(data.get("reason")).trim(),
            },
          });
        } catch {
          setError("invalidInterval");
        }
      }}
    >
      <h4 className="font-medium">{t("closureTitle")}</h4>
      <p className="text-sm text-muted-foreground">{t("closureHint")}</p>
      <fieldset disabled={!version || command.busy || !!command.pending} className="space-y-4">
        <Label htmlFor={`${id}-start`}>{t("closureStart")}</Label>
        <Input id={`${id}-start`} name="start" placeholder="2030-01-01T18:00:00+03:00" required />
        <Label htmlFor={`${id}-end`}>{t("closureEnd")}</Label>
        <Input id={`${id}-end`} name="end" placeholder="2030-01-01T20:00:00+03:00" required />
        <Label htmlFor={`${id}-reason`}>{t("closureReason")}</Label>
        <Input id={`${id}-reason`} name="reason" required />
        <Button>{t("saveClosure")}</Button>
      </fieldset>
      {error && <p role="alert">{t(error)}</p>}
      <Button type="button" variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      <SetupFeedback command={command} />
    </form>
  );
}
