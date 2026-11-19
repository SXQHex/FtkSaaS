import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
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
import type { CenterView, SettlementRequestView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import {
  readSettlementResult,
  settlementAuthority,
  settlementKey,
  settlementMovements,
  settlementRequests,
  writeSettlement,
  type SettlementIntent,
} from "./business-settlement-api";

const currencyPattern = /^[A-Z]{3}$/;
const positiveMinor = /^[1-9][0-9]{0,18}$/;
const reasonSchema = z.string().trim().min(1).max(1000);

export function BusinessSettlement({
  scope,
  centers,
  personId,
  onLockChange,
  authorityPanel,
  owner = false,
}: {
  scope: ClientScope;
  centers: CenterView[];
  personId?: string;
  onLockChange: (locked: boolean) => void;
  authorityPanel?: ReactNode;
  owner?: boolean;
}) {
  const { t } = useTranslation();
  const authority = useQuery({
    queryKey: [...settlementKey(scope), "authority", personId],
    queryFn: () => settlementAuthority(scope, personId!),
    enabled: Boolean(personId),
    retry: false,
    gcTime: 0,
  });
  const granted = !authority.isError && authority.data?.center_grants.some((row) => row.granted);
  const title = t(($) => $.businessCenters.tabs.settlement);
  return (
    <div className="space-y-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {granted ? (
            <Ledger scope={scope} centers={centers} onLockChange={onLockChange} />
          ) : (
            <p>
              {t(($) =>
                personId && authority.isPending
                  ? $.platform.loading
                  : $.businessCenters.settlement.unauthorized,
              )}
            </p>
          )}
        </CardContent>
      </Card>
      {(owner || (!authority.isError && authority.data?.delegation_allowed)) && authorityPanel}
    </div>
  );
}

function Ledger({
  scope,
  centers,
  onLockChange,
}: {
  scope: ClientScope;
  centers: CenterView[];
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const client = useQueryClient();
  const key = settlementKey(scope);
  const [currency, setCurrency] = useState("TRY");
  const [currencyDraft, setCurrencyDraft] = useState("TRY");
  const [movementId, setMovement] = useState("");
  const [offsetId, setOffset] = useState("");
  const [amount, setAmount] = useState("");
  const [occurred, setOccurred] = useState("");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [formError, setFormError] = useState(false);
  const [intent, setIntent] = useState<SettlementIntent>();
  const [accepted, setAccepted] = useState(false);
  const movements = useInfiniteQuery({
    queryKey: [...key, "movements", currency],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => settlementMovements(scope, currency, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const requests = useInfiniteQuery({
    queryKey: [...key, "requests"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => settlementRequests(scope, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const rows = movements.isError ? [] : (movements.data?.pages.flatMap((item) => item.items) ?? []);
  const pending = requests.isError
    ? []
    : (requests.data?.pages.flatMap((item) => item.items) ?? []);
  const openDebit = rows.filter(
    (row) =>
      row.debtor_center_id === scope.centerId &&
      row.kind === "accrual" &&
      positiveMinor.test(row.open_minor),
  );
  const debit = openDebit.find((row) => row.id === movementId);
  const openCredit = rows.filter(
    (row) =>
      row.creditor_center_id === scope.centerId &&
      row.debtor_center_id === debit?.creditor_center_id &&
      row.kind === "accrual" &&
      positiveMinor.test(row.open_minor),
  );
  const centerName = (center: string) =>
    centers.find((row) => row.id === center)?.name ?? t(($) => $.businessCenters.unknownCenter);
  const command = useMemberCommand({
    write: writeSettlement,
    readResult: readSettlementResult,
    onAccessLost: () => {
      void client.invalidateQueries({ queryKey: key });
      return false;
    },
    onRefresh: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  function close() {
    if (command.locked) return;
    if (command.state === "saved") {
      setMovement("");
      setOffset("");
      setAmount("");
      setOccurred("");
      setReason("");
    }
    if (command.state === "stale" || command.state === "rejected")
      void client.invalidateQueries({ queryKey: key });
    command.reset();
    setIntent(undefined);
    setAccepted(false);
  }
  function readReason() {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setInvalid(true);
      reasonInput.current?.focus();
    }
    return parsed.data;
  }
  function decide(action: "approve" | "reject" | "withdraw", before: SettlementRequestView) {
    const reason = readReason();
    if (reason) setIntent({ scope, action, before, reason, key: uuidv7() });
  }
  function submit() {
    const currentReason = readReason();
    if (!currentReason) return;
    const credit = openCredit.find((row) => row.id === offsetId);
    const instant = z.iso.datetime({ precision: 0 }).safeParse(occurred + ":00Z").data;
    if (
      !debit ||
      !positiveMinor.test(amount) ||
      BigInt(amount) > BigInt(debit.open_minor) ||
      (offsetId ? !credit || BigInt(amount) > BigInt(credit.open_minor) : !instant)
    ) {
      setFormError(true);
      return;
    }
    const line = { movement_id: debit.id, expected_version: debit.version, amount_minor: amount };
    setFormError(false);
    setIntent({
      scope,
      action: "submit",
      peer: debit.creditor_center_id,
      currency,
      reason: currentReason,
      key: uuidv7(),
      proposal: credit
        ? {
            kind: "offset",
            amount_minor: amount,
            debit_lines: [line],
            credit_lines: [
              { movement_id: credit.id, expected_version: credit.version, amount_minor: amount },
            ],
          }
        : { kind: "payment", amount_minor: amount, lines: [line], occurred_at: instant! },
    });
  }
  const amountLabel = t(($) => $.platform.billing.amount);
  const reviewTitle = intent ? t(($) => $.businessCenters.settlement[intent.action]) : "";
  return (
    <div className="space-y-5">
      <form
        method="post"
        className="flex flex-wrap items-end gap-2"
        aria-label={t(($) => $.businessCenters.settlement.movements)}
        onSubmit={(event) => {
          event.preventDefault();
          setCurrency(currencyDraft);
          setMovement("");
          setOffset("");
        }}
      >
        <Field>
          <FieldLabel htmlFor={id + "-currency"}>
            {t(($) => $.businessCenters.settlement.currency)}
          </FieldLabel>
          <Input
            id={id + "-currency"}
            value={currencyDraft}
            className="w-20"
            required
            maxLength={3}
            pattern="[A-Z]{3}"
            onChange={(event) => setCurrencyDraft(event.target.value.toUpperCase())}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          isDisabled={!currencyPattern.test(currencyDraft) || command.locked}
        >
          {t(($) => $.businessCenters.settlement.filter)}
        </Button>
      </form>
      <section aria-label={t(($) => $.businessCenters.settlement.movements)} className="space-y-3">
        <h3 className="font-semibold">{t(($) => $.businessCenters.settlement.movements)}</h3>
        {movements.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : movements.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.businessCenters.settlement.readError)}</AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <>
            <Table
              aria-label={t(($) => $.businessCenters.settlement.movements)}
              scrollRegionLabel={t(($) => $.businessCenters.settlement.movements)}
              className="min-w-[41rem]"
            >
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.businessCenters.settlement.from)}</TableHead>
                <TableHead>{t(($) => $.businessCenters.settlement.to)}</TableHead>
                <TableHead>{t(($) => $.businessCenters.settlement.kind)}</TableHead>
                <TableHead>{amountLabel}</TableHead>
                <TableHead>{t(($) => $.businessCenters.settlement.balance)}</TableHead>
              </TableHeader>
              <TableBody items={rows}>
                {(row) => (
                  <TableRow id={row.id}>
                    <TableCell>{centerName(row.debtor_center_id)}</TableCell>
                    <TableCell>{centerName(row.creditor_center_id)}</TableCell>
                    <TableCell>
                      {t(($) => $.businessCenters.settlement.movementsState[row.kind])}
                    </TableCell>
                    <TableCell>{formatMinorAmount(row.amount_minor, row.currency)}</TableCell>
                    <TableCell>{formatMinorAmount(row.open_minor, row.currency)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {movements.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={movements.isFetching || command.locked}
                onPress={() => void movements.fetchNextPage()}
              >
                {t(($) => $.businessCenters.more)}
              </Button>
            )}
          </>
        )}
      </section>
      <Field className="max-w-lg">
        <FieldLabel htmlFor={id + "-reason"}>{t(($) => $.platform.reason)}</FieldLabel>
        <Textarea
          id={id + "-reason"}
          ref={reasonInput}
          value={reason}
          required
          maxLength={1000}
          aria-invalid={invalid}
          aria-describedby={invalid ? id + "-reason-error" : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            setInvalid(false);
          }}
        />
        {invalid && (
          <FieldError id={id + "-reason-error"}>{t(($) => $.platform.reasonError)}</FieldError>
        )}
      </Field>
      {openDebit.length > 0 && (
        <form
          method="post"
          noValidate
          className="space-y-3 rounded-lg border p-4"
          aria-label={t(($) => $.businessCenters.settlement.submit)}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <h3 className="font-semibold">{t(($) => $.businessCenters.settlement.submit)}</h3>
          <Field>
            <FieldLabel htmlFor={id + "-debit"}>
              {t(($) => $.businessCenters.settlement.debit)}
            </FieldLabel>
            <NativeSelect
              id={id + "-debit"}
              value={movementId}
              onChange={(event) => {
                setMovement(event.target.value);
                setOffset("");
              }}
            >
              <NativeSelectOption value="">
                {t(($) => $.businessCenters.settlement.choose)}
              </NativeSelectOption>
              {openDebit.map((row) => (
                <NativeSelectOption value={row.id} key={row.id}>
                  {centerName(row.creditor_center_id)} ·{" "}
                  {formatMinorAmount(row.open_minor, row.currency)} · {row.created_at.slice(0, 10)}{" "}
                  · {row.id}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {debit && (
            <>
              {openCredit.length > 0 && (
                <Field>
                  <FieldLabel htmlFor={id + "-credit"}>
                    {t(($) => $.businessCenters.settlement.credit)}
                  </FieldLabel>
                  <NativeSelect
                    id={id + "-credit"}
                    value={offsetId}
                    onChange={(event) => setOffset(event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.businessCenters.settlement.payment)}
                    </NativeSelectOption>
                    {openCredit.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {formatMinorAmount(row.open_minor, row.currency)} ·{" "}
                        {row.created_at.slice(0, 10)} · {row.id}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={id + "-amount"}>
                  {t(($) => $.businessCenters.settlement.minor)}
                </FieldLabel>
                <Input
                  id={id + "-amount"}
                  value={amount}
                  required
                  maxLength={19}
                  inputMode="numeric"
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
              {!offsetId && (
                <Field>
                  <FieldLabel htmlFor={id + "-occurred"}>
                    {t(($) => $.businessCenters.settlement.occurred)}
                  </FieldLabel>
                  <Input
                    id={id + "-occurred"}
                    type="datetime-local"
                    value={occurred}
                    required
                    onChange={(event) => setOccurred(event.target.value)}
                  />
                </Field>
              )}
            </>
          )}
          {formError && <p role="alert">{t(($) => $.businessCenters.settlement.invalid)}</p>}
          <Button type="submit" isDisabled={!debit || command.locked || movements.isFetching}>
            {t(($) => $.businessCenters.review)}
          </Button>
        </form>
      )}
      <section className="space-y-3" aria-label={t(($) => $.businessCenters.settlement.requests)}>
        <h3 className="font-semibold">{t(($) => $.businessCenters.settlement.requests)}</h3>
        {requests.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : requests.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.businessCenters.settlement.readError)}</AlertDescription>
          </Alert>
        ) : pending.length === 0 ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">
                    {centerName(row.from_center_id)} → {centerName(row.to_center_id)}
                  </p>
                  <p>
                    {formatMinorAmount(row.proposal.amount_minor, row.currency)} ·{" "}
                    {t(($) => $.businessCenters.settlement.proposal[row.proposal.kind])}
                  </p>
                  {row.reason && (
                    <p className="wrap-anywhere text-muted-foreground">{row.reason}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {t(($) => $.businessCenters.settlement.requestState[row.state])}
                  </Badge>
                  {row.state === "pending" && row.to_center_id === scope.centerId && (
                    <>
                      <Button
                        size="sm"
                        isDisabled={command.locked || requests.isFetching}
                        onPress={() => decide("approve", row)}
                      >
                        {t(($) => $.businessCenters.settlement.approve)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isDisabled={command.locked || requests.isFetching}
                        onPress={() => decide("reject", row)}
                      >
                        {t(($) => $.businessCenters.settlement.reject)}
                      </Button>
                    </>
                  )}
                  {row.state === "pending" &&
                    row.from_center_id === scope.centerId &&
                    row.initiator_account_id === scope.accountId && (
                      <Button
                        size="sm"
                        variant="outline"
                        isDisabled={command.locked || requests.isFetching}
                        onPress={() => decide("withdraw", row)}
                      >
                        {t(($) => $.businessCenters.settlement.withdraw)}
                      </Button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {requests.hasNextPage && !requests.isError && (
          <Button
            variant="outline"
            isDisabled={requests.isFetching || command.locked}
            onPress={() => void requests.fetchNextPage()}
          >
            {t(($) => $.businessCenters.more)}
          </Button>
        )}
      </section>
      {intent && (
        <SettingsReviewDialog
          open
          title={reviewTitle}
          description={t(($) => $.businessCenters.settlement.effect)}
          rows={[
            {
              id: "amount",
              title: amountLabel,
              detail:
                intent.action === "submit"
                  ? formatMinorAmount(intent.proposal.amount_minor, intent.currency)
                  : formatMinorAmount(intent.before.proposal.amount_minor, intent.before.currency),
            },
            { id: "reason", title: t(($) => $.platform.reason), detail: intent.reason },
          ]}
          accepted={accepted}
          onAccepted={setAccepted}
          onClose={close}
          locked={command.locked}
          onApply={command.state === "ready" ? () => void command.start(intent) : undefined}
          recoveryActions={
            <EventCommandNotice command={command} receiptAvailable={false} onReload={close} />
          }
        />
      )}
    </div>
  );
}
