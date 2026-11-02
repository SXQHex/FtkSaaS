"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { PolicyView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { exceptionInterval, setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { policyValue, setupPolicyKeys, type SetupPolicyKey } from "../../lib/setup-policy";
import { SetupFeedback, useSetupCommand, errorKey } from "./setup-command";

function PolicyForm({
  scope,
  policyKey,
  current,
  onSaved,
}: {
  scope: SetupScope;
  policyKey: SetupPolicyKey;
  current?: PolicyView;
  onSaved: () => void;
}) {
  const t = useTranslations("setup");
  const command = useSetupCommand(scope, `policy:${policyKey}`, onSaved);
  const [invalid, setInvalid] = useState(false);
  const value = current?.value;
  function number(name: string, label: string, initial?: number | null) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${policyKey}-${name}`}>{t(label)}</Label>
        <Input
          id={`${policyKey}-${name}`}
          name={name}
          type="number"
          min={0}
          step={1}
          defaultValue={initial ?? ""}
          required
        />
      </div>
    );
  }
  function choice(name: string, label: string, options: readonly string[], initial?: string) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${policyKey}-${name}`}>{t(label)}</Label>
        <select
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          id={`${policyKey}-${name}`}
          name={name}
          defaultValue={initial ?? ""}
          required
        >
          <option value="" disabled>
            {t("chooseValue")}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {t(option === "true" ? "yes" : option === "false" ? "no" : option)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <form
      className="space-y-4 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const effective = String(data.get("effective"));
          const effective_at = exceptionInterval(effective, "9999-12-31T23:59:59Z").starts_at;
          const mandatory = data.get("mandatory");
          if (mandatory !== "true" && mandatory !== "false") throw Error("invalidPolicy");
          const selected = policyValue(policyKey, data);
          setInvalid(false);
          void command.run({
            operation: "policy_publish_v1",
            input: {
              org_id: scope.orgId,
              operation_key: v7(),
              key: policyKey,
              value: selected,
              effective_at,
              mandatory: mandatory === "true",
            },
          });
        } catch {
          setInvalid(true);
        }
      }}
    >
      <fieldset disabled={command.busy || !!command.pending} className="space-y-4">
        {current ? (
          <p className="text-sm">{t("policyVersion", { version: current.version })}</p>
        ) : (
          <p>{t("policyMissing")}</p>
        )}
        {(["negative_default", "negative_upper"] as string[]).includes(policyKey) &&
          number("value", "value", value?.kind === "integer" ? value.value : undefined)}
        {(["debt_booking", "debt_participation"] as string[]).includes(policyKey) &&
          choice(
            "value",
            "booleanChoice",
            ["true", "false"],
            value?.kind === "boolean" ? String(value.value) : undefined,
          )}
        {(["reservation_window", "request_window"] as string[]).includes(policyKey) && (
          <>
            {number(
              "opens",
              "opens",
              value?.kind === "window" ? value.opens_minutes_before : undefined,
            )}
            {number(
              "closes",
              "closes",
              value?.kind === "window" ? value.closes_minutes_before : undefined,
            )}
            {choice(
              "manager",
              "managerException",
              ["true", "false"],
              value?.kind === "window" ? String(value.manager_exception) : undefined,
            )}
          </>
        )}
        {(["student_cancel_private", "student_cancel_group"] as string[]).includes(policyKey) && (
          <>
            {number(
              "cutoff",
              "cutoff",
              value?.kind === "cancellation" ? value.terms.cutoff_minutes : undefined,
            )}
            {choice(
              "before",
              "beforeCutoff",
              ["release", "consume"],
              value?.kind === "cancellation" ? value.terms.before_cutoff : undefined,
            )}
            {choice(
              "after",
              "afterCutoff",
              ["release", "consume"],
              value?.kind === "cancellation" ? value.terms.after_cutoff : undefined,
            )}
            {choice(
              "noShow",
              "noShow",
              ["release", "consume"],
              value?.kind === "cancellation" ? value.terms.no_show : undefined,
            )}
          </>
        )}
        {policyKey === "participation_block_credit" &&
          choice(
            "effect",
            "value",
            ["release", "consume"],
            value?.kind === "blocked_credit" ? value.effect : undefined,
          )}
        <Label htmlFor={`${policyKey}-effective`}>{t("effectiveAt")}</Label>
        <Input
          id={`${policyKey}-effective`}
          name="effective"
          placeholder="2030-01-01T18:00:00+03:00"
          required
        />
        {choice(
          "mandatory",
          "mandatory",
          ["true", "false"],
          current ? String(current.mandatory) : undefined,
        )}
        <Button>{t("publishPolicy")}</Button>
      </fieldset>
      {invalid && <p role="alert">{t("invalidPolicy")}</p>}
      <SetupFeedback command={command} />
    </form>
  );
}
export function PolicySetup({ scope }: { scope: SetupScope }) {
  const t = useTranslations("setup");
  const [policies, setPolicies] = useState<PolicyView[] | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void setupCall("policies_get_v1", { org_id: scope.orgId, keys: [...setupPolicyKeys] })
      .then((rows) => {
        if (active) {
          setPolicies(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setPolicies(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, retry]);
  function refresh() {
    setPolicies(null);
    setError("");
    setRetry((n) => n + 1);
  }
  return (
    <section className="space-y-4 border-t pt-6" aria-label={t("policyTitle")}>
      <h3 className="text-lg font-semibold">{t("policyTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("policyHint")}</p>
      <Button variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!policies && !error && <output aria-live="polite">{t("loading")}</output>}
      {policies &&
        setupPolicyKeys.map((key) => {
          const current = policies.find((p) => p.key === key);
          return (
            <details
              key={`${key}:${current?.version ?? "new"}:${retry}`}
              className="rounded-lg border p-4"
            >
              <summary className="cursor-pointer font-medium">{t(`policyKeys.${key}`)}</summary>
              <PolicyForm scope={scope} policyKey={key} current={current} onSaved={refresh} />
            </details>
          );
        })}
    </section>
  );
}
