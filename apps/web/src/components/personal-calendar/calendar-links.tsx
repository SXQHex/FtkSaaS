"use client";
import { useCallback, useState, useId } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { v7 } from "uuid";
import type { OrganizationView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { personalCalendarApi, type CalendarCommand } from "../../lib/personal-calendar";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
import { useCalendarCommand } from "./use-calendar-command";
import { control, button } from "../crm/fields";
export function CalendarLinks(props: { actorId: string; organizations: OrganizationView[] }) {
  return <CalendarLinksPanel key={props.actorId} {...props} />;
}
function CalendarLinksPanel({
  actorId,
  organizations,
}: {
  actorId: string;
  organizations: OrganizationView[];
}) {
  const t = useTranslations("personalCalendar"),
    f = useFormatter(),
    id = useId(),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [orgId, setOrgId] = useState(""),
    [kinds, setKinds] = useState<("lessons" | "duties")[]>([]),
    [review, setReview] = useState<CalendarCommand | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [copied, setCopied] = useState(false);
  const load = useCallback(() => personalCalendarApi.list(cursor), [cursor]);
  const result = useRemote(load, JSON.stringify([actorId, cursor, revision]));
  const cmd = useCalendarCommand(actorId, () => {
    setCursor(undefined);
    setReview(null);
    setConfirmed(false);
    setRevision((n) => n + 1);
  });
  function choose(c: CalendarCommand) {
    cmd.clearUrl();
    setReview(c);
    setConfirmed(false);
  }
  const orgs = organizations.filter((o) => ["normal", "grace"].includes(o.access_mode));
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border bg-card p-4 wrap-anywhere"
      aria-label={t("title")}
    >
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p>{t("hint")}</p>
      <Button
        variant="outline"
        className={button}
        onClick={() => {
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {cmd.message &&
      ["saved", "credentialAvailable", "uncertain", "failed"].includes(cmd.message) ? (
        <output>{t(cmd.message)}</output>
      ) : cmd.message ? (
        <FlowError code={cmd.message} />
      ) : null}
      {cmd.pending && (
        <div className="space-y-2 rounded-md border p-3">
          <p>{t(cmd.pending === "invalid" ? "invalidPending" : "pending")}</p>
          <Button
            className={button}
            disabled={cmd.busy || cmd.pending === "invalid"}
            onClick={() => void cmd.check()}
          >
            {t("check")}
          </Button>
          <Button
            className={button}
            variant="outline"
            disabled={cmd.busy || cmd.pending === "invalid"}
            onClick={() => void cmd.run()}
          >
            {t("replay")}
          </Button>
        </div>
      )}
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}{" "}
      {result?.data && (
        <>
          {!result.data.service_ready && <output>{t("notReady")}</output>}
          <fieldset
            disabled={cmd.busy || !!cmd.pending || !result.data.service_ready}
            className="space-y-3"
          >
            <legend>{t("create")}</legend>
            <Label htmlFor={id}>{t("organization")}</Label>
            <select
              id={id}
              className={control}
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setReview(null);
              }}
            >
              <option value="">{t("choose")}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-4">
              {result.data.supported_kinds.map((k) => (
                <label className="flex min-h-11 items-center gap-2" key={k}>
                  <input
                    type="checkbox"
                    checked={kinds.includes(k)}
                    onChange={(e) => {
                      setKinds((v) => (e.target.checked ? [...v, k] : v.filter((i) => i !== k)));
                      setReview(null);
                    }}
                  />
                  {t(k)}
                </label>
              ))}
            </div>
            <Button
              className={button}
              disabled={!orgs.some((o) => o.id === orgId) || !kinds.length}
              onClick={() =>
                choose({
                  operation: "calendar_link_create_v1",
                  input: {
                    operation_key: v7(),
                    organization_scope: { org_id: orgId },
                    kinds: kinds.length === 2 ? [kinds[0]!, kinds[1]!] : [kinds[0]!],
                  },
                })
              }
            >
              {t("create")}
            </Button>
          </fieldset>
          <ul className="space-y-3">
            {result.data.items.map((l, i) => (
              <li key={l.id} className="rounded-md border p-3">
                <h3 className="font-semibold">
                  {organizations.find((o) => o.id === l.org_id)?.name ??
                    t("unavailableOrganization")}{" "}
                  · {t("linkNumber", { number: i + 1 })}
                </h3>
                <p>
                  {l.kinds.map((k) => t(k)).join(" · ")} · {t(l.state)}
                </p>
                <p>
                  {f.dateTime(new Date(l.created_at), { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {l.state === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className={button}
                      disabled={
                        cmd.busy ||
                        !!cmd.pending ||
                        !result.data!.service_ready ||
                        !orgs.some((o) => o.id === l.org_id)
                      }
                      onClick={() =>
                        choose({
                          operation: "calendar_link_rotate_v1",
                          input: {
                            operation_key: v7(),
                            organization_scope: { org_id: l.org_id },
                            link_id: l.id,
                            expected_version: l.version,
                          },
                        })
                      }
                    >
                      {t("rotate")}
                    </Button>
                    <Button
                      variant="outline"
                      className={button}
                      disabled={cmd.busy || !!cmd.pending}
                      onClick={() =>
                        choose({
                          operation: "calendar_link_revoke_v1",
                          input: {
                            operation_key: v7(),
                            link_id: l.id,
                            expected_version: l.version,
                          },
                        })
                      }
                    >
                      {t("revoke")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => setCursor(result.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      {review && !cmd.pending && (
        <section className="space-y-3 rounded-md border p-4" aria-label={t("review")}>
          <h3>{t("review")}</h3>
          <p>
            {t(review.operation === "calendar_link_revoke_v1" ? "revokeWarning" : "rotateWarning")}
          </p>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t("confirm")}
          </label>
          <Button
            className={button}
            disabled={!confirmed || cmd.busy}
            onClick={() => void cmd.run(review)}
          >
            {t("apply")}
          </Button>
          <Button
            className={button}
            variant="outline"
            disabled={cmd.busy}
            onClick={() => setReview(null)}
          >
            {t("back")}
          </Button>
        </section>
      )}
      {cmd.url && (
        <div className="space-y-3">
          <Label htmlFor={`${id}-url`}>{t("subscriptionUrl")}</Label>
          <Input id={`${id}-url`} readOnly value={cmd.url} />
          <p>{t("urlWarning")}</p>
          <Button
            className={button}
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cmd.url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {t("copy")}
          </Button>
          {copied && <output>{t("copied")}</output>}
          <Button
            className={button}
            variant="outline"
            onClick={() => {
              cmd.clearUrl();
              setCopied(false);
            }}
          >
            {t("hide")}
          </Button>
        </div>
      )}
    </section>
  );
}
