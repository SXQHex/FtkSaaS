"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { StarterRetainedScope } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { retainedScopeValid, type RetentionResources } from "../../lib/plan-downgrade";
import {
  readOwnerRetention,
  readOwnerResources,
  type RetainedPerson,
} from "../../lib/owner-retention";
import { useRemote } from "../../lib/use-remote";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";
const control = "min-h-11 w-full rounded-md border bg-background px-3";
export function RetentionForm({
  scope,
  target,
  version,
  onReview,
  onDirty,
}: {
  scope: SetupScope;
  target: string;
  version: number;
  onReview: (selected: StarterRetainedScope, labels: string[]) => void;
  onDirty: () => void;
}) {
  const t = useTranslations("planChange"),
    load = useCallback(() => readOwnerRetention(scope, target, version), [scope, target, version]),
    result = useRemote(load, JSON.stringify([scope, target, version]));
  return (
    <section className="space-y-4" aria-label={t("retention")}>
      <h4>{t("retention")}</h4>
      <p>{t("retentionHint")}</p>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <ResourceSelection
          scope={scope}
          target={target}
          version={version}
          resources={result.data}
          onReview={onReview}
          onDirty={onDirty}
        />
      )}
    </section>
  );
}
function ResourceSelection({
  scope,
  resources,
  target,
  version,
  onReview,
  onDirty,
}: {
  scope: SetupScope;
  resources: RetentionResources;
  target: string;
  version: number;
  onReview: (selected: StarterRetainedScope, labels: string[]) => void;
  onDirty: () => void;
}) {
  const t = useTranslations("planChange"),
    [selection, setSelection] = useState<StarterRetainedScope>({
      room_id: null,
      discipline_id: null,
      instructor_id: null,
      student_person_ids: [],
    }),
    [students, setStudents] = useState<RetainedPerson[]>([]),
    [noStudents, setNoStudents] = useState(false);
  const families = [
    ["room_id", "rooms"],
    ["discipline_id", "disciplines"],
    ["instructor_id", "instructors"],
  ] as const;
  return (
    <div className="space-y-4">
      {families.map(([field, family]) => (
        <label className="block space-y-2" key={field}>
          {t(family)}
          <select
            className={control}
            value={selection[field] ?? ""}
            disabled={!resources[family].length}
            onChange={(e) => {
              onDirty();
              setSelection((s) => ({ ...s, [field]: e.target.value || null }));
            }}
          >
            <option value="">{t(resources[family].length ? "choose" : "none")}</option>
            {resources[family].map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <StudentSelection
        scope={scope}
        target={target}
        version={version}
        selected={students}
        onChange={(next) => {
          onDirty();
          setNoStudents(false);
          setStudents(next);
          setSelection((s) => ({ ...s, student_person_ids: next.map((p) => p.id) }));
        }}
      />
      {!students.length && (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={noStudents}
            onChange={(e) => {
              onDirty();
              setNoStudents(e.target.checked);
            }}
          />
          {t("noStudents")}
        </label>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        disabled={!retainedScopeValid(selection, resources) || (!students.length && !noStudents)}
        onClick={() =>
          onReview(selection, [
            ...families.flatMap(([field, family]) =>
              resources[family]
                .filter((r) => r.id === selection[field])
                .map((r) => `${t(family)}: ${r.name}`),
            ),
            ...students.map(
              (p) => `${p.name}${p.subscriber_number ? ` · ${p.subscriber_number}` : ""}`,
            ),
          ])
        }
      >
        {t("review")}
      </Button>
    </div>
  );
}
function StudentSelection({
  scope,
  selected,
  target,
  version,
  onChange,
}: {
  scope: SetupScope;
  target: string;
  version: number;
  selected: RetainedPerson[];
  onChange: (people: RetainedPerson[]) => void;
}) {
  const t = useTranslations("planChange"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const load = useCallback(
      () => readOwnerResources(scope, target, version, "students", search, cursor),
      [scope, target, version, search, cursor],
    ),
    result = useRemote(load, JSON.stringify([scope, search, cursor, attempt]));
  return (
    <section className="space-y-3" aria-label={t("students")}>
      <h5>{t("students")}</h5>
      <p>{t("selectedCount", { count: selected.length })}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        <label>
          {t("searchStudents")}
          <Input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <Button className="h-auto min-h-11 max-w-full whitespace-normal" variant="outline">
          {t("search")}
        </Button>
      </form>
      <ul>
        {selected.map((p) => (
          <li className="flex flex-wrap items-center justify-between gap-2" key={p.id}>
            <span>
              {p.name}
              {p.subscriber_number ? ` · ${p.subscriber_number}` : ""}
            </span>
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => onChange(selected.filter((s) => s.id !== p.id))}
            >
              {t("remove", { name: p.name })}
            </Button>
          </li>
        ))}
      </ul>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <>
          <ul className="space-y-2">
            {result.data.items.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.some((s) => s.id === p.id)}
                    disabled={selected.length >= 100 && !selected.some((s) => s.id === p.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked ? [...selected, p] : selected.filter((s) => s.id !== p.id),
                      )
                    }
                  />
                  {p.name}
                  {p.subscriber_number ? ` · ${p.subscriber_number}` : ""}
                </label>
              </li>
            ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => setCursor(result.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
