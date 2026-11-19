import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
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

export function PlatformOperators({
  accountId,
  onDenied,
}: {
  accountId: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const client = useQueryClient();
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
            <Table aria-label={title} scrollRegionLabel={title} className="min-w-[36rem]">
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.platform.operators.member)}</TableHead>
                <TableHead>{t(($) => $.platform.operators.state)}</TableHead>
                <TableHead>{t(($) => $.platform.operators.grantedAt)}</TableHead>
                <TableHead>{t(($) => $.platform.operators.actions)}</TableHead>
              </TableHeader>
              <TableBody
                items={rows.map((row, index) => ({
                  ...row,
                  key: row.account_id ?? "unlinked-" + index,
                }))}
              >
                {(row) => {
                  const label =
                    row.display_name ?? row.account_id ?? t(($) => $.platform.operators.unlinked);
                  const removable =
                    row.account_id &&
                    rows.some(
                      (candidate) => candidate.account_id !== row.account_id && candidate.eligible,
                    );
                  return (
                    <TableRow id={row.key}>
                      <TableCell className="max-w-56 whitespace-normal wrap-anywhere">
                        {label}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(($) =>
                            row.eligible
                              ? $.platform.operators.eligible
                              : $.platform.operators.ineligible,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <time dateTime={row.granted_at}>
                          {grantedAt.format(new Date(row.granted_at))}
                        </time>
                      </TableCell>
                      <TableCell>
                        {row.account_id && removable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            isDisabled={roster.isFetching}
                            aria-label={t(($) => $.platform.operators.removeMember, { label })}
                            onPress={() => prepare(row.account_id!, false, label)}
                          >
                            {t(($) => $.platform.operators.remove)}
                          </Button>
                        ) : row.account_id ? (
                          t(($) => $.platform.operators.last)
                        ) : (
                          t(($) => $.platform.operators.unlinked)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }}
              </TableBody>
            </Table>
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
            { id: "target", title: t(($) => $.platform.operators.member), detail: review.label },
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
