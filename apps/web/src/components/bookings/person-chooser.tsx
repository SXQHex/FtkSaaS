"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import { bookingApi, type BookingApi } from "../../lib/bookings";
import { FlowError, flowError } from "./flow-controls";
export function PersonChooser({
  scope,
  disabled,
  onSelect,
  read = bookingApi.people,
}: {
  scope: SetupScope;
  disabled: boolean;
  onSelect: (person: PersonSummary | null) => void;
  read?: BookingApi["people"];
}) {
  const t = useTranslations("flows"),
    id = useId(),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [page, setPage] = useState<Awaited<ReturnType<BookingApi["people"]>> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void read(scope, query, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, read, query, cursor, attempt]);
  function reset() {
    onSelect(null);
    setPage(null);
    setError("");
  }
  return (
    <section className="space-y-3" aria-label={t("choosePerson")}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          reset();
          setCursor(undefined);
          setQuery(search.trim());
          setAttempt((n) => n + 1);
        }}
      >
        <div className="min-w-0 grow space-y-2">
          <Label htmlFor={id}>{t("choosePerson")}</Label>
          <Input
            id={id}
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button className="h-auto min-h-11 max-w-full whitespace-normal" disabled={disabled}>
          {t("search")}
        </Button>
      </form>
      {error ? (
        <FlowError code={error} />
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {!page.items.length && <p>{t("emptyPeople")}</p>}
          <ul className="space-y-2">
            {page.items.map((person) => (
              <li key={person.id}>
                <Button
                  className="h-auto min-h-11 max-w-full whitespace-normal"
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onSelect(person)}
                >
                  {person.display_name}
                  {person.subscriber_number ? ` · ${person.subscriber_number}` : ""}
                </Button>
              </li>
            ))}
          </ul>
          {page.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              type="button"
              disabled={disabled}
              variant="outline"
              onClick={() => {
                reset();
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
