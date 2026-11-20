import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import type { AccountView } from "../../lib/api-contracts/generated";
import { usePlatformActivity } from "./platform-activity-context";
import { PlatformActionReview } from "./platform-action-review";
import { billingReason } from "./platform-payment";
import { PlatformReadError } from "./platform-read-error";
import {
  confirmOperator,
  operatorIntent,
  platformEmail,
  platformOperatorKey,
  readOperatorResult,
  readPlatformOperators,
  readVerifiedPlatformAccount,
  writeOperator,
  type OperatorIntent,
} from "./platform-provisioning";

const grantedAt = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function nameBeforeEmail(value: string | null) {
  return platformEmail.safeParse(value).success ? undefined : value?.trim();
}

export function PlatformOperators({
  currentAccount,
  onDenied,
}: {
  currentAccount: Pick<AccountView, "id" | "display_name" | "identity">;
  onDenied: () => void;
}) {
  const { id: accountId, display_name, identity } = currentAccount;
  // The account projection can use the login email when a profile name is absent.
  const profileName = nameBeforeEmail(display_name);
  const fullName = [identity?.given_name?.trim(), identity?.family_name?.trim()]
    .filter(Boolean)
    .join(" ");
  const verifiedEmail = identity?.email_verified_at ? identity.email?.trim() : undefined;
  const currentAccountLabels = [profileName, fullName, verifiedEmail];
  const { t } = useTranslation();
  const id = useId();
  const client = useQueryClient();
  const { record } = usePlatformActivity();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<string>();
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<"email" | "reason">();
  const [review, setReview] = useState<{ intent: OperatorIntent; label: string }>();
  const key = platformOperatorKey(accountId);
  const roster = useQuery({
    queryKey: key,
    queryFn: () => readPlatformOperators(accountId),
    retry: false,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const rows = roster.isError ? [] : (roster.data ?? []);
  const account = useQuery({
    queryKey: ["platform-operator-target", accountId, lookup],
    queryFn: async () =>
      lookup ? ((await readVerifiedPlatformAccount(accountId, lookup)) ?? null) : null,
    enabled: Boolean(lookup),
    retry: false,
    gcTime: 0,
  });
  const title = t(($) => $.platform.operators.title);
  const existingAccount = rows.some((row) => row.account_id === account.data);
  function find() {
    const parsed = platformEmail.safeParse(email);
    if (!parsed.success) {
      setInvalid("email");
      emailRef.current?.focus();
      return;
    }
    setInvalid(undefined);
    if (lookup === parsed.data) void account.refetch();
    else setLookup(parsed.data);
  }
  function prepare(target: string, enabled: boolean, label: string) {
    const parsed = billingReason.safeParse(reason);
    if (!parsed.success) {
      setInvalid("reason");
      reasonRef.current?.focus();
      return;
    }
    setReview({
      intent: operatorIntent({
        accountId,
        target,
        enabled,
        reason: parsed.data,
        email: enabled ? lookup : undefined,
      }),
      label,
    });
  }
  if (roster.isError)
    return <PlatformReadError error={roster.error} onRetry={() => void roster.refetch()} />;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {roster.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : (
          <>
            {rows.length ? (
              <ul aria-label={title} className="divide-y rounded-lg border">
                {rows.map((row, index) => {
                  const target = row.account_id;
                  const isSelf = target === accountId;
                  const labels = isSelf
                    ? [nameBeforeEmail(row.display_name), ...currentAccountLabels]
                    : [row.display_name?.trim()];
                  const label =
                    labels.find((candidate) => candidate && candidate !== target) ??
                    t(($) =>
                      isSelf
                        ? $.platform.operators.currentAccount
                        : target
                          ? $.platform.operators.unnamed
                          : $.platform.operators.unlinked,
                    );
                  const removable =
                    target &&
                    rows.some((candidate) => candidate.account_id !== target && candidate.eligible);
                  return (
                    <li
                      key={target ?? "unlinked-" + index}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                    >
                      <div className="min-w-0 space-y-1 wrap-anywhere">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          <time dateTime={row.granted_at}>
                            {grantedAt.format(new Date(row.granted_at))}
                          </time>
                        </p>
                      </div>
                      <div className="flex max-w-full flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {t(($) =>
                            row.eligible
                              ? $.platform.operators.eligible
                              : $.platform.operators.ineligible,
                          )}
                        </Badge>
                        {target && removable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            isDisabled={roster.isFetching}
                            aria-label={t(($) => $.platform.operators.removeMember, { label })}
                            onPress={() => prepare(target, false, label)}
                          >
                            {t(($) => $.platform.operators.remove)}
                          </Button>
                        ) : target ? (
                          <span className="text-sm">{t(($) => $.platform.operators.last)}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{t(($) => $.platform.operators.empty)}</p>
            )}
            <Field className="max-w-xl">
              <FieldLabel htmlFor={id + "-reason"}>{t(($) => $.platform.reason)}</FieldLabel>
              <Textarea
                id={id + "-reason"}
                ref={reasonRef}
                value={reason}
                maxLength={1000}
                required
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
            <form
              method="post"
              noValidate
              className="max-w-xl space-y-3 border-t pt-4"
              aria-label={t(($) => $.platform.operators.add)}
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  account.data &&
                  lookup &&
                  !existingAccount &&
                  !account.isError &&
                  !account.isFetching &&
                  !roster.isFetching
                )
                  prepare(account.data, true, lookup);
              }}
            >
              <Field>
                <FieldLabel htmlFor={id + "-email"}>
                  {t(($) => $.platform.verifiedEmail)}
                </FieldLabel>
                <Input
                  id={id + "-email"}
                  ref={emailRef}
                  type="email"
                  autoComplete="off"
                  value={email}
                  aria-invalid={invalid === "email"}
                  aria-describedby={invalid === "email" ? id + "-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLookup(undefined);
                    setInvalid(undefined);
                  }}
                />
                {invalid === "email" && (
                  <FieldError id={id + "-email-error"}>
                    {t(($) => $.platform.emailError)}
                  </FieldError>
                )}
              </Field>
              {lookup &&
                (account.isError ? (
                  <PlatformReadError error={account.error} onRetry={find} />
                ) : account.isSuccess ? (
                  <p role="status">
                    {t(($) =>
                      existingAccount
                        ? $.platform.operators.already
                        : account.data
                          ? $.platform.accountFound
                          : $.platform.accountMissing,
                    )}
                  </p>
                ) : null)}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  isDisabled={account.isFetching}
                  type="button"
                  onPress={find}
                >
                  {t(($) => $.platform.findAccount)}
                </Button>
                <Button
                  type="submit"
                  isDisabled={
                    !account.data ||
                    existingAccount ||
                    account.isError ||
                    account.isFetching ||
                    roster.isFetching
                  }
                >
                  {t(($) => $.platform.operators.add)}
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
      {review && (
        <PlatformActionReview
          intent={review.intent}
          title={t(($) =>
            review.intent.enabled ? $.platform.operators.add : $.platform.operators.remove,
          )}
          description={t(($) =>
            review.intent.enabled
              ? $.platform.operators.grantEffect
              : $.platform.operators.revokeEffect,
          )}
          rows={[
            {
              id: "target",
              title: review.intent.enabled
                ? t(($) => $.platform.verifiedEmail)
                : t(($) => $.platform.operators.member),
              detail: review.intent.enabled ? (
                <strong dir="ltr" className="wrap-anywhere font-semibold text-foreground">
                  {review.label}
                </strong>
              ) : (
                review.label
              ),
            },
            { id: "reason", title: t(($) => $.platform.reason), detail: review.intent.reason },
          ]}
          beforeWrite={confirmOperator}
          write={writeOperator}
          read={readOperatorResult}
          onResult={async (current) => {
            if (!current) {
              onDenied();
              return;
            }
            const roster = review.intent.enabled ? current : rows;
            record({
              key: review.intent.key,
              kind: review.intent.enabled ? "operatorAdded" : "operatorRemoved",
              subject:
                roster.find((row) => row.account_id === review.intent.target)?.display_name ??
                undefined,
            });
            client.setQueryData(key, current);
            setEmail("");
            setLookup(undefined);
            setReason("");
          }}
          onClose={() => {
            setReview(undefined);
            void roster.refetch();
          }}
          onDenied={onDenied}
        />
      )}
    </Card>
  );
}
