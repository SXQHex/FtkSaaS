import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Switch } from "@ftksaas/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import type { ClientScope } from "../../lib/scoped-backend";
import { readEventProducts } from "../events/events-read";
import { EventTermsFields } from "../events/event-terms-fields";
import type { EventDraft } from "../events/event-draft";

export function EventPreparationFields({
  scope,
  draft,
  onDraft,
  disabled,
}: {
  scope: ClientScope;
  draft: EventDraft;
  onDraft: (draft: EventDraft) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const catalog = useInfiniteQuery({
    queryKey: ["event-choices", scope.accountId, scope.orgId, scope.centerId, "products"],
    queryFn: ({ pageParam }) => readEventProducts(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const choices =
    (catalog.isError ? undefined : catalog.data)?.pages.flatMap((page) =>
      page.items.map((product) => ({ id: product.version_id, name: product.terms.name })),
    ) ?? [];
  for (const id of draft.productIds)
    if (!choices.some((choice) => choice.id === id))
      choices.push({ id, name: t(($) => $.events.existingProduct) });
  return (
    <>
      <ToggleGroup
        aria-label={t(($) => $.settings.preparation.eventKind)}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[draft.kind]}
        isDisabled={disabled}
        onSelectionChange={(keys) => {
          const kind = [...keys][0];
          if (kind === "practice" || kind === "workshop")
            onDraft({ ...draft, kind, fee: kind === "practice" ? "0" : draft.fee });
        }}
      >
        <ToggleGroupItem id="workshop">{t(($) => $.events.editor.workshop)}</ToggleGroupItem>
        <ToggleGroupItem id="practice">{t(($) => $.events.editor.practice)}</ToggleGroupItem>
      </ToggleGroup>
      <Field orientation="horizontal">
        <Switch
          id="preparation-event-unlimited"
          isSelected={draft.unlimited}
          isDisabled={disabled}
          aria-label={t(($) => $.events.editor.unlimited)}
          onChange={(unlimited) => onDraft({ ...draft, unlimited })}
        />
        <FieldLabel htmlFor="preparation-event-unlimited">
          {t(($) => $.events.editor.unlimited)}
        </FieldLabel>
      </Field>
      {!draft.unlimited && (
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {(["nominal", "maximum"] as const).map((field) => (
            <Field key={field}>
              <FieldLabel htmlFor={`preparation-event-${field}`}>
                {t(($) => $.events.editor[field])}
              </FieldLabel>
              <Input
                id={`preparation-event-${field}`}
                type="number"
                min={0}
                required
                value={draft[field]}
                disabled={disabled}
                onChange={(event) => onDraft({ ...draft, [field]: event.target.value })}
              />
            </Field>
          ))}
        </FieldGroup>
      )}
      <EventTermsFields
        draft={draft}
        onDraft={onDraft}
        products={choices}
        people={[]}
        disabled={disabled}
        preparation
        productsFooter={
          catalog.hasNextPage || catalog.isError ? (
            <Button
              type="button"
              variant="outline"
              isDisabled={disabled || catalog.isFetching}
              onPress={() => {
                if (catalog.isError) void catalog.refetch();
                else void catalog.fetchNextPage();
              }}
            >
              {catalog.isError ? t(($) => $.auth.retry) : t(($) => $.events.moreProducts)}
            </Button>
          ) : undefined
        }
      />
      {catalog.isError && <FieldDescription>{t(($) => $.events.catalogError)}</FieldDescription>}
    </>
  );
}
