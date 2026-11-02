"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { DisciplineView, ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import {
  getCenterDiscipline,
  readableCenterDiscipline,
  getSetupDisciplines,
  setupError,
  type SetupScope,
} from "../../lib/studio-setup";
import { SetupFeedback, errorKey, useSetupCommand } from "./setup-command";

export function CenterDiscipline({
  scope,
  discipline,
  onChanged,
}: {
  scope: SetupScope;
  discipline: DisciplineView;
  onChanged: () => void;
}) {
  const t = useTranslations("setup");
  const [relation, setRelation] = useState<ManagementStateView | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  function refresh() {
    setRelation(null);
    setError("");
    setRetry((n) => n + 1);
  }
  const command = useSetupCommand(scope, `center-discipline:${discipline.id}`, () => {
    refresh();
    onChanged();
  });
  useEffect(() => {
    let active = true;
    void getCenterDiscipline(scope.orgId, scope.centerId!, discipline.id)
      .then((item) => {
        if (active) {
          setRelation(item);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setRelation(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, discipline.id, retry]);
  const version = relation?.versions.find(
    (entry) =>
      entry.entity.type === "center_disciplines" && entry.entity.id === relation.entity?.id,
  )?.version;
  const readable = readableCenterDiscipline(relation, discipline.id);
  const active = relation?.state === "active";
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="font-medium">{discipline.name}</h4>
      <Button variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!relation && !error && <output aria-live="polite">{t("loading")}</output>}
      {relation && !readable && <p role="alert">{t("unreadableRelation")}</p>}
      {readable && relation && (
        <>
          <p>{t(active ? "disciplineLinked" : "disciplineUnlinked")}</p>
          <Button
            variant={active ? "outline" : "default"}
            disabled={command.busy || !!command.pending}
            onClick={() =>
              void command.run({
                operation: "center_discipline_set_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId!,
                  discipline_id: discipline.id,
                  operation_key: v7(),
                  state: active ? "inactive" : "active",
                  ...(relation.exists ? { expected_version: version } : {}),
                },
              })
            }
          >
            {t(active ? "unlinkDiscipline" : "linkDiscipline")}
          </Button>
        </>
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
export function CenterDisciplines({
  scope,
  onChanged,
}: {
  scope: SetupScope;
  onChanged: () => void;
}) {
  const t = useTranslations("setup");
  const [items, setItems] = useState<DisciplineView[] | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const rows = await getSetupDisciplines(scope.orgId);
      if (active) {
        setItems(rows);
        setSelected((id) =>
          rows.some((row) => row.id === id) ? id : rows.length === 1 ? rows[0].id : "",
        );
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
  const discipline = items?.find((row) => row.id === selected);
  return (
    <section className="space-y-4" aria-label={t("centerDisciplines")}>
      <h3 className="text-lg font-semibold">{t("centerDisciplines")}</h3>
      <Button
        variant="outline"
        onClick={() => {
          setItems(null);
          setError("");
          setRetry((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!items && !error && <output aria-live="polite">{t("loading")}</output>}
      {items?.length === 0 && <p>{t("noDisciplines")}</p>}
      <div className="flex flex-wrap gap-3">
        {items?.map((row) => (
          <Button
            key={row.id}
            variant={selected === row.id ? "default" : "outline"}
            aria-pressed={selected === row.id}
            onClick={() => setSelected(row.id)}
          >
            {row.name}
          </Button>
        ))}
      </div>
      {discipline && (
        <CenterDiscipline
          key={`${scope.centerId}:${discipline.id}`}
          scope={scope}
          discipline={discipline}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}
