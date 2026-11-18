import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { Button } from "../../components/ui/button";
import { Field, FieldDescription, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  PreparationSourceReference,
  ResolvedDomainPreparation,
} from "../../lib/api-contracts/generated";

type Preparation = Extract<
  ResolvedDomainPreparation,
  { kind: "program" | "event" | "collection" | "crm" | "automation" }
>;

const fields = {
  program: "programs",
  event: "events",
  collection: "collections",
  crm: "crm",
  automation: "automations",
} as const;

const sourceKey = (source: PreparationSourceReference) =>
  JSON.stringify([source.scope, source.center_id ?? null, source.key, source.version]);

export function PreparationPicker({
  scope,
  kind,
  collectionCurrency,
  disabled,
  onApply,
}: {
  scope: ClientScope;
  kind: Preparation["kind"];
  collectionCurrency?: string;
  disabled: boolean;
  onApply: (preparation: Preparation) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState("");
  const [applied, setApplied] = useState(false);
  const context = {
    client_api_version: 1 as const,
    org_id: scope.orgId,
    center_id: scope.centerId,
  };
  const key = ["preparation-catalog", scope.accountId, scope.orgId, scope.centerId];
  const catalog = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result = await (
        await scopedBackend(scope)
      ).call("settings_catalog_get_v1", {
        ...context,
        request_id: uuidv7(),
        scope: "center",
      });
      if (result.scope !== "center") throw Error("PREPARATION_SOURCE_UNAVAILABLE");
      return result;
    },
    refetchOnMount: "always",
    retry: false,
  });
  const options = catalog.isError
    ? []
    : (catalog.data?.preparation_templates?.[fields[kind]] ?? [])
        .filter(({ source }) =>
          source.scope === "center"
            ? source.center_id === scope.centerId
            : source.center_id == null,
        )
        .filter(
          ({ template }) =>
            !collectionCurrency ||
            ("currency" in template.defaults && template.defaults.currency === collectionCurrency),
        );
  const source = options.find((item) => sourceKey(item.source) === selected)?.source;
  const resolved = useQuery({
    queryKey: [...key, kind, selected, collectionCurrency ?? null],
    queryFn: async () => {
      if (!source) throw Error("PREPARATION_SOURCE_UNAVAILABLE");
      const result = await (
        await scopedBackend(scope)
      ).call("settings_preparation_resolve_v1", {
        ...context,
        request_id: uuidv7(),
        kind,
        source,
      });
      if (
        result.kind !== kind ||
        sourceKey(result.source) !== selected ||
        (collectionCurrency &&
          result.kind === "collection" &&
          result.defaults.currency !== collectionCurrency)
      )
        throw Error("PREPARATION_SOURCE_UNAVAILABLE");
      return result as Preparation;
    },
    enabled: !!source && !disabled && !catalog.isFetching,
    staleTime: 0,
    retry: false,
  });
  if (!options.length) return null;
  const failed = !!selected && (!source || resolved.isError);
  const ready = source && !catalog.isFetching && !resolved.isFetching && !failed && resolved.data;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t(($) => $.settings.preparation.title)}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          id={id}
          value={source ? selected : ""}
          aria-describedby={`${id}-hint`}
          disabled={disabled || catalog.isFetching}
          onChange={(event) => {
            setSelected(event.target.value);
            setApplied(false);
          }}
        >
          <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
          {options.map(({ source, template }) => (
            <NativeSelectOption key={sourceKey(source)} value={sourceKey(source)}>
              {template.name} · {t(($) => $.settings.nativePolicies[source.scope])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          isDisabled={disabled || (!failed && !ready) || catalog.isFetching}
          onPress={() => {
            if (failed) void catalog.refetch();
            else if (ready) {
              onApply(ready);
              setApplied(true);
            }
            setSelected("");
          }}
        >
          {failed ? t(($) => $.profile.loadCurrent) : t(($) => $.settings.preparation.apply)}
        </Button>
      </div>
      <FieldDescription id={`${id}-hint`}>{t(($) => $.settings.preparation.hint)}</FieldDescription>
      <p role="status" className="text-xs text-muted-foreground">
        {failed
          ? t(($) => $.settings.preparation.unavailable)
          : applied
            ? t(($) => $.settings.preparation.applied)
            : undefined}
      </p>
    </Field>
  );
}
