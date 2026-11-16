import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

import type { EventCollectionDraft } from "./event-registration-draft";

export function EventPaymentPanel({
  facts,
  draft,
  onDraft,
  prepared,
  onPrepare,
  onCollect,
  canPrepare,
  canCollect,
  locked = false,
}: {
  facts: { label: string; value: string }[];
  draft: EventCollectionDraft;
  onDraft: (value: EventCollectionDraft) => void;
  prepared: boolean;
  onPrepare: () => void;
  onCollect: () => void;
  canPrepare: boolean;
  canCollect: boolean;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof EventCollectionDraft>(key: K, value: EventCollectionDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t(($) => $.eventDetail.registration.paymentItems)}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            {facts.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="break-words text-sm font-medium tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {!prepared && (
        <Button
          variant="outline"
          type="button"
          isDisabled={locked || !canPrepare}
          onPress={onPrepare}
        >
          {t(($) => $.eventDetail.registration.prepare)}
        </Button>
      )}
      <Alert>
        <AlertDescription>{t(($) => $.eventDetail.registration.prepareHint)}</AlertDescription>
      </Alert>
      <Field>
        <FieldLabel>{t(($) => $.eventDetail.registration.collection)}</FieldLabel>
        <ToggleGroup
          aria-label={t(($) => $.eventDetail.registration.collection)}
          selectionMode="single"
          disallowEmptySelection
          variant="segmented"
          selectedKeys={draft.choice ? [draft.choice] : []}
          onSelectionChange={(keys) => {
            const choice = [...keys][0];
            if (choice === "now" || choice === "later") set("choice", choice);
          }}
          className="max-w-full flex-wrap"
        >
          <ToggleGroupItem id="now" isDisabled={locked}>
            {t(($) => $.eventDetail.registration.collectNow)}
          </ToggleGroupItem>
          <ToggleGroupItem id="later" isDisabled={locked}>
            {t(($) => $.eventDetail.registration.collectLater)}
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
      {draft.choice === "now" && (
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="event-collection-amount">
              {t(($) => $.eventDetail.registration.amount)}
            </FieldLabel>
            <Input
              id="event-collection-amount"
              name="amount_minor"
              inputMode="numeric"
              value={draft.amount}
              disabled={locked}
              onChange={(event) => set("amount", event.target.value)}
            />
            <FieldDescription>{t(($) => $.events.editor.moneyHint)}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="event-collection-method">
              {t(($) => $.eventDetail.registration.method)}
            </FieldLabel>
            <NativeSelect
              id="event-collection-method"
              name="payment_method"
              value={draft.method}
              disabled={locked}
              onChange={(event) =>
                set("method", event.target.value as EventCollectionDraft["method"])
              }
              className="w-full"
            >
              <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
              <NativeSelectOption value="bank_transfer">
                {t(($) => $.eventDetail.registration.bank)}
              </NativeSelectOption>
              <NativeSelectOption value="cash">
                {t(($) => $.eventDetail.registration.cash)}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="event-collection-time">
              {t(($) => $.eventDetail.registration.collectedAt)}
            </FieldLabel>
            <Input
              id="event-collection-time"
              name="occurred_at"
              type="datetime-local"
              value={draft.occurredAt}
              disabled={locked}
              onChange={(event) => set("occurredAt", event.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="event-collection-reference">
              {t(($) => $.eventDetail.registration.reference)}
            </FieldLabel>
            <Input
              id="event-collection-reference"
              name="reference"
              value={draft.reference}
              disabled={locked}
              onChange={(event) => set("reference", event.target.value)}
              required={draft.method === "bank_transfer"}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="event-collection-note">
              {t(($) => $.eventDetail.registration.note)}
            </FieldLabel>
            <Input
              id="event-collection-note"
              name="note"
              value={draft.note}
              disabled={locked}
              onChange={(event) => set("note", event.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            type="button"
            isDisabled={locked || !canCollect}
            onPress={onCollect}
          >
            {t(($) => $.eventDetail.registration.collect)}
          </Button>
        </FieldGroup>
      )}
    </div>
  );
}
