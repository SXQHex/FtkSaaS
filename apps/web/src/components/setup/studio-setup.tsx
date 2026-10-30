"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CenterView,
  DisciplineView,
  OrganizationView,
  SubscriptionView,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SourceForm, DisciplineForm, RoomCreate, SelfCenterAccess } from "./source-forms";
import { RoleSetup } from "./role-setup";
import { errorKey } from "./setup-command";

function PlanSummary({
  orgId,
  onUsage,
}: {
  orgId: string;
  onUsage: (usage: number | null) => void;
}) {
  const t = useTranslations("setup");
  const [plan, setPlan] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void setupCall("subscription_get_v1", { org_id: orgId })
      .then((result) => {
        if (active) {
          setPlan(result);
          setError("");
          onUsage(result.usage.entries.find((entry) => entry.key === "rooms")?.value ?? null);
        }
      })
      .catch((cause) => {
        if (active) {
          setPlan(null);
          setError(errorKey(setupError(cause)));
          onUsage(null);
        }
      });
    return () => {
      active = false;
    };
  }, [orgId, retry, onUsage]);
  return (
    <section className="space-y-4" aria-label={t("planTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{t("planTitle")}</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPlan(null);
            setError("");
            onUsage(null);
            setRetry((n) => n + 1);
          }}
        >
          {t("refresh")}
        </Button>
      </div>
      {error && <p role="alert">{t(error)}</p>}
      {!plan && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {plan && (
        <div className="space-y-3">
          <p>{t(`plans.${plan.plan}`)}</p>
          <dl className="divide-y rounded-lg border px-4">
            {plan.limits.entries.map((limit) => (
              <div key={limit.key} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                <dt>{t(`limits.${limit.key}`)}</dt>
                <dd>
                  {plan.usage.entries.find((entry) => entry.key === limit.key)?.value ?? "—"} /{" "}
                  {limit.value}
                </dd>
              </div>
            ))}
          </dl>
          {plan.starter_scope_required === true && <p role="alert">{t("scopeRequired")}</p>}
          {plan.plan === "starter" && (
            <p className="text-sm text-muted-foreground">{t("starterHint")}</p>
          )}
        </div>
      )}
    </section>
  );
}
function DisciplinesSetup({ scope, onChanged }: { scope: SetupScope; onChanged: () => void }) {
  const t = useTranslations("setup");
  const [items, setItems] = useState<DisciplineView[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const rows: DisciplineView[] = [];
      let cursor: string | null | undefined;
      do {
        const result = await setupCall("disciplines_list_v1", {
          org_id: scope.orgId,
          page: { limit: 50, ...(cursor ? { cursor } : {}) },
        });
        rows.push(...result.items);
        cursor = result.next_cursor;
      } while (cursor);
      if (active) {
        setItems(rows);
        setError("");
      }
    }
    void load().catch((cause) => {
      if (active) {
        setItems(null);
        setError(errorKey(setupError(cause)));
      }
    });
    return () => {
      active = false;
    };
  }, [scope.orgId, retry]);
  function saved() {
    setRetry((n) => n + 1);
    onChanged();
  }
  return (
    <section className="space-y-5" aria-label={t("disciplines")}>
      <h3 className="text-lg font-semibold">{t("disciplines")}</h3>
      {error && <p role="alert">{t(error)}</p>}
      {!items && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      <Button type="button" variant="outline" onClick={() => setRetry((n) => n + 1)}>
        {t("refresh")}
      </Button>
      {items && (
        <div className="space-y-5">
          {items.map((discipline) => (
            <details
              key={`${discipline.id}:${discipline.version}`}
              className="space-y-4 rounded-lg border p-4"
            >
              <summary className="cursor-pointer font-medium">
                {discipline.name} ({t(discipline.state === "active" ? "active" : "inactive")})
              </summary>
              <DisciplineForm scope={scope} discipline={discipline} onSaved={saved} />
            </details>
          ))}
          <details className="space-y-4 rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">{t("createDiscipline")}</summary>
            <DisciplineForm key={retry} scope={scope} onSaved={saved} />
          </details>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t("disciplineConnectionBlocked")}</p>
    </section>
  );
}
function CenterSetup({
  scope,
  center,
  roomUsage,
  normal,
  onChanged,
}: {
  scope: SetupScope;
  center: CenterView;
  roomUsage: number | null;
  normal: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("setup");
  return (
    <section
      className="space-y-8 border-t pt-6"
      aria-label={t("selectedCenter", { name: center.name })}
    >
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{center.name}</h3>
        <p className="text-sm text-muted-foreground">
          {t("centerZone", { zone: center.timezone })}
        </p>
        <p className="text-sm">
          {t(center.accessible ? "centerAccessible" : "centerNotAccessible")}
        </p>
      </div>
      <SelfCenterAccess scope={scope} onSaved={onChanged} />
      {normal && (
        <>
          <SourceForm
            key={center.version}
            scope={scope}
            target={{ kind: "center", center }}
            onSaved={onChanged}
          />
          <section className="space-y-4" aria-label={t("roomTitle")}>
            <h3 className="text-lg font-semibold">{t("roomTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("roomReadBlocked")}</p>
            {roomUsage === 0 && center.accessible && (
              <RoomCreate scope={scope} onSaved={onChanged} />
            )}
          </section>
          <RoleSetup scope={scope} onChanged={onChanged} />
        </>
      )}
    </section>
  );
}
function OrganizationSetup({
  actorId,
  initial,
  onChanged,
}: {
  actorId: string;
  initial: OrganizationView;
  onChanged: () => void;
}) {
  const t = useTranslations("setup");
  const [organization, setOrganization] = useState<OrganizationView | null>(null);
  const [centers, setCenters] = useState<CenterView[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [roomUsage, setRoomUsage] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const org = await setupCall("organization_get_v1", { org_id: initial.id });
      const rows: CenterView[] = [];
      let cursor: string | null | undefined;
      if (["normal", "bootstrap", "grace"].includes(org.access_mode)) {
        do {
          const result = await setupCall("centers_list_v1", {
            org_id: org.id,
            page: { limit: 50, ...(cursor ? { cursor } : {}) },
          });
          rows.push(...result.items);
          cursor = result.next_cursor;
        } while (cursor);
      }
      if (active) {
        setOrganization(org);
        setCenters(rows);
        setSelected((id) =>
          rows.some((center) => center.id === id) ? id : rows.length === 1 ? rows[0].id : "",
        );
        setError("");
      }
    }
    void load().catch((cause) => {
      if (active) {
        setOrganization(null);
        setCenters(null);
        setError(errorKey(setupError(cause)));
      }
    });
    return () => {
      active = false;
    };
  }, [initial.id, retry]);
  function reload() {
    setOrganization(null);
    setCenters(null);
    setRoomUsage(null);
    setError("");
    setRetry((n) => n + 1);
  }
  function saved() {
    reload();
    onChanged();
  }
  const org = organization;
  const scope: SetupScope = { actorId, orgId: initial.id };
  const center = centers?.find((row) => row.id === selected);
  return (
    <div className="space-y-8">
      <Button type="button" variant="outline" onClick={reload}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      <PlanSummary key={`${initial.id}:${retry}`} orgId={initial.id} onUsage={setRoomUsage} />
      {!org && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {org && (
        <>
          <section className="space-y-4 border-t pt-6">
            <h2 className="text-xl font-semibold">{org.name}</h2>
            <p>{t(`access.${org.access_mode}`)}</p>
            <p className="text-sm text-muted-foreground">{t("setupIncomplete")}</p>
            {org.access_mode === "normal" && (
              <SourceForm
                key={org.version}
                scope={scope}
                target={{ kind: "organization", organization: org }}
                onSaved={saved}
              />
            )}
          </section>
          {["bootstrap", "normal"].includes(org.access_mode) && (
            <>
              <section className="space-y-4" aria-label={t("centers")}>
                <h3 className="text-lg font-semibold">{t("centers")}</h3>
                <div className="flex flex-wrap gap-3">
                  {centers
                    ?.filter((row) => row.state === "active")
                    .map((row) => (
                      <Button
                        key={row.id}
                        type="button"
                        variant={selected === row.id ? "default" : "outline"}
                        onClick={() => setSelected(row.id)}
                        aria-pressed={selected === row.id}
                      >
                        {row.name}
                      </Button>
                    ))}
                </div>
                <details className="space-y-4 rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium">{t("createCenter")}</summary>
                  <SourceForm scope={scope} target={{ kind: "center" }} onSaved={saved} />
                </details>
              </section>
              {org.access_mode === "normal" && <DisciplinesSetup scope={scope} onChanged={saved} />}
              {center && (
                <CenterSetup
                  key={center.id}
                  scope={{ ...scope, centerId: center.id }}
                  center={center}
                  roomUsage={roomUsage}
                  normal={org.access_mode === "normal"}
                  onChanged={saved}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
export function StudioSetup({
  actorId,
  organizations,
  onChanged,
}: {
  actorId: string;
  organizations: OrganizationView[];
  onChanged: () => void;
}) {
  const t = useTranslations("setup");
  const [selected, setSelected] = useState(organizations.length === 1 ? organizations[0].id : "");
  const organization = organizations.find((row) => row.id === selected);
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {organizations.length === 0 && <p>{t("noOrganization")}</p>}
      {organizations.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {organizations.map((org) => (
            <Button
              key={org.id}
              type="button"
              variant={selected === org.id ? "default" : "outline"}
              aria-pressed={selected === org.id}
              onClick={() => setSelected(org.id)}
            >
              {org.name}
            </Button>
          ))}
        </div>
      )}
      {organization && (
        <OrganizationSetup
          key={`${actorId}:${organization.id}`}
          actorId={actorId}
          initial={organization}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
