"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { SessionFormat } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { valuationApi, valuationVersion } from "../../lib/negative-valuation";
import { priceToMinor } from "../../lib/product-terms";
import { effectMoney } from "../../lib/effect-money";
import { localTimeChoices } from "../../lib/session-change";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { LocalTimeField } from "../programs/local-time-field";
import { FlowError, flowError } from "../bookings/flow-controls";
export function NegativeValuation({ scope }: { scope: SetupScope }) {
  const [context, setContext] = useState<Awaited<ReturnType<typeof valuationApi.context>> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [discipline, setDiscipline] = useState(""),
    [format, setFormat] = useState<SessionFormat | "">("");
  const t = useTranslations("valuation");
  useEffect(() => {
    const life = new AbortController();
    void valuationApi
      .context(scope)
      .then((v) => {
        if (!life.signal.aborted) setContext(v);
      })
      .catch((cause) => {
        if (!life.signal.aborted) setError(flowError(cause));
      });
    return () => life.abort();
  }, [scope, attempt]);
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("title")}>
      <h3 className="font-semibold">{t("title")}</h3>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {error && (
        <>
          <FlowError code={error} />
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="button"
            variant="outline"
            onClick={() => {
              setContext(null);
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            {t("refresh")}
          </Button>
        </>
      )}
      {!context && !error && <output>{t("loading")}</output>}
      {context && (
        <>
          <label className="block space-y-2 text-sm">
            <span>{t("discipline")}</span>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("choose")}</option>
              {context.disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>{t("format")}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as SessionFormat | "")}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("choose")}</option>
              {(["group", "private"] as const).map((f) => (
                <option key={f} value={f}>
                  {t(f)}
                </option>
              ))}
            </select>
          </label>
          {discipline && format && (
            <ValuationEditor
              key={`${scope.actorId}:${scope.orgId}:${scope.centerId}:${discipline}:${format}`}
              scope={scope}
              disciplineId={discipline}
              format={format}
              timeZone={context.timeZone}
            />
          )}
        </>
      )}
    </section>
  );
}
function ValuationEditor({
  scope,
  disciplineId,
  format,
  timeZone,
}: {
  scope: SetupScope;
  disciplineId: string;
  format: SessionFormat;
  timeZone: string;
}) {
  const t = useTranslations("valuation"),
    locale = useLocale(),
    [result, setResult] = useState<ReturnType<typeof valuationVersion> | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState(""),
    [local, setLocal] = useState(""),
    [choice, setChoice] = useState(""),
    [review, setReview] = useState<SetupCommand | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const command = useSetupCommand(
    scope,
    `valuation-${format}:${disciplineId}`,
    () => {
      setReview(null);
      setResult(null);
      setAttempt((n) => n + 1);
    },
    () => {
      setReview(null);
      setResult(null);
      setError("");
      setAttempt((n) => n + 1);
    },
  );
  useEffect(() => {
    let active = true;
    void valuationApi
      .read(scope, disciplineId, format)
      .then((page) => {
        const result = valuationVersion(page.items, scope.centerId!, disciplineId, format);
        if (active) setResult(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, disciplineId, format, attempt]);
  const locked = command.busy || !!command.pending;
  return (
    <div className="space-y-4">
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => {
          setResult(null);
          setReview(null);
          setError("");
          setAttempt((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {!result && !error && <output>{t("loading")}</output>}
      {result && (
        <>
          <p className="text-sm">
            {result.current
              ? effectMoney(result.current.amount_minor!, result.current.currency!, locale)
              : t("notConfigured")}
          </p>
          <form
            className="space-y-4"
            onChange={() => {
              setReview(null);
              setConfirmed(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              if (locked) return;
              try {
                const choices = localTimeChoices(local, timeZone),
                  instant =
                    choices.length === 1
                      ? choices[0].instant
                      : choices.find((c) => c.instant === choice)?.instant;
                if (!instant || !scope.centerId) throw Error("invalidValuation");
                const amount_minor = priceToMinor(amount, currency);
                setError("");
                setConfirmed(false);
                setReview({
                  operation: "negcredit_valuation_set_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    discipline_id: disciplineId,
                    format,
                    expected_version: result.version,
                    amount_minor,
                    currency,
                    effective_at: instant,
                  },
                });
              } catch {
                setReview(null);
                setError("VALIDATION_FAILED");
              }
            }}
          >
            <fieldset disabled={locked} className="space-y-3">
              <legend className="sr-only">{t("title")}</legend>
              <label className="block space-y-2 text-sm">
                <span>{t("amount")}</span>
                <Input
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>{t("currency")}</span>
                <Input
                  pattern="[A-Z]{3}"
                  maxLength={3}
                  required
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </label>
              <LocalTimeField
                label={t("effective")}
                value={local}
                choice={choice}
                timeZone={timeZone}
                onChange={(v) => {
                  setLocal(v);
                  setReview(null);
                }}
                onChoice={(v) => {
                  setChoice(v);
                  setReview(null);
                }}
              />
              <p className="text-sm">{timeZone}</p>
              <Button className="h-auto min-h-11 max-w-full whitespace-normal" type="submit">
                {t("review")}
              </Button>
            </fieldset>
          </form>
          {review && review.operation === "negcredit_valuation_set_v1" && (
            <section className="space-y-3" aria-label={t("review")}>
              <p>{effectMoney(review.input.amount_minor, review.input.currency, locale)}</p>
              <p>
                {new Intl.DateTimeFormat(locale, {
                  timeZone,
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(review.input.effective_at))}{" "}
                · {timeZone}
              </p>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t("confirm")}
              </label>
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal"
                disabled={locked || !confirmed}
                onClick={() => void command.run(review)}
              >
                {t("apply")}
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
