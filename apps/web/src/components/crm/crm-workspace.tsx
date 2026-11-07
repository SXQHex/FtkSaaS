"use client";
import Link from "next/link";
import { leadPath } from "../../lib/lead-route";
import dynamic from "next/dynamic";
import { useCallback, useState, useId } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { crmApi } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";
import type { SetupScope } from "../../lib/studio-setup";
import { CenterWorkspace, type Studios } from "./center-workspace";
import { LeadForm } from "./lead-form";
import { FlowError } from "../bookings/flow-controls";
import { OrganizationApplications } from "./organization-applications";
import { button } from "./fields";
import { PersonPicker } from "./person-picker";
const Applications = dynamic(() => import("./applications").then((m) => m.Applications));
const PublicationManager = dynamic(() =>
  import("./publication-manager").then((m) => m.PublicationManager),
);
const Followups = dynamic(() => import("./followups").then((m) => m.Followups));
export function CrmWorkspace({ actorId, studios }: { actorId: string; studios: Studios }) {
  const t = useTranslations("crm"),
    [organizationInbox, setOrganizationInbox] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          className={button}
          variant={!organizationInbox ? "default" : "outline"}
          onClick={() => setOrganizationInbox(false)}
        >
          {t("centerInbox")}
        </Button>
        <Button
          className={button}
          variant={organizationInbox ? "default" : "outline"}
          onClick={() => setOrganizationInbox(true)}
        >
          {t("organizationInbox")}
        </Button>
      </div>
      {organizationInbox ? (
        <OrganizationApplications actorId={actorId} studios={studios} />
      ) : (
        <CenterWorkspace actorId={actorId} studios={studios}>
          {(scope, timeZone) => <CrmCenter scope={scope} timeZone={timeZone} />}
        </CenterWorkspace>
      )}
    </div>
  );
}
function CrmCenter({ scope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    id = useId(),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [creating, setCreating] = useState(false),
    [tab, setTab] = useState("leads"),
    [byPerson, setByPerson] = useState(false),
    [personFilter, setPersonFilter] = useState("");
  const load = useCallback(() => crmApi.leads(scope, search, cursor), [scope, search, cursor]);
  const result = useRemote(load, JSON.stringify([scope, search, cursor, revision]));
  const rows = result?.data?.items.filter((l) => !personFilter || l.person_id === personFilter);
  function reload() {
    setCursor(undefined);
    setRevision((n) => n + 1);
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        {["leads", "applications", "followups", "publications"].map((k) => (
          <Button
            className={button}
            key={k}
            variant={tab === k ? "default" : "outline"}
            onClick={() => setTab(k)}
          >
            {t(k)}
          </Button>
        ))}
      </div>
      {tab === "publications" ? (
        <PublicationManager scope={scope} timeZone={timeZone} />
      ) : tab === "applications" ? (
        <Applications scope={scope} timeZone={timeZone} />
      ) : tab === "followups" ? (
        <Followups scope={scope} timeZone={timeZone} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button className={button} onClick={() => setCreating((v) => !v)}>
              {t("newLead")}
            </Button>
            <Button className={button} variant="outline" onClick={reload}>
              {t("reload")}
            </Button>
          </div>
          <Button className={button} variant="outline" onClick={() => setByPerson((v) => !v)}>
            {t("person")}
          </Button>
          {byPerson && (
            <PersonPicker
              scope={scope}
              onSelect={(p) => {
                setQuery(p.display_name);
                setSearch(p.display_name);
                setPersonFilter(p.id);
                setCursor(undefined);
                setRevision((n) => n + 1);
                setByPerson(false);
              }}
            />
          )}
          {creating && (
            <LeadForm
              scope={scope}
              onSaved={() => {
                setCreating(false);
                reload();
              }}
            />
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPersonFilter("");
              setSearch(query.trim());
              setCursor(undefined);
              setRevision((n) => n + 1);
            }}
          >
            <Label htmlFor={id}>{t("searchLeads")}</Label>
            <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button className={button}>{t("search")}</Button>
          </form>
          {!result && <output>{t("loading")}</output>}
          {result?.error && <FlowError code={result.error} />}
          {result?.data && (
            <>
              <ul className="space-y-3">
                {rows!.map((l, i) => (
                  <li key={l.id} className="rounded-md border p-3">
                    <Button variant="outline" className={button} asChild>
                      <Link href={leadPath(scope.orgId, scope.centerId!, l.person_id, l.id)}>
                        {l.subscriber_number
                          ? t("subscriber", { number: l.subscriber_number })
                          : t("candidate", { number: i + 1 })}{" "}
                        · {l.interest}
                      </Link>
                    </Button>
                    <p>
                      {t(l.state)} · {l.source}
                    </p>
                    {l.due_followup && (
                      <p>
                        {t("due")}{" "}
                        {f.dateTime(new Date(l.due_followup), {
                          timeZone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {!rows?.length && <p>{t("empty")}</p>}
              {result.data.next_cursor && (
                <Button
                  variant="outline"
                  className={button}
                  onClick={() => {
                    setCursor(result.data!.next_cursor!);
                  }}
                >
                  {t("next")}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
