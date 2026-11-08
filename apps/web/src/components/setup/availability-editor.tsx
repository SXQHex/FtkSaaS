"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { AvailabilityRule, ManagementStateView, ResourceRef } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { getAvailability, setupError, weeklyRule, type SetupScope } from "../../lib/studio-setup";
import { PreparationPicker } from "../settings/preparation-picker";
import { ClosureList } from "./closure-list";
import { ExceptionForm } from "./exception-form";
import { errorKey, SetupFeedback, useSetupCommand } from "./setup-command";

function RuleForm({
  scope,
  resource,
  existing,
  onSaved,
}: {
  scope: SetupScope;
  resource: ResourceRef;
  existing?: ManagementStateView;
  onSaved: () => void;
}) {
  const t = useTranslations("setup");
  const projection =
    existing?.current?.operation === "availability_save_v1" ? existing.current.values : null;
  const rule: AvailabilityRule | undefined = projection?.rule;
  const ruleId = existing?.entity?.id;
  const version = existing?.versions.find(
    (entry) => entry.entity.type === "availability_rules" && entry.entity.id === ruleId,
  )?.version;
  const command = useSetupCommand(
    scope,
    `availability:${resource.kind}:${resource.id}:${ruleId ?? "new"}`,
    onSaved,
  );
  const [invalid, setInvalid] = useState(false);
  const [prepared, setPrepared] = useState<AvailabilityRule | null>(null);
  const effectiveRule = prepared ?? rule;
  if (existing && (!rule || !ruleId || !version)) return <p role="alert">{t("unreadableRule")}</p>;
  const suffix = `${resource.kind}-${resource.id}-${ruleId ?? "new"}`;
  return (
    <form
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setInvalid(false);
        let value: AvailabilityRule;
        try {
          value = weeklyRule(new FormData(event.currentTarget));
        } catch {
          setInvalid(true);
          return;
        }
        void command.run({
          operation: "availability_save_v1",
          input: {
            org_id: scope.orgId,
            center_id: scope.centerId,
            operation_key: v7(),
            resource,
            rule: value,
            ...(ruleId ? { rule_id: ruleId, expected_version: version } : {}),
          },
        });
      }}
    >
      <h4 className="font-medium">{t(rule ? "editRule" : "newRule")}</h4>
      {!existing && (
        <PreparationPicker
          scope={scope}
          kind="availability"
          resource={resource}
          contextKey={JSON.stringify(resource)}
          disabled={command.busy || !!command.pending}
          onResolved={(p) => {
            if (p.kind === "availability") {
              setPrepared(p.request.rule);
              setInvalid(false);
            }
          }}
        />
      )}
      <fieldset
        key={JSON.stringify(effectiveRule ?? null)}
        disabled={command.busy || !!command.pending}
        className="space-y-4"
      >
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">{t("weekdays")}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm">
                <input
                  name="weekdays"
                  type="checkbox"
                  value={day}
                  defaultChecked={effectiveRule?.weekdays.includes(day)}
                />
                {t(`days.${day}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`start-${suffix}`}>{t("startTime")}</Label>
            <Input
              id={`start-${suffix}`}
              name="start"
              type="time"
              step={1}
              defaultValue={effectiveRule?.local_start}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`end-${suffix}`}>{t("endTime")}</Label>
            <Input
              id={`end-${suffix}`}
              name="end"
              defaultValue={effectiveRule?.local_end}
              placeholder="24:00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`from-${suffix}`}>{t("validFrom")}</Label>
            <Input
              id={`from-${suffix}`}
              name="from"
              type="date"
              defaultValue={effectiveRule?.valid_from}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`until-${suffix}`}>{t("validUntil")}</Label>
            <Input
              id={`until-${suffix}`}
              name="until"
              type="date"
              defaultValue={effectiveRule?.valid_until ?? ""}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("weeklyHint")}</p>
        <Button>{t("saveRule")}</Button>
      </fieldset>
      {invalid && <p role="alert">{t("invalidWeeklyRule")}</p>}
      <SetupFeedback command={command} />
    </form>
  );
}
export function AvailabilityEditor({
  scope,
  resource,
  resourceName,
}: {
  scope: SetupScope;
  resource: ResourceRef;
  resourceName?: string;
}) {
  const t = useTranslations("setup");
  const [rules, setRules] = useState<ManagementStateView[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getAvailability(scope.orgId, scope.centerId!, { kind: resource.kind, id: resource.id })
      .then((value) => {
        if (active) {
          setRules(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setRules(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, resource.kind, resource.id, retry]);
  const saved = () => {
    setRules(null);
    setError("");
    setRetry((n) => n + 1);
  };
  return (
    <section
      className="space-y-4"
      aria-label={
        resourceName
          ? t("availabilityFor", {
              resource: `${t(resource.kind === "room" ? "limits.rooms" : "roles.instructor")}: ${resourceName}`,
            })
          : t("availability")
      }
    >
      <h3 className="text-lg font-semibold">{t("availability")}</h3>
      <p className="text-sm text-muted-foreground">{t("availabilityHint")}</p>
      <Button type="button" variant="outline" onClick={saved}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!rules && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {rules && (
        <div className="space-y-4">
          {rules.length === 0 && <p>{t("noRules")}</p>}
          {rules.map((rule) => (
            <RuleForm
              key={`${rule.entity?.id}:${rule.versions[0]?.version}`}
              scope={scope}
              resource={resource}
              existing={rule}
              onSaved={saved}
            />
          ))}
          <RuleForm key={`new:${retry}`} scope={scope} resource={resource} onSaved={saved} />
        </div>
      )}
      <ClosureList
        key={retry}
        scope={scope}
        resource={resource}
        revision={retry}
        resourceName={resourceName}
      />
      <ExceptionForm scope={scope} resource={resource} onSaved={saved} />
    </section>
  );
}
