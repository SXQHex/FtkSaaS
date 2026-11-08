"use client";
import { useCallback, useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { validate, v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  ownDeliveryScope,
  deliveryCommand,
  deliveryFields,
  deliveryQuery,
  readDeliverySettings,
  type DeliveryKey,
  type DeliveryTarget,
} from "../../lib/delivery-settings";
import { useRemote } from "../../lib/use-remote";
import { setupCall, type SetupCommand, type SetupScope } from "../../lib/studio-setup";
import { operatingValue } from "../../lib/operating-settings";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
export function DeliverySettings({ scope, target }: { scope: SetupScope; target: DeliveryTarget }) {
  const normalized =
    target === "user"
      ? ownDeliveryScope(scope.actorId)
      : target === "center"
        ? scope
        : { actorId: scope.actorId, orgId: scope.orgId };
  return (
    <DeliveryConnection
      key={JSON.stringify([normalized, target])}
      scope={normalized}
      target={target}
    />
  );
}
function DeliveryConnection({
  scope: initialScope,
  target,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
}) {
  const [scope] = useState(initialScope),
    t = useTranslations("delivery"),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<DeliveryKey | null>(null),
    [error, setError] = useState("");
  const load = useCallback(() => readDeliverySettings(scope, target), [scope, target]);
  const state = useRemote(load, String(revision));
  function reload() {
    setSelected(null);
    setRevision((v) => v + 1);
  }
  const recovery = useSetupCommand(scope, `delivery:${target}`, reload, setError);
  return (
    <section
      className="min-w-0 space-y-4 rounded-md border p-4 wrap-anywhere"
      aria-label={t(target)}
    >
      <h3 className="font-semibold">{t(target)}</h3>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <SetupFeedback command={recovery} />
      {error && <FlowError code={error} />}
      <Button variant="outline" onClick={reload}>
        {t("refresh")}
      </Button>
      {!state ? (
        <output>{t("loading")}</output>
      ) : state.error ? (
        <FlowError code={state.error} />
      ) : (
        state.data && (
          <>
            <div className="flex flex-wrap gap-2">
              {deliveryFields(state.data.catalog).map((f) => (
                <Button
                  key={f.key}
                  variant="outline"
                  aria-pressed={selected === f.key}
                  onClick={() => setSelected(f.key as DeliveryKey)}
                >
                  {t(`fields.${f.key}`)}
                </Button>
              ))}
            </div>
            {!deliveryFields(state.data.catalog).length && <p>{t("unavailable")}</p>}
            {selected && (
              <DeliveryField
                key={`${revision}:${selected}`}
                scope={scope}
                target={target}
                name={selected}
                source={state.data}
                onSaved={reload}
              />
            )}
            <DeliveryHistory key={revision} scope={scope} target={target} />
          </>
        )
      )}
    </section>
  );
}
function valueText(value: unknown) {
  return value == null ? "—" : Array.isArray(value) ? value.join(", ") : String(value);
}
function DeliveryField({
  scope,
  target,
  name,
  source,
  onSaved,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
  name: DeliveryKey;
  source: Awaited<ReturnType<typeof readDeliverySettings>>;
  onSaved: () => void;
}) {
  const t = useTranslations("delivery"),
    id = useId(),
    current = operatingValue(source.view.values, name),
    [value, setValue] = useState(current),
    [review, setReview] = useState<SetupCommand | null>(null),
    [after, setAfter] = useState<unknown>(),
    [resetBusy, setResetBusy] = useState(false),
    [expires, setExpires] = useState<string>(),
    [error, setError] = useState("");
  const command = useSetupCommand(scope, `delivery:${target}`, onSaved, setError),
    disabled = command.busy || !!command.pending || resetBusy;
  useEffect(() => {
    if (!expires) return;
    const timeout = setTimeout(
      () => {
        setReview(null);
        setError("PREVIEW_STALE");
      },
      Math.max(0, Math.min(2147483647, Date.parse(expires) - Date.now())),
    );
    return () => clearTimeout(timeout);
  }, [expires]);
  const writable = source.catalog.fields.find((f) => f.key === name)?.writable;
  const choices =
    name === "lesson_reminder_hours"
      ? source.catalog.notification_delivery?.reminders.lesson_hours
      : name === "package_reminder_days"
        ? source.catalog.notification_delivery?.reminders.package_expiry_days
        : name === "payment_reminder_days"
          ? source.catalog.notification_delivery?.reminders.payment_due_days
          : null;
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">{t(`fields.${name}`)}</h4>
      <p>
        {t(source.view.overridden_fields.some((k) => k === name) ? "local" : "inherited")} ·{" "}
        {valueText(current)}
      </p>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onChange={() => {
          setReview(null);
          setExpires(undefined);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setReview(deliveryCommand(scope, target, name, value, source));
            setAfter(value);
            setExpires(undefined);
            setError("");
          } catch (c) {
            setError(flowError(c));
          }
        }}
      >
        <fieldset disabled={disabled || !writable} className="space-y-3">
          <Label htmlFor={id}>{t("value")}</Label>
          {choices ? (
            <select
              id={id}
              value={String(value)}
              className="min-h-11 rounded-md border bg-background"
              onChange={(e) => setValue(Number(e.target.value))}
            >
              {choices.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : name === "timezone_mode" ? (
            <select
              id={id}
              value={String(value)}
              className="min-h-11 rounded-md border bg-background"
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="device">{t("device")}</option>
              <option value="manual">{t("manual")}</option>
            </select>
          ) : name === "quiet_hours_weekdays" ? (
            <div id={id} className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <label key={n} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) && value.includes(n)}
                    onChange={(e) =>
                      setValue(
                        e.target.checked
                          ? [...(Array.isArray(value) ? value : []), n].sort()
                          : (Array.isArray(value) ? value : []).filter((v) => v !== n),
                      )
                    }
                  />
                  {t(`days.${n}`)}
                </label>
              ))}
            </div>
          ) : name === "timezone_name" ||
            name === "quiet_hours_start" ||
            name === "quiet_hours_end" ? (
            <Input
              id={id}
              type={name === "timezone_name" ? "text" : "time"}
              required
              value={String(value ?? "")}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <select
              id={id}
              className="min-h-11 rounded-md border bg-background"
              value={String(value)}
              onChange={(e) => setValue(e.target.value === "true")}
            >
              <option value="true">{t("enabled")}</option>
              <option value="false">{t("disabled")}</option>
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t("review")}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setReview(null);
                setResetBusy(true);
                try {
                  const p = await setupCall("settings_reset_preview_v1", {
                    ...deliveryQuery(scope, target),
                    fields: [name],
                  });
                  if (
                    !validate(p.id) ||
                    !p.token ||
                    !Number.isFinite(Date.parse(p.expires_at)) ||
                    p.scope !== target ||
                    p.version !== source.view.version ||
                    p.fields.length !== 1 ||
                    p.fields[0] !== name ||
                    Date.parse(p.expires_at) <= Date.now()
                  )
                    throw Error("PREVIEW_STALE");
                  setAfter(operatingValue(p.after, name));
                  setExpires(p.expires_at);
                  setReview({
                    operation: "settings_reset_apply_v1",
                    input: {
                      ...deliveryQuery(scope, target),
                      operation_key: v7(),
                      expected_version: p.version,
                      preview: { id: p.id, token: p.token },
                    },
                  });
                } catch (c) {
                  setError(flowError(c));
                } finally {
                  setResetBusy(false);
                }
              }}
            >
              {t("reset")}
            </Button>
          </div>
        </fieldset>
      </form>
      {!writable && <p>{t("readonly")}</p>}
      {review && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>
            {t(`fields.${name}`)}: {valueText(current)} → {valueText(after)}
          </p>
          <p>{t("hint")}</p>
        </ConfirmWrite>
      )}
    </div>
  );
}
function DeliveryHistory({ scope, target }: { scope: SetupScope; target: DeliveryTarget }) {
  const t = useTranslations("delivery"),
    f = useFormatter(),
    [open, setOpen] = useState(false),
    [cursor, setCursor] = useState<string>();
  const load = useCallback(
    () =>
      open
        ? setupCall("settings_history_get_v1", {
            ...deliveryQuery(scope, target),
            ...(cursor ? { cursor } : {}),
          })
        : Promise.resolve(null),
    [scope, target, open, cursor],
  );
  const state = useRemote(load, JSON.stringify([open, cursor]));
  return (
    <div className="space-y-3">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t("history")}
      </Button>
      {open && state?.error && <FlowError code={state.error} />}
      <ul>
        {open &&
          state?.data?.items.map((row) => (
            <li key={row.id} className="space-y-1 rounded-md border p-3">
              <p>{f.dateTime(new Date(row.at), { dateStyle: "medium", timeStyle: "short" })}</p>
              {Object.entries(row.after)
                .filter(
                  ([k, v]) =>
                    k in row.before &&
                    JSON.stringify(Reflect.get(row.before, k)) !== JSON.stringify(v),
                )
                .filter(
                  ([k]) =>
                    k.startsWith("quiet_hours_") ||
                    k.startsWith("timezone_") ||
                    k.includes("reminder"),
                )
                .map(([k, v]) => (
                  <p key={k}>
                    {t.has(`fields.${k}`) ? t(`fields.${k}`) : k}:{" "}
                    {valueText(Reflect.get(row.before, k))} → {valueText(v)}
                  </p>
                ))}
            </li>
          ))}
      </ul>
      {open && state?.data?.next_cursor && (
        <Button variant="outline" onClick={() => setCursor(state.data!.next_cursor!)}>
          {t("next")}
        </Button>
      )}
    </div>
  );
}
