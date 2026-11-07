"use client";
import { useCallback, useState, useId } from "react";
import { useTranslations } from "next-intl";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { crmApi } from "../../lib/crm";
import type { SetupScope } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
import { PersonCreate } from "../students/person-create";
import { studentActions } from "../../lib/students";
import { control, button } from "./fields";
export function PersonPicker({
  scope,
  onSelect,
  create = false,
  label,
}: {
  scope: SetupScope;
  onSelect: (person: PersonSummary) => void;
  create?: boolean;
  label?: string;
}) {
  const t = useTranslations("crm"),
    id = useId(),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const load = useCallback(() => crmApi.people(scope, search, cursor), [scope, search, cursor]);
  const result = useRemote(load, JSON.stringify([scope, search, cursor, attempt]));
  return (
    <section aria-label={label ?? t("person")} className="min-w-0 space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        <Label htmlFor={id}>{label ?? t("person")}</Label>
        <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button className={button}>{t("search")}</Button>
      </form>
      {result?.error && <FlowError code={result.error} />}
      {!result && <output>{t("loading")}</output>}
      {result?.data && (
        <>
          <Label htmlFor={`${id}-select`}>{t("choosePerson")}</Label>
          <select
            id={`${id}-select`}
            className={control}
            defaultValue=""
            onChange={(e) => {
              const p = result.data!.items.find((p) => p.id === e.target.value);
              if (p) onSelect(p);
            }}
          >
            <option value="">{t("choosePerson")}</option>
            {result.data.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
                {p.subscriber_number ? ` · ${p.subscriber_number}` : ""}
              </option>
            ))}
          </select>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => setCursor(result.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      {create && scope.centerId && (
        <PersonCreate
          scope={{ ...scope, centerId: scope.centerId }}
          actions={studentActions}
          onCreated={() => {
            setCursor(undefined);
            setAttempt((n) => n + 1);
            return true;
          }}
        />
      )}
    </section>
  );
}
