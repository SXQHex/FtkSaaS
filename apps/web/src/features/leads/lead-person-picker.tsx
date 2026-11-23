import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { readPeoplePage } from "../people/people";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function LeadPersonPicker({
  scope,
  selected,
  onSelect,
  disabled = false,
}: {
  scope: ClientScope;
  selected: PersonSummary | null;
  onSelect: (person: PersonSummary | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation(),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([undefined]);
      setIndex(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const people = useQuery({
    queryKey: ["lead-people", scope.accountId, scope.orgId, scope.centerId, query, cursors[index]],
    queryFn: (context) =>
      readPeoplePage(scope, query, cursors[index], undefined, undefined, undefined, context),
    retry: false,
  });
  const items = people.isError ? [] : (people.data?.items ?? []),
    options =
      selected && !items.some((row) => row.id === selected.id) ? [selected, ...items] : items;
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="lead-person-search">{t(($) => $.leads.searchPerson)}</FieldLabel>
        <Input
          id="lead-person-search"
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="lead-person">{t(($) => $.leads.person)}</FieldLabel>
        <NativeSelect
          id="lead-person"
          value={selected?.id ?? ""}
          disabled={disabled || people.isError || people.isFetching}
          onChange={(event) =>
            onSelect(options.find((row) => row.id === event.target.value) ?? null)
          }
        >
          <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
          {options.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.display_name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {people.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.leads.peopleReadFailed)}{" "}
            <Button
              size="sm"
              variant="outline"
              isDisabled={disabled}
              onPress={() => void people.refetch()}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={disabled || people.isFetching || index === 0}
          onPress={() => setIndex((value) => value - 1)}
        >
          {t(($) => $.people.previous)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={disabled || people.isError || people.isFetching || !people.data?.next_cursor}
          onPress={() => {
            const cursor = people.data?.next_cursor;
            if (cursor) {
              setCursors([...cursors.slice(0, index + 1), cursor]);
              setIndex(index + 1);
            }
          }}
        >
          {t(($) => $.people.next)}
        </Button>
      </div>
    </div>
  );
}
