"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { PreparationPicker } from "../settings/preparation-picker";
import { Button } from "@ftksaas/ui/components/button";
import { useRemote } from "../../lib/use-remote";
import { readPermission, readPersonnel } from "../../lib/personnel-permissions";
import { personnelPermissions, type PersonnelPermission } from "../../lib/pro-access-command";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { useSetupCommand, SetupFeedback } from "./setup-command";
import { ConfirmWrite, FlowError } from "../bookings/flow-controls";
const control = "min-h-11 w-full rounded-md border bg-background px-3";
export function PersonnelPermissions({ scope, personId }: { scope: SetupScope; personId: string }) {
  const t = useTranslations("personnelPermissions"),
    [open, setOpen] = useState(false),
    [permission, setPermission] = useState<PersonnelPermission>();
  const [prepared, setPrepared] = useState<{ permission: string; enabled: boolean }[]>([]);
  return (
    <section className="space-y-4 border-t pt-4" aria-label={t("title")}>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("title")}
      </Button>
      {open && (
        <>
          <p>{t("hint")}</p>
          <PreparationPicker
            scope={scope}
            kind="permission"
            contextKey={personId}
            onResolved={(p) => {
              if (p.kind === "permission") {
                setPrepared(p.permission_requests);
                setPermission(undefined);
              }
            }}
          />

          <label className="block space-y-2">
            {t("permission")}
            <select
              className={control}
              value={permission ?? ""}
              onChange={(e) => setPermission((e.target.value as PersonnelPermission) || undefined)}
            >
              <option value="">{t("choose")}</option>
              {personnelPermissions.map((p) => (
                <option value={p} key={p}>
                  {t(`permissions.${p}`)}
                </option>
              ))}
            </select>
          </label>
          {permission && (
            <PermissionEditor
              key={`${scope.actorId}:${scope.orgId}:${scope.centerId}:${personId}:${permission}:${JSON.stringify(prepared)}`}
              scope={scope}
              personId={personId}
              permission={permission}
              initialChoice={prepared.find((g) => g.permission === permission)?.enabled}
            />
          )}
        </>
      )}
    </section>
  );
}
function PermissionEditor({
  scope,
  personId,
  permission,
  initialChoice,
}: {
  scope: SetupScope;
  personId: string;
  permission: PersonnelPermission;
  initialChoice?: boolean;
}) {
  const t = useTranslations("personnelPermissions"),
    [revision, setRevision] = useState(0),
    [choice, setChoice] = useState(
      initialChoice === undefined ? "" : initialChoice ? "allow" : "deny",
    ),
    [review, setReview] = useState<SetupCommand | null>(null);
  const load = useCallback(
    () => readPermission(scope, personId, permission),
    [scope, personId, permission],
  );
  const result = useRemote(load, JSON.stringify([scope, personId, permission, revision]));
  const command = useSetupCommand(scope, `permission:${personId}:${permission}`, () => {
    setReview(null);
    setChoice("");
    setRevision((n) => n + 1);
  });
  return (
    <div className="space-y-4">
      <SetupFeedback command={command} />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => {
          setReview(null);
          setChoice("");
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <>
          <p>
            {t(
              result.data.overrideExists
                ? result.data.enabled
                  ? "allowed"
                  : "denied"
                : "noOverride",
            )}
          </p>
          <fieldset disabled={command.busy || !!command.pending} className="space-y-3">
            <label className="block space-y-2">
              {t("choice")}
              <select
                className={control}
                value={choice}
                onChange={(e) => {
                  setChoice(e.target.value);
                  setReview(null);
                }}
              >
                <option value="">{t("choose")}</option>
                <option value="allow">{t("allow")}</option>
                <option value="deny">{t("deny")}</option>
              </select>
            </label>
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              disabled={!choice}
              onClick={() =>
                setReview({
                  operation: "permission_set_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    person_id: personId,
                    permission,
                    enabled: choice === "allow",
                    expected_version: result.data!.version,
                    operation_key: v7(),
                  },
                })
              }
            >
              {t("review")}
            </Button>
          </fieldset>
          {review && !command.pending && (
            <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
              <p>
                {t(`permissions.${permission}`)} · {t(choice === "allow" ? "allow" : "deny")}
              </p>
              <p>{t("hint")}</p>
            </ConfirmWrite>
          )}
        </>
      )}
    </div>
  );
}

export function PersonnelDirectory({ scope }: { scope: SetupScope }) {
  const t = useTranslations("personnelPermissions"),
    [open, setOpen] = useState(false);
  return (
    <section className="space-y-4">
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("directory")}
      </Button>
      {open && <PersonnelList scope={scope} />}
    </section>
  );
}
function PersonnelList({ scope }: { scope: SetupScope }) {
  const t = useTranslations("personnelPermissions"),
    [revision, setRevision] = useState(0),
    load = useCallback(() => readPersonnel(scope), [scope]),
    result = useRemote(load, JSON.stringify([scope, revision]));
  return (
    <div className="space-y-4">
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => setRevision((n) => n + 1)}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      <ul>
        {result?.data?.map((p) => (
          <li className="space-y-3 py-4" key={p.id}>
            <h4>{p.name}</h4>
            <PersonnelPermissions scope={scope} personId={p.id} />
          </li>
        ))}
      </ul>
      {result?.data?.length === 0 && <p>{t("empty")}</p>}
    </div>
  );
}
