import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { PlatformBillingReview } from "./platform-billing-review";
import {
  billingIntent,
  billingReason,
  parseGraceUntil,
  readGraceDetail,
  type BillingIntent,
} from "./platform-payment";
import { PlatformReadError } from "./platform-read-error";

const utcFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function PlatformGrace({
  accountId,
  orgId,
  onDenied,
}: {
  accountId: string;
  orgId: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const untilField = useRef<HTMLInputElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [invalid, setInvalid] = useState<"reason" | "until">();
  const [review, setReview] = useState<{ intent: BillingIntent; detail: string }>();
  const key = ["platform-grace", accountId, orgId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readGraceDetail(accountId, orgId),
    retry: false,
    refetchOnMount: "always",
    gcTime: 0,
  });
  const source = query.isError ? undefined : query.data;
  if (!source?.organization && !query.isPending && !query.isError) return null;
  const grace = source?.grace;
  const floorIsCurrent =
    !!grace?.until &&
    !!grace.untilAfter &&
    Date.parse(grace.until) === Date.parse(grace.untilAfter);
  function prepare() {
    if (!grace || !source?.organization || query.isFetching) return;
    let date: string;
    try {
      date = parseGraceUntil(until, grace);
    } catch {
      setInvalid("until");
      untilField.current?.focus();
      return;
    }
    const parsed = billingReason.safeParse(reason);
    if (!parsed.success) {
      setInvalid("reason");
      reasonField.current?.focus();
      return;
    }
    setReview({
      intent: billingIntent(accountId, orgId, {
        kind: "grace",
        id: grace.id,
        version: grace.version,
        until: date,
        previous: grace.until,
        reason: parsed.data,
      }),
      detail: t(($) => $.platform.billing.graceReview, {
        organization: source.organization.name,
        until: utcFormat.format(new Date(date)),
      }),
    });
  }
  const title = t(($) => $.platform.billing.extend);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : query.isError ? (
          <PlatformReadError error={query.error} onRetry={() => void query.refetch()} />
        ) : grace?.untilAfter ? (
          <>
            <dl>
              <dt>
                {t(($) =>
                  floorIsCurrent
                    ? $.platform.billing.currentIsFloor
                    : $.platform.billing.currentUntil,
                )}
              </dt>
              <dd>
                {grace.until ? (
                  <time dateTime={grace.until}>{utcFormat.format(new Date(grace.until))} UTC</time>
                ) : (
                  t(($) => $.platform.billing.noCurrentUntil)
                )}
              </dd>
              {!floorIsCurrent && (
                <>
                  <dt className="mt-2">{t(($) => $.platform.billing.deadlineFloor)}</dt>
                  <dd>
                    <time dateTime={grace.untilAfter}>
                      {utcFormat.format(new Date(grace.untilAfter))} UTC
                    </time>
                  </dd>
                </>
              )}
            </dl>
            <form
              method="post"
              className="max-w-lg space-y-3"
              noValidate
              aria-label={title}
              onSubmit={(event) => {
                event.preventDefault();
                prepare();
              }}
            >
              <Field>
                <FieldLabel htmlFor={id + "-until"}>
                  {t(($) => $.platform.billing.newUntil)}
                </FieldLabel>
                <Input
                  id={id + "-until"}
                  ref={untilField}
                  type="datetime-local"
                  value={until}
                  required
                  aria-invalid={invalid === "until"}
                  aria-describedby={id + (invalid === "until" ? "-until-error" : "-until-hint")}
                  onChange={(event) => {
                    setUntil(event.target.value);
                    setInvalid(undefined);
                  }}
                />
                {invalid === "until" ? (
                  <FieldError id={id + "-until-error"}>
                    {t(($) => $.platform.billing.untilError)}
                  </FieldError>
                ) : (
                  <FieldDescription id={id + "-until-hint"}>
                    {t(($) => $.platform.billing.untilHint)}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor={id + "-reason"}>{t(($) => $.platform.reason)}</FieldLabel>
                <Textarea
                  id={id + "-reason"}
                  ref={reasonField}
                  value={reason}
                  required
                  maxLength={1000}
                  aria-invalid={invalid === "reason"}
                  aria-describedby={invalid === "reason" ? id + "-reason-error" : undefined}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setInvalid(undefined);
                  }}
                />
                {invalid === "reason" && (
                  <FieldError id={id + "-reason-error"}>
                    {t(($) => $.platform.reasonError)}
                  </FieldError>
                )}
              </Field>
              <Button type="submit" isDisabled={query.isFetching}>
                {title}
              </Button>
            </form>
          </>
        ) : (
          <p>{t(($) => $.platform.billing.graceUnavailable)}</p>
        )}
      </CardContent>
      {review && (
        <PlatformBillingReview
          {...review}
          title={title}
          sourceKey={key}
          onDenied={onDenied}
          onClose={() => {
            setReview(undefined);
            setUntil("");
            setReason("");
          }}
        />
      )}
    </Card>
  );
}
