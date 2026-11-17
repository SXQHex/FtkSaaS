import { useTranslation } from "react-i18next";
import type {
  CrmTrialProductDiscovery,
  CrmTrialHistoryDiscovery,
} from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import { Field, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Badge } from "../../components/ui/badge";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";

export function TrialSessionFields({
  day,
  onDay,
  category,
  onCategory,
  split,
  disabled,
  error,
}: {
  day: string;
  onDay: (day: string) => void;
  category: string;
  onCategory: (category: string) => void;
  split: boolean;
  disabled: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field>
        <FieldLabel htmlFor="lead-trial-day">{t(($) => $.leads.trialDay)}</FieldLabel>
        <Input
          type="date"
          id="lead-trial-day"
          name="trial-day"
          value={day}
          disabled={disabled}
          onChange={(event) => onDay(event.target.value)}
        />
      </Field>
      {split && (
        <Field>
          <FieldLabel htmlFor="lead-trial-category">
            {t(($) => $.sessionDetail.category)}
          </FieldLabel>
          <NativeSelect
            id="lead-trial-category"
            name="booking-category"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "lead-trial-category-error" : undefined}
            value={category}
            disabled={disabled}
            onChange={(event) => onCategory(event.target.value)}
          >
            <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
            <NativeSelectOption value="male">{t(($) => $.sessionDetail.male)}</NativeSelectOption>
            <NativeSelectOption value="female">
              {t(($) => $.sessionDetail.female)}
            </NativeSelectOption>
          </NativeSelect>
          <FieldError id="lead-trial-category-error">{error}</FieldError>
        </Field>
      )}
    </>
  );
}
export function TrialProductTerms({ product }: { product?: CrmTrialProductDiscovery }) {
  const { t } = useTranslation();
  return product ? (
    <div className="flex flex-col gap-2 text-sm">
      <p>{formatMinorAmount(product.price_minor, product.currency)}</p>
      <p>{t(($) => $.leads.trialMinutes, { count: product.offer_minutes })}</p>
      <p>{t(($) => $.leads.trialPolicyStates[product.offer_policy_state])}</p>
      <p>
        {t(($) =>
          product.confirmation_requires_paid_entitlement
            ? $.leads.trialPaidRequired
            : $.leads.trialFree,
        )}
      </p>
      <p className="text-muted-foreground">{t(($) => $.leads.trialChecks)}</p>
    </div>
  ) : null;
}
export function TrialHistory({
  rows,
  timezone,
}: {
  rows: CrmTrialHistoryDiscovery[];
  timezone: string;
}) {
  const { t } = useTranslation();
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t(($) => $.leads.trialHistory)}</h3>
      <ItemGroup>
        {rows.map((row) => (
          <Item key={row.offer_id} role="listitem" size="xs">
            <ItemContent>
              <ItemTitle>
                {formatMinorAmount(row.price_minor, row.currency)}{" "}
                <Badge variant="secondary">{t(($) => $.leads.trialStates[row.state])}</Badge>
              </ItemTitle>
              <ItemDescription>
                {t(($) => $.leads.trialDates, {
                  created: date(row.created_at),
                  expires: date(row.expires_at),
                })}
              </ItemDescription>
              <ItemDescription>
                {t(($) =>
                  row.registration_id
                    ? $.leads.trialRegistered
                    : row.session_id
                      ? $.leads.trialSessionBound
                      : $.leads.noSession,
                )}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">{t(($) => $.leads.trialHistoryEmpty)}</p>
      )}
    </section>
  );
}
