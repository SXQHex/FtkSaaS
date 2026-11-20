import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "./use-member-command";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@ftksaas/ui/components/item";
import { Field, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
interface EventCancelIntent {
  scope: ClientScope;
  registrationId: string;
  eventId: string;
  personId: string;
  version: number;
  reason: string;
  key: string;
}
async function readEventRegistration(intent: EventCancelIntent) {
  const backend = await scopedBackend(intent.scope),
    event = await backend.call("event_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      center_id: intent.scope.centerId,
      event_id: intent.eventId,
    });
  const matches = event.registrations?.filter(
    (row) => row.id === intent.registrationId && row.person_id === intent.personId,
  );
  if (
    event.id !== intent.eventId ||
    event.center_id !== intent.scope.centerId ||
    matches?.length !== 1
  )
    throw new Error("SALE_EVENT_REGISTRATION_UNAVAILABLE");
  return matches[0]!;
}
async function writeEventCancel(intent: EventCancelIntent) {
  const backend = await scopedBackend(intent.scope);
  return backend.call("event_registration_cancel_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    registration_id: intent.registrationId,
    expected_version: intent.version,
    reason: intent.reason,
  });
}
async function readEventCancelReceipt(intent: EventCancelIntent) {
  const backend = await scopedBackend(intent.scope),
    receipt = await backend.call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      operation: "event_registration_cancel_v1",
      key: intent.key,
    });
  if (
    receipt.operation !== "event_registration_cancel_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "event_registrations" ||
        receipt.result_reference.id !== intent.registrationId))
  )
    throw new Error("SALE_EVENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
async function readEventCancelResult(intent: EventCancelIntent, id?: string) {
  if (id && id !== intent.registrationId) throw new Error("SALE_EVENT_RESULT_UNAVAILABLE");
  const row = await readEventRegistration(intent);
  if (row.state !== "cancelled" || row.version <= intent.version)
    throw new Error("SALE_EVENT_RESULT_UNAVAILABLE");
  return row;
}
export function SaleEventCancellation({
  scope,
  row,
  disabled,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  row: ManagementStateView;
  disabled: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation(),
    [reason, setReason] = useState(""),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const command = useMemberCommand({
    write: writeEventCancel,
    readReceipt: readEventCancelReceipt,
    readResult: readEventCancelResult,
    onAccessLost,
    onRefresh: async () => {
      await onRefresh();
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  async function cancel() {
    if (disabled || locked || !accepted || command.state === "saved") return;
    if (!reason.trim()) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const detail = row.sale_change_record,
        version = row.versions.find(
          (v) => v.entity.type === "event_registrations" && v.entity.id === row.entity?.id,
        )?.version;
      if (
        !detail ||
        detail.parent.type !== "events" ||
        row.entity?.type !== "event_registrations" ||
        !version
      )
        throw new Error("SALE_EVENT_SOURCE_UNAVAILABLE");
      const intent: EventCancelIntent = {
        scope: { ...scope, centerId: detail.center_id },
        registrationId: row.entity.id,
        eventId: detail.parent.id,
        personId: detail.person_id,
        version,
        reason: reason.trim(),
        key: uuidv7(),
      };
      const current = await readEventRegistration(intent);
      if (current.state !== "active" || current.version !== version)
        throw new Error("SALE_EVENT_SOURCE_CHANGED");
      command.reset();
      await command.start(intent);
    } catch (failure) {
      if (!onAccessLost(failure)) setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{t(($) => $.memberProfile.lifecycle.eventCancellation)}</ItemTitle>
        <ItemDescription>
          {row.sale_change_record?.starts_at} · {row.sale_change_record?.parent.id} ·{" "}
          {row.entity?.id}
        </ItemDescription>
        <p className="text-sm">{t(($) => $.memberProfile.lifecycle.eventPolicy)}</p>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor={`event-cancel-${row.entity?.id}`}>
            {t(($) => $.memberProfile.reason)}
          </FieldLabel>
          <Textarea
            ref={input}
            id={`event-cancel-${row.entity?.id}`}
            name="reason"
            value={reason}
            disabled={disabled || locked || command.state === "saved"}
            aria-invalid={invalid}
            aria-describedby={invalid ? `event-error-${row.entity?.id}` : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setInvalid(false);
              setAccepted(false);
            }}
          />
          <FieldError id={`event-error-${row.entity?.id}`}>
            {invalid ? t(($) => $.memberProfile.lifecycle.required) : undefined}
          </FieldError>
        </Field>
        <Checkbox
          isSelected={accepted}
          isDisabled={disabled || locked || command.state === "saved"}
          onChange={setAccepted}
        >
          {t(($) => $.memberProfile.lifecycle.eventConfirm)}
        </Checkbox>
        <Button
          variant="outline"
          isDisabled={
            disabled || locked || !accepted || command.state === "saved" || command.unavailable
          }
          onPress={() => {
            void cancel();
          }}
        >
          {t(($) => $.memberProfile.lifecycle.eventCancellation)}
        </Button>
        {error && <p role="alert">{t(($) => $.memberProfile.lifecycle.sourceError)}</p>}
        {command.state !== "ready" && (
          <p role="status">{t(($) => $.memberProfile.lifecycle.states[command.state])}</p>
        )}
        {["unknown", "pending", "saved-unread"].includes(command.state) && (
          <Button
            variant="outline"
            isDisabled={command.busy}
            onPress={() => {
              void command.readReceipt();
            }}
          >
            {t(($) => $.finance.readResult)}
          </Button>
        )}
        {command.state === "unknown" && (
          <Button
            variant="outline"
            isDisabled={command.busy}
            onPress={() => {
              void command.retry();
            }}
          >
            {t(($) => $.finance.retrySame)}
          </Button>
        )}
      </ItemContent>
    </Item>
  );
}
