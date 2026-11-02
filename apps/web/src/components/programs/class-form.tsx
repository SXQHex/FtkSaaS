"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import type { classValues } from "../../lib/program";
export type ClassValues = NonNullable<ReturnType<typeof classValues>>;
export type NamedOption = { id: string; name: string };
export function ClassForm({
  scope,
  current,
  disciplines,
  onSaved,
}: {
  scope: SetupScope;
  current?: ClassValues;
  disciplines: NamedOption[];
  onSaved: () => void;
}) {
  const t = useTranslations("program");
  const id = useId();
  const command = useSetupCommand(scope, `class:${current?.id ?? "new"}`, onSaved);
  const options =
    disciplines.some((d) => d.id === current?.discipline_id) || !current
      ? disciplines
      : [...disciplines, { id: current.discipline_id, name: t("unavailableDiscipline") }];
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void command.run({
          operation: "class_save_v1",
          input: {
            org_id: scope.orgId,
            center_id: scope.centerId,
            operation_key: v7(),
            name: String(data.get("name")).trim(),
            discipline_id: String(data.get("discipline")),
            external_open: data.get("external") === "on",
            ...(current ? { class_id: current.id, expected_version: current.version } : {}),
          },
        });
      }}
    >
      <fieldset disabled={command.busy || !!command.pending} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>{t("className")}</Label>
          <Input id={`${id}-name`} name="name" required defaultValue={current?.name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-discipline`}>{t("discipline")}</Label>
          <select
            id={`${id}-discipline`}
            name="discipline"
            required
            defaultValue={current?.discipline_id ?? ""}
            className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t("choose")}</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="external" defaultChecked={current?.external_open ?? false} />
          {t("externalOpen")}
        </label>
        <p className="text-xs text-muted-foreground">{t("classHint")}</p>
        <Button type="submit" disabled={!disciplines.length}>
          {t(current ? "saveClass" : "createClass")}
        </Button>
      </fieldset>
      <SetupFeedback command={command} />
    </form>
  );
}
