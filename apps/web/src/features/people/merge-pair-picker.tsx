import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import { FieldGroup, Field, FieldDescription } from "@ftksaas/ui/components/field";
import { Label } from "@ftksaas/ui/components/label";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@ftksaas/ui/components/combobox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { peopleKeys } from "./people-query";
import { readPeoplePage, type PeopleScope } from "./people";
import type { PersonSummary } from "@ftksaas/api-contracts";

export function MergePairPicker({
  scope,
  records,
  locked,
  onRecord,
  onCompare,
}: {
  scope: PeopleScope;
  records: [PersonSummary | null, PersonSummary | null];
  locked: boolean;
  onRecord: (index: 0 | 1, person: PersonSummary | null) => void;
  onCompare: () => void;
}) {
  const { t } = useTranslation();
  const duplicate = records[0] && records[1] && records[0].id === records[1].id;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.peopleMerge.pairTitle)}</h2>
        </CardTitle>
        <CardDescription>{t(($) => $.peopleMerge.pairDescription)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="merge-pair"
          method="post"
          aria-label={t(($) => $.peopleMerge.pairTitle)}
          onSubmit={(event) => {
            event.preventDefault();
            if (duplicate) {
              document.querySelectorAll<HTMLElement>('#merge-pair [role="combobox"]')[1]?.focus();
              return;
            }
            if (!locked && records[0] && records[1]) onCompare();
          }}
        >
          <FieldGroup className="grid min-w-0 gap-4 md:grid-cols-2">
            {([0, 1] as const).map((index) => (
              <PersonPicker
                key={index}
                scope={scope}
                index={index}
                selected={records[index]}
                locked={locked}
                invalid={Boolean(duplicate) && index === 1}
                onSelected={(person) => onRecord(index, person)}
              />
            ))}
          </FieldGroup>
          {duplicate && (
            <Alert id="merge-pair-error" variant="destructive" role="status" className="mt-4">
              <AlertDescription>{t(($) => $.peopleMerge.distinctRequired)}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="merge-pair" isDisabled={locked}>
          {t(($) => $.peopleMerge.compare)}
        </Button>
      </CardFooter>
    </Card>
  );
}
function PersonPicker({
  scope,
  index,
  selected,
  locked,
  invalid,
  onSelected,
}: {
  scope: PeopleScope;
  index: 0 | 1;
  selected: PersonSummary | null;
  locked: boolean;
  invalid: boolean;
  onSelected: (person: PersonSummary | null) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([undefined]);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const people = useQuery({
    queryKey: [...peopleKeys.picker(scope), query, cursors[page]],
    queryFn: (context) =>
      readPeoplePage(scope, query, cursors[page], undefined, undefined, context.signal, context),
    retry: false,
  });
  const items = people.isError ? [] : (people.data?.items ?? []);
  const options =
    !people.isError && selected && !items.some((item) => item.id === selected.id)
      ? [selected, ...items]
      : items;
  if (people.isError)
    return (
      <Field>
        <Label>{t(($) => $.peopleMerge.record, { number: index + 1 })}</Label>
        <Alert role="status">
          <AlertDescription>{t(($) => $.peopleMerge.readError)}</AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          size="sm"
          isDisabled={locked || people.isFetching}
          onPress={() => {
            void people.refetch();
          }}
        >
          {t(($) => $.people.refresh)}
        </Button>
      </Field>
    );
  return (
    <Field>
      <Combobox
        items={options}
        value={selected?.id ?? null}
        inputValue={search}
        onInputChange={setSearch}
        onChange={(key) => onSelected(options.find((item) => item.id === key) ?? null)}
        isRequired
        isInvalid={invalid}
        isDisabled={locked}
        allowsEmptyCollection
        className="flex min-w-0 flex-col gap-2"
      >
        <Label>
          {t(($) => $.peopleMerge.record, { number: index + 1 })} <span aria-hidden="true">*</span>
        </Label>
        <ComboboxInput
          name={`merge-record-${index}`}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full"
          aria-describedby={`merge-picker-help-${index}${invalid ? " merge-pair-error" : ""}`}
        />
        <Text
          slot="description"
          id={`merge-picker-help-${index}`}
          className="text-xs text-muted-foreground"
        >
          {t(($) => $.peopleMerge.searchHelp)}
        </Text>
        <ComboboxContent className="max-w-[calc(100vw-2rem)]">
          <ComboboxList
            renderEmptyState={() => (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {people.isPending
                  ? t(($) => $.peopleMerge.loadingPeople)
                  : people.isError
                    ? t(($) => $.peopleMerge.readError)
                    : t(($) => $.peopleMerge.noPeople)}
              </p>
            )}
          >
            {(person: PersonSummary) => (
              <ComboboxItem id={person.id} textValue={person.display_name}>
                <span className="flex min-w-0 flex-col gap-1 break-words">
                  <span>{person.display_name}</span>
                  {person.subscriber_number && (
                    <span className="text-xs text-muted-foreground">
                      {t(($) => $.peopleMerge.subscriber, { number: person.subscriber_number })}
                    </span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription role="status">
        {people.isFetching
          ? t(($) => $.peopleMerge.loadingPeople)
          : people.isError
            ? t(($) => $.peopleMerge.readError)
            : t(($) => $.peopleMerge.visiblePage, { number: page + 1 })}
      </FieldDescription>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${t(($) => $.people.previous)}: ${t(($) => $.peopleMerge.record, { number: index + 1 })}`}
          isDisabled={locked || page === 0 || people.isFetching}
          onPress={() => setPage((value) => value - 1)}
        >
          {t(($) => $.people.previous)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${t(($) => $.people.next)}: ${t(($) => $.peopleMerge.record, { number: index + 1 })}`}
          isDisabled={locked || people.isFetching || people.isError || !people.data?.next_cursor}
          onPress={() => {
            const next = people.data?.next_cursor;
            if (next) {
              setCursors((old) => [...old.slice(0, page + 1), next]);
              setPage((value) => value + 1);
            }
          }}
        >
          {t(($) => $.people.next)}
        </Button>
      </div>
    </Field>
  );
}
