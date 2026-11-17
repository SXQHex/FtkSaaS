import { useRef } from "react";
import { v7 as uuidv7 } from "uuid";
import { useTranslation } from "react-i18next";
import type { ProductView } from "../../lib/api-contracts/generated";
import { componentDraft, type PayComponentDraft, type PayTermsDraft } from "./agreement";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";

function TermsInput({
  id,
  label,
  value,
  onChange,
  percent = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  percent?: boolean;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={percent ? "decimal" : "numeric"}
        required
        pattern={percent ? "[0-9]{1,3}([.,][0-9]{1,2})?" : "(0|[1-9][0-9]{0,18})"}
      />
    </Field>
  );
}
function BasisFields({
  id,
  value,
  unit,
  onChange,
}: {
  id: string;
  value: string;
  unit: string;
  onChange: (value: string, unit: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <FieldGroup className="gap-3">
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${id}-basis`}>{t(($) => $.studio.valuationBasis)}</FieldLabel>
        <NativeSelect
          id={`${id}-basis`}
          name={`${id}-basis`}
          value={value}
          onChange={(event) => onChange(event.target.value, unit)}
          required
          className="w-full"
        >
          <option value="">{t(($) => $.studio.choose)}</option>
          <option value="sale_unit">{t(($) => $.studio.saleUnitBasis)}</option>
          <option value="fixed_unit">{t(($) => $.studio.fixedUnitBasis)}</option>
        </NativeSelect>
      </Field>
      {value === "fixed_unit" && (
        <TermsInput
          id={`${id}-unit`}
          label={t(($) => $.studio.fixedBasisMinor)}
          value={unit}
          onChange={(next) => onChange(value, next)}
        />
      )}
    </FieldGroup>
  );
}
function ComponentFields({
  rows,
  onChange,
  disabled,
  packageOnly = false,
  prefix,
}: {
  rows: PayComponentDraft[];
  onChange: (rows: PayComponentDraft[]) => void;
  disabled: boolean;
  packageOnly?: boolean;
  prefix: string;
}) {
  const { t } = useTranslation();
  const addButton = useRef<HTMLButtonElement>(null);
  const change = (key: string, patch: Partial<PayComponentDraft>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <FieldGroup className="gap-4">
      {rows.map((row, index) => (
        <FieldSet key={row.key} className="gap-3 rounded-lg border border-border p-3">
          <FieldLegend variant="label">
            {t(($) => $.studio.payComponentNumber, { number: index + 1 })}
          </FieldLegend>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${prefix}-${row.key}-kind`}>
              {t(($) => $.studio.payComponentKind)}
            </FieldLabel>
            <NativeSelect
              id={`${prefix}-${row.key}-kind`}
              name={`${prefix}-${row.key}-kind`}
              value={row.kind}
              onChange={(event) => change(row.key, { kind: event.target.value })}
              required
              className="w-full"
            >
              <option value="">{t(($) => $.studio.choose)}</option>
              {!packageOnly && (
                <option value="session_fixed">{t(($) => $.studio.payModels.session_fixed)}</option>
              )}
              <option value="per_person">{t(($) => $.studio.payModels.per_person)}</option>
              <option value="percentage">{t(($) => $.studio.payModels.percentage)}</option>
            </NativeSelect>
          </Field>
          {row.kind &&
            (row.kind === "percentage" ? (
              <>
                <TermsInput
                  id={`${prefix}-${row.key}-rate`}
                  label={t(($) => $.studio.percentageRate)}
                  value={row.rate}
                  onChange={(rate) => change(row.key, { rate })}
                  percent
                />
                <BasisFields
                  id={`${prefix}-${row.key}`}
                  value={row.basis}
                  unit={row.unit}
                  onChange={(basis, unit) => change(row.key, { basis, unit })}
                />
              </>
            ) : (
              <TermsInput
                id={`${prefix}-${row.key}-amount`}
                label={t(($) => $.studio.feeMinor)}
                value={row.amount}
                onChange={(amount) => change(row.key, { amount })}
              />
            ))}
          {row.kind && row.kind !== "session_fixed" && (
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`${prefix}-${row.key}-entitlement`}>
                {t(($) => $.studio.componentEntitlement)}
              </FieldLabel>
              <NativeSelect
                id={`${prefix}-${row.key}-entitlement`}
                name={`${prefix}-${row.key}-entitlement`}
                className="w-full"
                value={row.entitlement}
                onChange={(event) => change(row.key, { entitlement: event.target.value })}
                required
              >
                <option value="">{t(($) => $.studio.choose)}</option>
                <option value="all">{t(($) => $.studio.allEntitlements)}</option>
                <option value="credits">{t(($) => $.studio.creditEntitlements)}</option>
                <option value="timed">{t(($) => $.studio.timedEntitlements)}</option>
              </NativeSelect>
            </Field>
          )}
          <Button
            variant="outline"
            size="sm"
            isDisabled={disabled || rows.length <= 1}
            onPress={() => {
              onChange(rows.filter((item) => item.key !== row.key));
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          >
            {t(($) => $.studio.removePayComponent)}
          </Button>
        </FieldSet>
      ))}
      <Button
        variant="outline"
        size="sm"
        isDisabled={disabled}
        ref={addButton}
        onPress={() => {
          const next = componentDraft();
          onChange([...rows, next]);
          requestAnimationFrame(() =>
            document.getElementById(`${prefix}-${next.key}-kind`)?.focus(),
          );
        }}
      >
        {t(($) => $.studio.addPayComponent)}
      </Button>
    </FieldGroup>
  );
}

export function AgreementTermsFields({
  value,
  onChange,
  disabled,
  products,
  loadingProducts,
  productsError,
  onLoadProducts,
}: {
  value: PayTermsDraft;
  onChange: (value: PayTermsDraft) => void;
  disabled: boolean;
  products: ProductView[];
  loadingProducts: boolean;
  productsError: boolean;
  onLoadProducts: () => void;
}) {
  const { t } = useTranslation();
  const addOverride = useRef<HTMLButtonElement>(null);
  const change = (patch: Partial<PayTermsDraft>) => onChange({ ...value, ...patch });
  const models = [
    "session_fixed",
    "per_person",
    "percentage",
    "fixed_plus_person",
    "explicit_mixed",
  ] as const;
  return (
    <FieldGroup className="gap-4">
      <Field className="gap-2">
        <FieldLabel id="agreement-model-label">{t(($) => $.studio.feeModel)}</FieldLabel>
        <ToggleGroup
          variant="segmented"
          size="segmented"
          selectionMode="single"
          disallowEmptySelection
          aria-labelledby="agreement-model-label"
          className="max-w-full flex-wrap"
          selectedKeys={new Set(value.model ? [value.model] : [])}
          isDisabled={disabled}
          onSelectionChange={(keys) => change({ model: String([...keys][0]) })}
        >
          {models.map((model) => (
            <ToggleGroupItem key={model} id={model}>
              {t(($) => $.studio.payModels[model])}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem id="hour" isDisabled>
            {t(($) => $.studio.hourly)}
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription variant="hint">{t(($) => $.studio.hourlyUnavailable)}</FieldDescription>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor="agreement-currency">{t(($) => $.studio.currency)}</FieldLabel>
        <Input
          id="agreement-currency"
          name="currency"
          value={value.currency}
          onChange={(event) => change({ currency: event.target.value.toUpperCase() })}
          required
          pattern="[A-Z]{3}"
          maxLength={3}
          autoComplete="transaction-currency"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="agreement-minor-hint"
        />
      </Field>
      <p id="agreement-minor-hint" className="text-xs text-muted-foreground">
        {t(($) => $.studio.minorAmountHint)}
      </p>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{t(($) => $.studio.payComponents)}</FieldLegend>
        <ComponentFields
          prefix="agreement-general"
          rows={value.components}
          onChange={(components) => change({ components })}
          disabled={disabled}
        />
      </FieldSet>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{t(($) => $.studio.roomShare)}</FieldLegend>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="agreement-room-kind">{t(($) => $.studio.roomShareKind)}</FieldLabel>
          <NativeSelect
            id="agreement-room-kind"
            name="roomKind"
            value={value.roomKind}
            onChange={(event) => change({ roomKind: event.target.value })}
            className="w-full"
            required
          >
            <option value="">{t(($) => $.studio.choose)}</option>
            <option value="free">{t(($) => $.studio.roomShareFree)}</option>
            <option value="fixed">{t(($) => $.studio.roomShareFixed)}</option>
            <option value="percentage">{t(($) => $.studio.roomSharePercentage)}</option>
          </NativeSelect>
        </Field>
        {value.roomKind === "fixed" && (
          <TermsInput
            id="agreement-room-amount"
            label={t(($) => $.studio.feeMinor)}
            value={value.roomAmount}
            onChange={(roomAmount) => change({ roomAmount })}
          />
        )}
        {value.roomKind === "percentage" && (
          <>
            <TermsInput
              id="agreement-room-rate"
              label={t(($) => $.studio.percentageRate)}
              value={value.roomRate}
              onChange={(roomRate) => change({ roomRate })}
              percent
            />
            <BasisFields
              id="agreement-room"
              value={value.roomBasis}
              unit={value.roomUnit}
              onChange={(roomBasis, roomUnit) => change({ roomBasis, roomUnit })}
            />
          </>
        )}
        <Field className="gap-1.5">
          <FieldLabel htmlFor="agreement-room-order">
            {t(($) => $.studio.roomShareOrder)}
          </FieldLabel>
          <NativeSelect
            id="agreement-room-order"
            name="roomOrder"
            value={value.roomOrder}
            onChange={(event) => change({ roomOrder: event.target.value })}
            required
            className="w-full"
          >
            <option value="">{t(($) => $.studio.choose)}</option>
            <option value="before_instructor_share">{t(($) => $.studio.roomShareBefore)}</option>
            <option value="after_instructor_share">{t(($) => $.studio.roomShareAfter)}</option>
          </NativeSelect>
        </Field>
      </FieldSet>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{t(($) => $.studio.packageOverrides)}</FieldLegend>
        <FieldDescription variant="hint">{t(($) => $.studio.packageOverrideHint)}</FieldDescription>
        <Button variant="outline" isDisabled={disabled || loadingProducts} onPress={onLoadProducts}>
          {t(($) => $.studio.loadAgreementProducts)}
        </Button>
        {productsError && <p role="status">{t(($) => $.studio.resourceReadError)}</p>}
        {value.overrides.map((override, index) => (
          <FieldSet key={override.key} className="gap-3 rounded-lg border border-border p-3">
            <FieldLegend variant="label">
              {t(($) => $.studio.packageOverrideNumber, { number: index + 1 })}
            </FieldLegend>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`agreement-package-${override.key}`}>
                {t(($) => $.studio.packageProduct)}
              </FieldLabel>
              <NativeSelect
                id={`agreement-package-${override.key}`}
                name={`package-${override.key}`}
                value={override.productId}
                required
                className="w-full"
                onChange={(event) =>
                  change({
                    overrides: value.overrides.map((item) =>
                      item.key === override.key ? { ...item, productId: event.target.value } : item,
                    ),
                  })
                }
              >
                <option value="">{t(($) => $.studio.choose)}</option>
                {override.productId &&
                  !products.some((product) => product.id === override.productId) && (
                    <option value={override.productId}>
                      {t(($) => $.studio.savedPackageLoadList)}
                    </option>
                  )}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.terms.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <ComponentFields
              prefix={`package-${override.key}`}
              rows={override.components}
              disabled={disabled}
              packageOnly
              onChange={(components) =>
                change({
                  overrides: value.overrides.map((item) =>
                    item.key === override.key ? { ...item, components } : item,
                  ),
                })
              }
            />
            <Button
              variant="outline"
              isDisabled={disabled}
              onPress={() => {
                change({ overrides: value.overrides.filter((item) => item.key !== override.key) });
                requestAnimationFrame(() => addOverride.current?.focus());
              }}
            >
              {t(($) => $.studio.removePackageOverride)}
            </Button>
          </FieldSet>
        ))}
        <Button
          variant="outline"
          isDisabled={disabled}
          ref={addOverride}
          onPress={() => {
            const key = uuidv7();
            change({
              overrides: [
                ...value.overrides,
                { key, productId: "", components: [componentDraft()] },
              ],
            });
            requestAnimationFrame(() =>
              document.getElementById(`agreement-package-${key}`)?.focus(),
            );
          }}
        >
          {t(($) => $.studio.addPackageOverride)}
        </Button>
      </FieldSet>
    </FieldGroup>
  );
}
