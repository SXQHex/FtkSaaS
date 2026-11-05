"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  EntitlementView,
  NegativeLimitsView,
  ReservationProtectionPreview,
  SessionView,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { ApiFailure } from "../../lib/api";
import { matchesRightsPreview, rightsChange, type RightsChange } from "../../lib/rights-change";
import { rightsCommand, type RightsApi } from "../../lib/rights";
import type { SetupScope } from "../../lib/studio-setup";
import { errorKey, type useSetupCommand } from "../setup/setup-command";
import { RightsReview } from "./rights-review";
export type RightsTarget =
  | { kind: "credit_adjust" | "entitlement_extend"; row: EntitlementView }
  | { kind: "negative_limit"; limits: NegativeLimitsView };
export function RightsForm({
  scope,
  personId,
  target,
  api,
  command,
}: {
  scope: SetupScope;
  personId: string;
  target: RightsTarget;
  api: RightsApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("rights"),
    errors = useTranslations("setup"),
    format = useFormatter(),
    id = useId();
  const [review, setReview] = useState<{
      change: RightsChange;
      reason: string;
      result: ReservationProtectionPreview;
      sessions: SessionView[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    lock = useRef(false),
    form = useRef<HTMLFormElement>(null),
    inspect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const disabled = busy || command.busy || !!command.pending;
  const version = target.kind === "negative_limit" ? target.limits.version : target.row.version;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    setReview(null);
    setError("");
    try {
      const values = new FormData(event.currentTarget),
        reason = String(values.get("reason") ?? "").trim();
      if (!reason) throw Error("invalidRights");
      const change = rightsChange(
        target.kind,
        target.kind === "negative_limit" ? personId : target.row.sale_id,
        String(values.get("value") ?? ""),
        String(values.get("direction") ?? ""),
        target.kind === "negative_limit" ? target.limits.discipline_id : undefined,
      );
      const result = await api.preview(scope, change, reason);
      if (
        !matchesRightsPreview(change, result.change) ||
        result.preserves_reservations !== true ||
        result.waives_independent_blocks !== false ||
        !(Date.parse(result.preview.expires_at) > Date.now()) ||
        !result.preview.id ||
        !result.preview.token ||
        result.affected.some((row) => row.person_id !== personId) ||
        new Set(result.affected.map((row) => row.reservation_id)).size !== result.affected.length
      )
        throw Error("invalidPreview");
      const sessions = await Promise.all(
        [...new Set(result.affected.map((row) => row.session_id))].map(async (sessionId) => {
          const session = await api.session(scope, sessionId);
          if (session.id !== sessionId) throw Error("invalidPreview");
          return session;
        }),
      );
      if (alive.current) setReview({ change, reason, result, sessions });
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof ApiFailure ? errorKey(cause.failure.error.code) : "invalidPreview",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <h4 className="font-semibold">{t(`kinds.${target.kind}`)}</h4>
      {target.kind !== "negative_limit" && (
        <p className="text-sm">
          {t("currentEnd", {
            date: format.dateTime(new Date(`${target.row.end_date}T12:00:00Z`), {
              timeZone: "UTC",
              dateStyle: "medium",
            }),
          })}{" "}
          · {target.row.timezone}
        </p>
      )}
      <form
        ref={form}
        className="space-y-4"
        onSubmit={(event) => void submit(event)}
        onChange={() => {
          setReview(null);
          setError("");
        }}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
          {target.kind === "credit_adjust" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-direction`}>{t("direction")}</Label>
              <select
                id={`${id}-direction`}
                name="direction"
                className="h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="increase">{t("increase")}</option>
                <option value="decrease">{t("decrease")}</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-value`}>
              {t(
                target.kind === "entitlement_extend"
                  ? "newEnd"
                  : target.kind === "negative_limit"
                    ? "newLimit"
                    : "amount",
              )}
            </Label>
            <Input
              id={`${id}-value`}
              name="value"
              type={target.kind === "entitlement_extend" ? "date" : "number"}
              min={
                target.kind === "entitlement_extend"
                  ? target.row.end_date
                  : target.kind === "negative_limit"
                    ? 0
                    : 1
              }
              max={
                target.kind === "negative_limit"
                  ? (target.limits.upper_limit ?? undefined)
                  : undefined
              }
              step={1}
              required
              defaultValue={
                target.kind === "negative_limit" ? (target.limits.override ?? "") : undefined
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
            <Input id={`${id}-reason`} name="reason" required maxLength={2000} />
          </div>
          <Button
            ref={inspect}
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="submit"
          >
            {t("inspect")}
          </Button>
        </fieldset>
      </form>
      {busy && <output>{t("loading")}</output>}
      {error && <p role="alert">{t.has(error) ? t(error) : errors(error)}</p>}
      {review && (
        <>
          <p className="text-sm">
            {t("reason")}: {review.reason}
          </p>
          <RightsReview
            result={review.result}
            sessions={review.sessions}
            disabled={disabled}
            onBack={() => {
              setReview(null);
              inspect.current?.focus();
            }}
            onApply={() => {
              if (disabled) return;
              void command
                .run(rightsCommand(scope, review.change, review.reason, review.result, version))
                .then(() => {
                  if (alive.current) {
                    setReview(null);
                    inspect.current?.focus();
                  }
                });
            }}
          />
        </>
      )}
    </div>
  );
}
