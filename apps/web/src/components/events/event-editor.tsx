"use client";
import { useDisplayMoney } from "../display-format";
import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { validEventCommand } from "../../lib/event-command";
import { v7 } from "uuid";
import type { EventView, EventDutyInput } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { eventCatalog } from "../../lib/events";
import { useRemote } from "../../lib/use-remote";
import { sessionInterval } from "../../lib/session-create";
import { localDateTime } from "../../lib/session-change";
import { priceToMinor } from "../../lib/product-terms";
import { type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { LocalTimeField } from "../programs/local-time-field";
import { FlowError, flowError, ConfirmWrite } from "../bookings/flow-controls";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
export const control = "min-h-11 w-full rounded-md border bg-background px-3",
  button = "h-auto min-h-11 max-w-full whitespace-normal";
export function EventEditor({
  scope,
  timeZone,
  event,
  onSaved,
}: {
  scope: SetupScope;
  timeZone: string;
  event?: EventView;
  onSaved: (id?: string) => void;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("events"),
    locale = useLocale(),
    load = useCallback(() => eventCatalog(scope), [scope]),
    catalog = useRemote(load, JSON.stringify(scope));
  const [draft, setDraft] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [start, setStart] = useState(event ? localDateTime(event.interval.starts_at, timeZone) : ""),
    [end, setEnd] = useState(event ? localDateTime(event.interval.ends_at, timeZone) : ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [kind, setKind] = useState(event?.venue.kind ?? ""),
    [unlimited, setUnlimited] = useState(event?.capacity && "kind" in event.capacity),
    [practice, setPractice] = useState(event?.terms.package_usage === "eligibility_only"),
    [selected, setSelected] = useState<string[]>(event?.terms.allowed_product_version_ids ?? []),
    [disciplines, setDisciplines] = useState<string[]>(event?.discipline_ids ?? []),
    [duties, setDuties] = useState<EventDutyInput[]>(event?.assignment_terms ?? []);
  const command = useSetupCommand(
    scope,
    event ? `event:${event.id}` : `event-create:${scope.centerId}`,
    onSaved,
  );
  function reviewCommand(value: SetupCommand) {
    if (
      !validEventCommand(
        value.operation,
        value.input,
        scope.centerId,
        event ? `event:${event.id}` : `event-create:${scope.centerId}`,
      )
    )
      throw Error("invalidEvent");
    setDraft(value);
  }
  const missingTerms =
    !!event?.assignments.length &&
    !event.assignments.every((a) =>
      event.assignment_terms?.some((t) => t.person_id === a.person_id && t.duty === a.duty),
    );
  return (
    <section className="space-y-4">
      <h3>{t(event ? "edit" : "create")}</h3>
      <SetupFeedback command={command} />
      {!catalog && <output>{t("loading")}</output>}
      {catalog?.error && <FlowError code={catalog.error} />} {error && <FlowError code={error} />}{" "}
      {catalog?.data && (
        <form
          className="space-y-4"
          onChange={() => setDraft(null)}
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              const d = new FormData(e.currentTarget),
                currency = String(d.get("currency")).toUpperCase(),
                fee = priceToMinor(String(d.get("fee")), currency),
                room = String(d.get("room") ?? "");
              if (kind === "internal" && !catalog.data!.rooms.some((r) => r.id === room))
                throw Error("invalidEvent");
              reviewCommand({
                operation: "event_save_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  ...(event ? { event_id: event.id, expected_version: event.version } : {}),
                  name: String(d.get("name")).trim(),
                  timezone: timeZone,
                  interval: sessionInterval(start, end, timeZone, from, to),
                  venue:
                    kind === "internal"
                      ? {
                          ...(event?.venue.kind === kind ? event.venue : {}),
                          kind: "internal",
                          room_id: room,
                          timezone: event?.venue.kind === kind ? event.venue.timezone : timeZone,
                        }
                      : {
                          ...(event?.venue.kind === kind ? event.venue : {}),
                          kind: "external",
                          name: String(d.get("venueName")).trim(),
                          address: String(d.get("address")).trim(),
                          timezone: event?.venue.kind === kind ? event.venue.timezone : timeZone,
                        },
                  capacity:
                    unlimited && kind === "external"
                      ? { kind: "unlimited" }
                      : { nominal: Number(d.get("nominal")), maximum: Number(d.get("maximum")) },
                  discipline_ids: disciplines,
                  assignments: duties.map((duty) => {
                    const dutyCurrency = String(
                      d.get(`dutyCurrency:${duty.person_id}`),
                    ).toUpperCase();
                    return {
                      person_id: duty.person_id,
                      duty: String(d.get(`duty:${duty.person_id}`)) as "instructor" | "assistant",
                      currency: dutyCurrency,
                      fee_minor: priceToMinor(
                        String(d.get(`dutyFee:${duty.person_id}`)),
                        dutyCurrency,
                      ),
                    };
                  }),
                  terms: {
                    fee_minor: fee,
                    currency,
                    full_payment_required: d.get("fullPayment") === "on",
                    package_usage: practice ? "eligibility_only" : "consume",
                    allowed_product_version_ids: selected,
                    cancellation: {
                      cutoff_minutes: d.get("cutoff") ? Number(d.get("cutoff")) : null,
                      before_cutoff: String(d.get("before")) as "release" | "consume",
                      after_cutoff: String(d.get("after")) as "release" | "consume",
                      no_show: String(d.get("noShow")) as "release" | "consume",
                    },
                    refund: {
                      method: String(d.get("refund")) as
                        | "none"
                        | "credit_ratio"
                        | "time_ratio"
                        | "used_at_unit_price",
                      ...(d.get("usedPrice")
                        ? { used_unit_minor: priceToMinor(String(d.get("usedPrice")), currency) }
                        : {}),
                    },
                  },
                },
              });
            } catch (c) {
              setError(flowError(c));
            }
          }}
        >
          <fieldset
            disabled={command.busy || !!command.pending || missingTerms}
            className="space-y-4"
          >
            <label className="block">
              {t("name")}
              <Input name="name" required maxLength={10000} defaultValue={event?.name} />
            </label>
            <LocalTimeField
              label={t("start")}
              value={start}
              choice={from}
              timeZone={timeZone}
              onChange={setStart}
              onChoice={setFrom}
            />
            <LocalTimeField
              label={t("end")}
              value={end}
              choice={to}
              timeZone={timeZone}
              onChange={setEnd}
              onChoice={setTo}
            />
            <label className="block">
              {t("venueKind")}
              <select
                className={control}
                required
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setUnlimited(false);
                }}
              >
                <option value="">{t("choose")}</option>
                <option value="internal">{t("internal")}</option>
                <option value="external">{t("external")}</option>
              </select>
            </label>
            {kind === "internal" ? (
              <label className="block">
                {t("room")}
                <select
                  className={control}
                  required
                  name="room"
                  defaultValue={event?.venue.room_id ?? ""}
                >
                  <option value="">{t("choose")}</option>
                  {catalog.data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.capacity}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              kind === "external" && (
                <>
                  <label className="block">
                    {t("venueName")}
                    <Input name="venueName" required defaultValue={event?.venue.name ?? ""} />
                  </label>
                  <label className="block">
                    {t("address")}
                    <Input name="address" required defaultValue={event?.venue.address ?? ""} />
                  </label>
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!unlimited}
                      onChange={(e) => setUnlimited(e.target.checked)}
                    />
                    {t("unlimited")}
                  </label>
                </>
              )
            )}
            {!unlimited && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["nominal", "maximum"] as const).map((k) => (
                  <label key={k}>
                    {t(k)}
                    <Input
                      required
                      type="number"
                      name={k}
                      min={0}
                      step={1}
                      defaultValue={
                        event?.capacity && !("kind" in event.capacity) ? event.capacity[k] : ""
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <label className="block">
              {t("currency")}
              <Input
                name="currency"
                required
                pattern="[A-Za-z]{3}"
                maxLength={3}
                defaultValue={event?.terms.currency}
              />
            </label>
            <label className="block">
              {t("fee")}
              <Input
                name="fee"
                required
                inputMode="decimal"
                defaultValue={event ? minorPrice(event.terms.fee_minor, event.terms.currency) : ""}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="fullPayment"
                defaultChecked={event?.terms.full_payment_required}
              />
              {t("fullPayment")}
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={practice}
                onChange={(e) => setPractice(e.target.checked)}
              />
              {t("practice")}
            </label>
            {practice && <p>{t("practiceHint")}</p>}
            <fieldset className="space-y-2">
              <legend>{t("products")}</legend>
              {catalog.data.products.map((p) => (
                <label className="flex min-h-11 items-center gap-3" key={p.version_id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.version_id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, p.version_id]
                          : ids.filter((id) => id !== p.version_id),
                      )
                    }
                  />
                  {p.terms.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>{t("disciplines")}</legend>
              {catalog.data.disciplines.map((d) => (
                <label className="flex min-h-11 items-center gap-3" key={d.id}>
                  <input
                    type="checkbox"
                    checked={disciplines.includes(d.id)}
                    onChange={(e) =>
                      setDisciplines((ids) =>
                        e.target.checked ? [...ids, d.id] : ids.filter((id) => id !== d.id),
                      )
                    }
                  />
                  {d.name}
                </label>
              ))}
            </fieldset>
            {(
              [
                ["before", "before_cutoff"],
                ["after", "after_cutoff"],
                ["noShow", "no_show"],
              ] as const
            ).map(([field, key]) => (
              <label className="block" key={field}>
                {t(field)}
                <select
                  className={control}
                  name={field}
                  required
                  defaultValue={event?.terms.cancellation[key] ?? ""}
                >
                  <option value="">{t("choose")}</option>
                  <option value="release">{t("release")}</option>
                  <option value="consume">{t("consume")}</option>
                </select>
              </label>
            ))}
            <label className="block">
              {t("cutoff")}
              <Input
                name="cutoff"
                type="number"
                min={0}
                step={1}
                defaultValue={event?.terms.cancellation.cutoff_minutes ?? ""}
              />
            </label>
            <label className="block">
              {t("refund")}
              <select
                className={control}
                name="refund"
                required
                defaultValue={event?.terms.refund.method ?? ""}
              >
                <option value="">{t("choose")}</option>
                {["none", "credit_ratio", "used_at_unit_price", "time_ratio"].map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t("usedPrice")}
              <Input
                name="usedPrice"
                inputMode="decimal"
                defaultValue={
                  event?.terms.refund.used_unit_minor
                    ? minorPrice(event.terms.refund.used_unit_minor, event.terms.currency)
                    : ""
                }
              />
            </label>
            <fieldset>
              <legend>{t("duties")}</legend>
              {catalog.data.people.map((p) => {
                const duty = duties.find((d) => d.person_id === p.id);
                return (
                  <div key={p.id} className="space-y-2 border-b py-3">
                    <label className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!duty}
                        onChange={(e) =>
                          setDuties((old) =>
                            e.target.checked
                              ? [
                                  ...old,
                                  {
                                    person_id: p.id,
                                    duty: "instructor",
                                    fee_minor: "0",
                                    currency: "",
                                  },
                                ]
                              : old.filter((d) => d.person_id !== p.id),
                          )
                        }
                      />
                      {p.name}
                    </label>
                    {duty && (
                      <>
                        <label>
                          {t("duty")} · {p.name}
                          <select
                            className={control}
                            name={`duty:${p.id}`}
                            required
                            defaultValue={
                              event?.assignment_terms?.find((d) => d.person_id === p.id)?.duty ?? ""
                            }
                          >
                            <option value="">{t("choose")}</option>
                            <option value="instructor">{t("instructor")}</option>
                            <option value="assistant">{t("assistant")}</option>
                          </select>
                        </label>
                        <label>
                          {t("dutyCurrency")} · {p.name}
                          <Input
                            name={`dutyCurrency:${p.id}`}
                            required
                            pattern="[A-Za-z]{3}"
                            maxLength={3}
                            defaultValue={duty.currency}
                          />
                        </label>
                        <label>
                          {t("dutyFee")} · {p.name}
                          <Input
                            name={`dutyFee:${p.id}`}
                            required
                            inputMode="decimal"
                            defaultValue={
                              duty.currency ? minorPrice(duty.fee_minor, duty.currency) : ""
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <Button className={button}>{t("review")}</Button>
          </fieldset>
        </form>
      )}
      {draft && !command.pending && (
        <ConfirmWrite command={draft} controller={command} onBack={() => setDraft(null)}>
          <p>{t("saveHint")}</p>
          {draft.operation === "event_save_v1" && (
            <p>
              {draft.input.name} ·{" "}
              {effectMoney(draft.input.terms.fee_minor, draft.input.terms.currency, locale)}
            </p>
          )}
        </ConfirmWrite>
      )}
    </section>
  );
}
function minorPrice(value: string, currency: string) {
  const n =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const padded = value.padStart(n + 1, "0");
  return n ? `${padded.slice(0, -n)}.${padded.slice(-n)}` : padded;
}
