import { useTranslation } from "react-i18next";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import type { EventDraft } from "./event-draft";
export interface EventChoice {
  id: string;
  name: string;
}

export function EventTermsFields({
  draft,
  onDraft,
  products,
  people,
  disabled,
}: {
  draft: EventDraft;
  onDraft: (value: EventDraft) => void;
  products: EventChoice[];
  people: EventChoice[];
  disabled: boolean;
}) {
  const { t } = useTranslation();
  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    onDraft({ ...draft, [key]: value, reviewed: false });
  }
  return (
    <>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="event-fee">{t(($) => $.events.editor.fee)}</FieldLabel>
          <Input
            id="event-fee"
            name="fee"
            inputMode="decimal"
            value={draft.kind === "practice" ? "0" : draft.fee}
            disabled={disabled || draft.kind === "practice"}
            onChange={(event) => set("fee", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="event-currency">{t(($) => $.events.editor.currency)}</FieldLabel>
          <Input
            id="event-currency"
            name="currency"
            autoCapitalize="characters"
            maxLength={3}
            value={draft.currency}
            disabled={disabled}
            onChange={(event) => set("currency", event.target.value.toUpperCase())}
          />
        </Field>
      </FieldGroup>
      <Field orientation="horizontal">
        <Checkbox
          id="event-full-payment"
          name="full_payment"
          isSelected={draft.fullPayment}
          onChange={(value) => set("fullPayment", value)}
          isDisabled={disabled || draft.kind === "practice"}
        />
        <FieldLabel htmlFor="event-full-payment">
          {t(($) => $.events.editor.fullPayment)}
        </FieldLabel>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">{t(($) => $.events.editor.products)}</FieldLegend>
        <FieldDescription>
          {draft.kind === "practice"
            ? t(($) => $.events.practiceHint)
            : t(($) => $.events.editor.productsHint)}
        </FieldDescription>
        {products.length === 0 && (
          <FieldDescription>{t(($) => $.events.editor.noProducts)}</FieldDescription>
        )}
        {products.map((product) => (
          <Field key={product.id} orientation="horizontal">
            <Checkbox
              id={`event-product-${product.id}`}
              name="products"
              value={product.id}
              isSelected={draft.productIds.includes(product.id)}
              isDisabled={disabled}
              onChange={(value) =>
                set(
                  "productIds",
                  value
                    ? [...draft.productIds, product.id]
                    : draft.productIds.filter((id) => id !== product.id),
                )
              }
            />
            <FieldLabel htmlFor={`event-product-${product.id}`}>{product.name}</FieldLabel>
          </Field>
        ))}
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">{t(($) => $.events.editor.cancellation)}</FieldLegend>
        <Field>
          <FieldLabel htmlFor="event-cutoff">{t(($) => $.events.editor.cutoff)}</FieldLabel>
          <Input
            id="event-cutoff"
            name="cutoff"
            inputMode="numeric"
            value={draft.cutoff}
            disabled={disabled}
            onChange={(event) => set("cutoff", event.target.value)}
          />
        </Field>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["before", "after", "noShow"] as const).map((key) => (
            <Field key={key}>
              <FieldLabel htmlFor={`event-${key}`}>{t(($) => $.events.editor[key])}</FieldLabel>
              <NativeSelect
                id={`event-${key}`}
                name={key}
                value={draft[key]}
                disabled={disabled}
                onChange={(event) => set(key, event.target.value as EventDraft[typeof key])}
                className="w-full"
              >
                <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
                <NativeSelectOption value="release">
                  {t(($) => $.events.editor.release)}
                </NativeSelectOption>
                <NativeSelectOption value="consume">
                  {t(($) => $.events.editor.consume)}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          ))}
        </FieldGroup>
        <Field>
          <FieldLabel htmlFor="event-refund">{t(($) => $.events.editor.refund)}</FieldLabel>
          <NativeSelect
            id="event-refund"
            name="refund"
            value={draft.refund}
            disabled={disabled}
            onChange={(event) => set("refund", event.target.value as EventDraft["refund"])}
            className="w-full"
          >
            <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
            {(["none", "credit_ratio", "used_at_unit_price", "time_ratio"] as const).map((key) => (
              <NativeSelectOption key={key} value={key}>
                {t(($) => $.events.refunds[key])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {draft.refund === "used_at_unit_price" && (
          <Field>
            <FieldLabel htmlFor="event-used-unit">{t(($) => $.events.editor.usedUnit)}</FieldLabel>
            <Input
              id="event-used-unit"
              name="used_unit"
              inputMode="decimal"
              value={draft.usedUnit}
              disabled={disabled}
              onChange={(event) => set("usedUnit", event.target.value)}
            />
          </Field>
        )}
      </FieldSet>
      <Field>
        <FieldLabel htmlFor="event-document">{t(($) => $.events.editor.document)}</FieldLabel>
        <NativeSelect id="event-document" disabled className="w-full">
          <NativeSelectOption value="">
            {t(($) => $.events.editor.documentSource)}
          </NativeSelectOption>
        </NativeSelect>
        <FieldDescription>{t(($) => $.events.editor.documentHint)}</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">{t(($) => $.events.editor.duties)}</FieldLegend>
        {people.length === 0 && (
          <FieldDescription>{t(($) => $.events.editor.noPeople)}</FieldDescription>
        )}
        {people.map((person) => {
          const duty = draft.duties.find((row) => row.personId === person.id);
          return (
            <div key={person.id} className="flex flex-col gap-3">
              <Field orientation="horizontal">
                <Checkbox
                  id={`event-duty-${person.id}`}
                  name="duties"
                  value={person.id}
                  isSelected={!!duty}
                  isDisabled={disabled}
                  onChange={(value) =>
                    set(
                      "duties",
                      value
                        ? [
                            ...draft.duties,
                            {
                              personId: person.id,
                              duty: "instructor",
                              fee: "",
                              currency: draft.currency,
                            },
                          ]
                        : draft.duties.filter((row) => row.personId !== person.id),
                    )
                  }
                />
                <FieldLabel htmlFor={`event-duty-${person.id}`}>{person.name}</FieldLabel>
              </Field>
              {duty && (
                <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor={`event-duty-role-${person.id}`}>
                      {t(($) => $.events.editor.duty)}
                    </FieldLabel>
                    <NativeSelect
                      id={`event-duty-role-${person.id}`}
                      name="duty_role"
                      value={duty.duty}
                      disabled={disabled}
                      onChange={(event) =>
                        set(
                          "duties",
                          draft.duties.map((row) =>
                            row.personId === person.id
                              ? { ...row, duty: event.target.value as "instructor" | "assistant" }
                              : row,
                          ),
                        )
                      }
                      className="w-full"
                    >
                      <NativeSelectOption value="instructor">
                        {t(($) => $.events.editor.instructor)}
                      </NativeSelectOption>
                      <NativeSelectOption value="assistant">
                        {t(($) => $.events.editor.assistant)}
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  {(["fee", "currency"] as const).map((key) => (
                    <Field key={key}>
                      <FieldLabel htmlFor={`event-duty-${key}-${person.id}`}>
                        {t(($) => $.events.editor[key])}
                      </FieldLabel>
                      <Input
                        id={`event-duty-${key}-${person.id}`}
                        name={`duty_${key}`}
                        value={duty[key]}
                        disabled={disabled}
                        onChange={(event) =>
                          set(
                            "duties",
                            draft.duties.map((row) =>
                              row.personId === person.id
                                ? { ...row, [key]: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                </FieldGroup>
              )}
            </div>
          );
        })}
      </FieldSet>
    </>
  );
}
