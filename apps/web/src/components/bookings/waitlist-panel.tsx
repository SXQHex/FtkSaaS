"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { SeatOfferView, WaitlistEntryView, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import { waitlistApi, waitlistCommand, type WaitlistApi } from "../../lib/waitlist";
import type { WaitlistWrite } from "../../lib/waitlist-command";
import { NativeCommandReview } from "../setup/native-command-review";
import { FlowError, flowError } from "./flow-controls";
const button = "h-auto min-h-11 max-w-full whitespace-normal";
type Draft = ReturnType<typeof waitlistCommand> & { expiresAt?: string; label: string };
export function WaitlistPanel(props: {
  scope: SetupScope;
  sessionId: string;
  personId: string;
  categories: SessionView["capacity"]["categories"];
  onChanged?: (code?: string) => void;
  api?: WaitlistApi;
}) {
  return (
    <WaitlistQuery
      key={JSON.stringify([props.scope, props.sessionId, props.personId, props.categories])}
      {...props}
    />
  );
}
function WaitlistQuery({
  scope: initialScope,
  sessionId,
  personId,
  categories,
  onChanged,
  api = waitlistApi,
}: Parameters<typeof WaitlistPanel>[0]) {
  const [scope] = useState(initialScope),
    t = useTranslations("waitlist"),
    flow = useTranslations("flows"),
    format = useFormatter(),
    id = useId();
  const [open, setOpen] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      page?: Awaited<ReturnType<WaitlistApi["list"]>>;
      error?: string;
    } | null>(null),
    [error, setError] = useState(""),
    [category, setCategory] = useState<"" | "male" | "female">(""),
    [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    if (!open) return;
    const life = new AbortController();
    void api
      .list(scope, sessionId, personId, cursor)
      .then((page) => {
        if (!life.signal.aborted) setResult({ page });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, sessionId, personId, cursor, attempt, open]);
  function reload(code = "") {
    setError(code);
    setDraft(null);
    setResult(null);
    setCursor(undefined);
    setAttempt((n) => n + 1);
  }
  function review(operation: WaitlistWrite, row?: WaitlistEntryView | SeatOfferView) {
    try {
      if (
        operation === "waitlist_join_v1" &&
        (categories === undefined || (!!categories && !category) || (!categories && category))
      )
        throw Error("invalidWaitlist");
      const data = waitlistCommand(
        scope,
        sessionId,
        personId,
        operation,
        row,
        category || undefined,
      );
      setDraft({
        ...data,
        label: t(operation),
        ...((operation === "seat_offer_accept_v1" || operation === "seat_offer_reject_v1") &&
        row &&
        "expires_at" in row
          ? { expiresAt: row.expires_at }
          : {}),
      });
      setError("");
    } catch (cause) {
      setError(flowError(cause));
    }
  }
  return (
    <section aria-label={t("title")} className="min-w-0 space-y-3 border-t pt-4 wrap-anywhere">
      <Button
        className={button}
        variant="outline"
        aria-expanded={open}
        disabled={!!draft}
        onClick={() => {
          if (open) {
            setResult(null);
            setCursor(undefined);
          }
          setOpen((v) => !v);
        }}
      >
        {t("title")}
      </Button>
      {open && (
        <>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
          <Button className={button} variant="outline" onClick={() => reload()}>
            {flow("reload")}
          </Button>
          {error && <FlowError code={error} />}
          {!result ? (
            <output aria-live="polite">{flow("loading")}</output>
          ) : result.error ? (
            <FlowError code={result.error} />
          ) : (
            result.page && (
              <>
                <ul className="space-y-3">
                  {result.page.items.map((row) => (
                    <li key={row.id} className="space-y-2 rounded-md border p-3">
                      <p>
                        {t(`states.${row.state}`)} ·{" "}
                        {format.dateTime(new Date(row.joined_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {row.booking_category && <p>{flow(row.booking_category)}</p>}
                      {["waiting", "offered"].includes(row.state) && (
                        <Button
                          className={button}
                          variant="outline"
                          disabled={!!draft}
                          onClick={() => review("waitlist_leave_v1", row)}
                        >
                          {t("waitlist_leave_v1")}
                        </Button>
                      )}
                      <ul className="space-y-2">
                        {row.offers.map((offer) => (
                          <li key={offer.id}>
                            <p>
                              {t(`offers.${offer.state}`)} · {t("expires")}{" "}
                              {format.dateTime(new Date(offer.expires_at), {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                            {offer.state === "active" && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  className={button}
                                  disabled={!!draft || Date.parse(offer.expires_at) <= Date.now()}
                                  onClick={() => review("seat_offer_accept_v1", offer)}
                                >
                                  {t("seat_offer_accept_v1")}
                                </Button>
                                <Button
                                  className={button}
                                  variant="outline"
                                  disabled={!!draft || Date.parse(offer.expires_at) <= Date.now()}
                                  onClick={() => review("seat_offer_reject_v1", offer)}
                                >
                                  {t("seat_offer_reject_v1")}
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {!result.page.items.length && <p>{t("empty")}</p>}
                {result.page.next_cursor ? (
                  <Button
                    className={button}
                    variant="outline"
                    disabled={!!draft}
                    onClick={() => {
                      setResult(null);
                      setCursor(result.page!.next_cursor!);
                    }}
                  >
                    {flow("next")}
                  </Button>
                ) : (
                  <p className="text-sm">{t("end")}</p>
                )}
                {!draft && categories !== undefined && (
                  <div className="space-y-2">
                    {categories && (
                      <>
                        <Label htmlFor={id}>{t("category")}</Label>
                        <select
                          id={id}
                          required
                          className="min-h-11 w-full rounded-md border bg-background px-3"
                          value={category}
                          onChange={(e) => setCategory(e.target.value as typeof category)}
                        >
                          <option value="">{t("noCategory")}</option>
                          <option value="male">{flow("male")}</option>
                          <option value="female">{flow("female")}</option>
                        </select>
                      </>
                    )}
                    <Button
                      className={button}
                      disabled={!!categories && !category}
                      onClick={() => review("waitlist_join_v1")}
                    >
                      {t("waitlist_join_v1")}
                    </Button>
                  </div>
                )}
              </>
            )
          )}
          {draft && (
            <NativeCommandReview
              key={draft.command.input.operation_key}
              scope={scope}
              slot={draft.slot}
              command={draft.command}
              expiresAt={draft.expiresAt}
              onBack={() => setDraft(null)}
              onSaved={(code) => {
                reload(code);
                onChanged?.(code);
              }}
            >
              <p>{draft.label}</p>
              <p>{t("reviewHint")}</p>
              {category && draft.command.operation === "waitlist_join_v1" && (
                <p>{flow(category)}</p>
              )}
              {draft.expiresAt && (
                <p>
                  {t("expires")}{" "}
                  {format.dateTime(new Date(draft.expiresAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </NativeCommandReview>
          )}
        </>
      )}
    </section>
  );
}
