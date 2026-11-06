"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { emptyComponent, type ComponentDraft } from "../../lib/agreement-command";
export function PayComponents({
  value,
  onChange,
  packageOnly = false,
}: {
  value: ComponentDraft[];
  onChange: (value: ComponentDraft[]) => void;
  packageOnly?: boolean;
}) {
  const t = useTranslations("agreements");
  return (
    <div className="space-y-3">
      {value.map((row, index) => (
        <ComponentFields
          key={index}
          value={row}
          packageOnly={packageOnly}
          onChange={(next) => onChange(value.map((v, i) => (i === index ? next : v)))}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
          number={index + 1}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...value, emptyComponent()])}
      >
        {t("addComponent")}
      </Button>
    </div>
  );
}
function ComponentFields({
  value,
  onChange,
  packageOnly,
  onRemove,
  number,
}: {
  value: ComponentDraft;
  onChange: (value: ComponentDraft) => void;
  packageOnly: boolean;
  onRemove: () => void;
  number: number;
}) {
  const t = useTranslations("agreements"),
    id = useId(),
    set = (key: keyof ComponentDraft, next: string) => onChange({ ...value, [key]: next });
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend>{t("component", { number })}</legend>
      <Label htmlFor={`${id}-kind`}>{t("componentKind")}</Label>
      <select
        id={`${id}-kind`}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        required
        value={value.kind}
        onChange={(event) => onChange({ ...emptyComponent(), kind: event.target.value })}
      >
        <option value="">{t("choose")}</option>
        {(packageOnly
          ? ["percentage", "per_person"]
          : ["percentage", "session_fixed", "per_person"]
        ).map((kind) => (
          <option key={kind} value={kind}>
            {t(`componentKinds.${kind}`)}
          </option>
        ))}
      </select>
      {value.kind && value.kind !== "session_fixed" && (
        <>
          <Label htmlFor={`${id}-entitlement`}>{t("entitlementKind")}</Label>
          <select
            id={`${id}-entitlement`}
            required
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={value.entitlement}
            onChange={(event) => set("entitlement", event.target.value)}
          >
            <option value="">{t("choose")}</option>
            {["all", "credits", "timed"].map((kind) => (
              <option key={kind} value={kind}>
                {t(`entitlements.${kind}`)}
              </option>
            ))}
          </select>
        </>
      )}
      {value.kind === "percentage" ? (
        <>
          <Label htmlFor={`${id}-rate`}>{t("percentage")}</Label>
          <Input
            id={`${id}-rate`}
            required
            inputMode="decimal"
            value={value.rate}
            onChange={(event) => set("rate", event.target.value)}
          />
          <BasisFields value={value} onChange={(next) => onChange({ ...value, ...next })} />
        </>
      ) : (
        value.kind && (
          <>
            <Label htmlFor={`${id}-amount`}>{t("amount")}</Label>
            <Input
              id={`${id}-amount`}
              required
              inputMode="decimal"
              value={value.amount}
              onChange={(event) => set("amount", event.target.value)}
            />
          </>
        )
      )}
      <Button variant="outline" type="button" onClick={onRemove}>
        {t("removeComponent")}
      </Button>
    </fieldset>
  );
}
export function BasisFields({
  value,
  onChange,
}: {
  value: Pick<ComponentDraft, "basis" | "unit">;
  onChange: (value: Pick<ComponentDraft, "basis" | "unit">) => void;
}) {
  const t = useTranslations("agreements"),
    id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-basis`}>{t("basis")}</Label>
      <select
        id={`${id}-basis`}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        required
        value={value.basis}
        onChange={(event) => onChange({ ...value, basis: event.target.value, unit: "" })}
      >
        <option value="">{t("choose")}</option>
        <option value="sale_unit">{t("saleUnit")}</option>
        <option value="fixed_unit">{t("fixedUnit")}</option>
      </select>
      {value.basis === "fixed_unit" && (
        <>
          <Label htmlFor={`${id}-unit`}>{t("unitAmount")}</Label>
          <Input
            id={`${id}-unit`}
            inputMode="decimal"
            required
            value={value.unit}
            onChange={(event) => onChange({ ...value, unit: event.target.value })}
          />
        </>
      )}
    </div>
  );
}
