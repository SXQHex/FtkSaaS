"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PersonView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { getAccount, getCenters, getPerson } from "../../lib/api";
import { browserClient } from "../../lib/supabase/client";
import { crmApi, type LeadRecord } from "../../lib/crm";
import { leadPath } from "../../lib/lead-route";
import { personPath } from "../../lib/person-route";
import { FlowError, flowError } from "../bookings/flow-controls";
import { LeadDetails } from "./lead-details";
import { button } from "./fields";
export function LeadPage({
  authUserId,
  orgId,
  centerId,
  personId,
  leadId,
}: {
  authUserId: string;
  orgId: string;
  centerId: string;
  personId: string;
  leadId: string;
}) {
  const t = useTranslations("crm"),
    router = useRouter(),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [snapshot, setSnapshot] = useState<{
      actorId: string;
      lead: LeadRecord;
      person: PersonView;
      timeZone: string;
      attempt: number;
    }>(),
    lock = useRef(false);
  const path = leadPath(orgId, centerId, personId, leadId);
  useEffect(() => {
    const life = new AbortController();
    lock.current = true;
    function leave() {
      life.abort();
      setSnapshot(undefined);
      router.replace(`/login?next=${encodeURIComponent(path)}`);
      router.refresh();
    }
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== authUserId))
        leave();
    });
    void (async () => {
      try {
        const [account, centers, person] = await Promise.all([
          getAccount(),
          getCenters(orgId),
          getPerson(orgId, centerId, personId),
        ]);
        if (life.signal.aborted) return;
        const center = centers.find(
          (c) => c.id === centerId && c.accessible && c.state === "active",
        );
        if (!center || person.id !== personId) throw Error("FORBIDDEN");
        const lead = await crmApi.lead({ actorId: account.id, orgId, centerId }, personId, leadId);
        if (!life.signal.aborted) {
          setSnapshot({
            actorId: account.id,
            lead: { ...lead, subscriber_number: person.subscriber_number },
            person,
            timeZone: center.timezone,
            attempt,
          });
          setError("");
        }
      } catch (e) {
        if (!life.signal.aborted) {
          setSnapshot(undefined);
          setError(flowError(e));
        }
      } finally {
        if (!life.signal.aborted) lock.current = false;
      }
    })();
    function refresh() {
      if (!life.signal.aborted && !lock.current && document.visibilityState === "visible") {
        setSnapshot(undefined);
        setAttempt((n) => n + 1);
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      life.abort();
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authUserId, orgId, centerId, personId, leadId, attempt, path, router]);
  const actorId = snapshot?.actorId,
    scope = useMemo(
      () => (actorId ? { actorId, orgId, centerId } : undefined),
      [actorId, orgId, centerId],
    );
  const busy = !snapshot || snapshot.attempt !== attempt;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-w-0 max-w-4xl space-y-5 p-4 sm:p-6"
    >
      <Link className="inline-flex min-h-11 items-center underline" href="/#crm">
        {t("backToLeads")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("details")}</h1>
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setSnapshot(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {error && <FlowError code={error} />} {busy && !error && <output>{t("loading")}</output>}{" "}
      {snapshot && scope && (
        <>
          <p>
            {snapshot.lead.subscriber_number
              ? t("subscriber", { number: snapshot.lead.subscriber_number })
              : t("noSubscriber")}
          </p>
          <Link
            className="inline-flex min-h-11 items-center underline"
            href={personPath(orgId, centerId, personId)}
          >
            {t("personRecord")}
          </Link>
          <fieldset disabled={busy} className="min-w-0">
            <LeadDetails
              scope={scope}
              lead={snapshot.lead}
              personName={snapshot.person.display_name}
              timeZone={snapshot.timeZone}
              onSaved={() => setAttempt((n) => n + 1)}
            />
          </fieldset>
        </>
      )}
    </main>
  );
}
