import { useId, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, LinkButton } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import { formatMinorAmount } from "../../lib/money";
import { PlatformReadError } from "./platform-read-error";
import { PlatformBillingReview } from "./platform-billing-review";
import { platformAccessDenied } from "./platform-directory";
import {
  billingIntent,
  billingReason,
  paymentHref,
  paymentState,
  platformPaymentsKey,
  readPaymentDetail,
  readPayments,
  type BillingIntent,
} from "./platform-payment";

const occurredFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});
const periodFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeZone: "Europe/Istanbul",
});
function quotePeriod(period: { starts_at: string; ends_at: string }) {
  return periodFormat.formatRange(new Date(period.starts_at), new Date(period.ends_at));
}

export function PlatformPayments({ accountId, orgId }: { accountId: string; orgId?: string }) {
  const { t } = useTranslation();
  const filterId = useId();
  const [state, setState] = useState<(typeof paymentState.options)[number]>();
  const query = useInfiniteQuery({
    queryKey: [...platformPaymentsKey(accountId), orgId, state],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readPayments(accountId, orgId, state, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    refetchOnMount: "always",
    gcTime: 0,
  });
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const cursor = query.data?.pages.at(-1)?.next_cursor;
  const invalid =
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    (!!cursor && query.data?.pageParams.includes(cursor));
  const title = t(($) => $.platform.billing.payments);
  if (platformAccessDenied(query.error))
    return <PlatformReadError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {orgId && (
            <LinkButton href={paymentHref()} variant="outline">
              {t(($) => $.platform.billing.allOrganizations)}
            </LinkButton>
          )}
          <Field className="w-fit">
            <FieldLabel htmlFor={filterId}>{t(($) => $.platform.billing.state)}</FieldLabel>
            <NativeSelect
              id={filterId}
              value={state ?? ""}
              onChange={(event) => setState(paymentState.safeParse(event.target.value).data)}
            >
              <NativeSelectOption value="">
                {t(($) => $.platform.billing.allStates)}
              </NativeSelectOption>
              {paymentState.options.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(($) => $.platform.billing.states[value])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {query.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : query.isError || invalid ? (
          <PlatformReadError error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <p>{t(($) => $.platform.billing.empty)}</p>
        ) : (
          <>
            <Table aria-label={title} scrollRegionLabel={title} className="min-w-[51rem]">
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.platform.billing.reference)}</TableHead>
                <TableHead>{t(($) => $.platform.organization)}</TableHead>
                <TableHead>{t(($) => $.platform.billing.quotePeriod)}</TableHead>
                <TableHead>{t(($) => $.platform.billing.amount)}</TableHead>
                <TableHead>{t(($) => $.platform.billing.occurred)}</TableHead>
                <TableHead>{t(($) => $.platform.billing.state)}</TableHead>
              </TableHeader>
              <TableBody items={rows}>
                {(row) => (
                  <TableRow id={row.id}>
                    <TableCell>
                      <LinkButton
                        variant="ghost"
                        size="sm"
                        className="max-w-64 whitespace-normal wrap-anywhere"
                        href={paymentHref(row.org_id, row.id)}
                      >
                        {row.reference || row.id}
                      </LinkButton>
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal wrap-anywhere">
                      {row.org_name ?? row.org_id}
                    </TableCell>
                    <TableCell>
                      {row.quote_period
                        ? quotePeriod(row.quote_period)
                        : t(($) => $.platform.billing.noQuotePeriod)}
                    </TableCell>
                    <TableCell>{formatMinorAmount(row.amount_minor, row.currency)}</TableCell>
                    <TableCell>
                      <time dateTime={row.occurred_at}>
                        {occurredFormat.format(new Date(row.occurred_at))}
                      </time>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(($) => $.platform.billing.states[row.state])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {query.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              >
                {t(($) => $.platform.billing.more)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformPaymentDetail({
  accountId,
  orgId,
  paymentId,
  onDenied,
}: {
  accountId: string;
  orgId: string;
  paymentId: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const reasonId = useId();
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [review, setReview] = useState<{ intent: BillingIntent; title: string; detail: string }>();
  const key = ["platform-payment", accountId, orgId, paymentId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readPaymentDetail(accountId, orgId, paymentId),
    retry: false,
    refetchOnMount: "always",
    gcTime: 0,
  });
  const result = query.isError ? undefined : query.data;
  const row = result?.row;
  function prepare(accepted: boolean) {
    if (!row || !result || row.state !== "pending" || query.isFetching) return;
    const parsed = billingReason.safeParse(reason);
    if (!parsed.success) {
      setInvalid(true);
      reasonField.current?.focus();
      return;
    }
    setReview({
      intent: billingIntent(accountId, orgId, {
        kind: "payment",
        id: row.id,
        version: row.version,
        accepted,
        reason: parsed.data,
      }),
      title: t(($) => (accepted ? $.platform.billing.accept : $.platform.billing.reject)),
      detail: t(($) => $.platform.billing.paymentReview, {
        organization: result.organization.name,
        reference: row.reference || row.id,
        amount: formatMinorAmount(row.amount_minor, row.currency),
      }),
    });
  }
  return (
    <>
      <div>
        <LinkButton href={paymentHref(orgId)} variant="outline">
          {t(($) => $.platform.billing.backToQueue)}
        </LinkButton>
      </div>
      {query.isPending ? (
        <p role="status">{t(($) => $.platform.loading)}</p>
      ) : query.isError ? (
        <PlatformReadError error={query.error} onRetry={() => void query.refetch()} />
      ) : result && row ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2 className="wrap-anywhere">{row.reference || row.id}</h2>
            </CardTitle>
            <LinkButton
              href={"/platform?organization_id=" + orgId}
              variant="link"
              className="w-fit max-w-full whitespace-normal wrap-anywhere"
            >
              {result.organization.name}
            </LinkButton>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt>{t(($) => $.platform.billing.quotePeriod)}</dt>
                <dd>
                  {row.quote_period
                    ? quotePeriod(row.quote_period)
                    : t(($) => $.platform.billing.noQuotePeriod)}
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.platform.billing.amount)}</dt>
                <dd>{formatMinorAmount(row.amount_minor, row.currency)}</dd>
              </div>
              <div>
                <dt>{t(($) => $.platform.billing.occurred)}</dt>
                <dd>
                  <time dateTime={row.occurred_at}>
                    {occurredFormat.format(new Date(row.occurred_at))}
                  </time>
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.platform.billing.state)}</dt>
                <dd>
                  <Badge variant="outline">{t(($) => $.platform.billing.states[row.state])}</Badge>
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.platform.subscription)}</dt>
                <dd>
                  {result.organization.subscription_state
                    ? t(($) => $.platform.subscriptions[result.organization.subscription_state!])
                    : t(($) => $.platform.noSubscription)}
                </dd>
              </div>
            </dl>
            {row.state === "pending" && (
              <div className="space-y-3 border-t pt-4">
                <Field>
                  <FieldLabel htmlFor={reasonId}>{t(($) => $.platform.reason)}</FieldLabel>
                  <Textarea
                    ref={reasonField}
                    id={reasonId}
                    value={reason}
                    required
                    maxLength={1000}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? reasonId + "-error" : undefined}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setInvalid(false);
                    }}
                  />
                  {invalid && (
                    <FieldError id={reasonId + "-error"}>
                      {t(($) => $.platform.reasonError)}
                    </FieldError>
                  )}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button isDisabled={query.isFetching} onPress={() => prepare(true)}>
                    {t(($) => $.platform.billing.accept)}
                  </Button>
                  <Button
                    variant="outline"
                    isDisabled={query.isFetching}
                    onPress={() => prepare(false)}
                  >
                    {t(($) => $.platform.billing.reject)}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>{t(($) => $.platform.billing.missing)}</AlertDescription>
        </Alert>
      )}
      {review && (
        <PlatformBillingReview
          {...review}
          sourceKey={key}
          onDenied={onDenied}
          onClose={() => setReview(undefined)}
        />
      )}
    </>
  );
}
