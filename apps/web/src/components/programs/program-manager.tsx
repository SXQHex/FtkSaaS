"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Badge } from "@ftksaas/ui/components/badge";
import { classValues, getClasses, getProgramCatalog } from "../../lib/program";
import { setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey } from "../setup/setup-command";
import { ProgramRecovery } from "./program-recovery";
import { SingleSessionForm } from "./single-session-form";
import { ClassDuty } from "./class-duty";
import { ClassForm } from "./class-form";
import { ProgramHistory } from "./program-history";
import { ProgramForm, type ProgramCatalog } from "./program-form";
export function ProgramManager({
  scope,
  timeZone,
  onChanged,
}: {
  scope: SetupScope;
  timeZone: string;
  onChanged: () => void;
}) {
  const t = useTranslations("program"),
    errors = useTranslations("setup");
  const [savedNotice, setSavedNotice] = useState(false);
  const [attempt, setAttempt] = useState(0),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<{
    key: string;
    classes?: ManagementStateView[];
    catalog?: ProgramCatalog;
    error?: string;
  } | null>(null);
  const key = `${scope.actorId}:${scope.orgId}:${scope.centerId}:${attempt}`;
  useEffect(() => {
    let active = true;
    void Promise.all([
      getClasses({ actorId: scope.actorId, orgId: scope.orgId, centerId: scope.centerId }),
      getProgramCatalog({ actorId: scope.actorId, orgId: scope.orgId, centerId: scope.centerId }),
    ])
      .then(([classes, catalog]) => {
        if (active) setState({ key, classes, catalog });
      })
      .catch((cause) => {
        if (active) setState({ key, error: errorKey(setupError(cause)) });
      });
    return () => {
      active = false;
    };
  }, [scope.actorId, scope.orgId, scope.centerId, key]);
  const current = state?.key === key ? state : null;
  const selected = current?.classes?.find((c) => c.entity?.id === selectedId);
  const value = selected ? classValues(selected) : null;
  function refresh() {
    setAttempt((n) => n + 1);
  }
  function saved() {
    setSavedNotice(true);
    refresh();
    onChanged();
  }
  return (
    <section className="min-w-0 space-y-5" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button variant="outline" onClick={refresh}>
          {t("refresh")}
        </Button>
      </div>
      {savedNotice && <output aria-live="polite">{t("saved")}</output>}
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.error && (
        <>
          <p role="alert">{errors(current.error)}</p>
          <ProgramRecovery key={key} scope={scope} onSaved={saved} />
        </>
      )}
      {current?.catalog && current.classes && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-3">
            <Button
              variant="outline"
              onClick={() => setSelectedId(null)}
              aria-pressed={selectedId === null}
            >
              {t("createClass")}
            </Button>
            {!current.classes.length && (
              <p className="text-sm text-muted-foreground">{t("emptyClasses")}</p>
            )}
            {current.classes.map((row) => {
              const c = classValues(row)!;
              return (
                <Card key={c.id} className="shadow-none">
                  <CardContent className="space-y-3 pt-5">
                    <h3 className="break-words font-medium">{c.name}</h3>
                    <Badge variant="secondary">
                      {t(c.external_open ? "openGroup" : "fixedGroup")}
                    </Badge>
                    <div>
                      <Button
                        variant={selectedId === c.id ? "secondary" : "outline"}
                        aria-pressed={selectedId === c.id}
                        onClick={() => setSelectedId(c.id)}
                      >
                        {t("manageClass")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="min-w-0 space-y-5">
            <Card className="min-w-0 shadow-none">
              <CardHeader>
                <CardTitle>
                  <h3>{t(value ? "editClass" : "createClass")}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClassForm
                  key={value ? `${value.id}:${value.version}` : "new"}
                  scope={scope}
                  current={value ?? undefined}
                  disciplines={current.catalog.disciplines}
                  onSaved={saved}
                />
              </CardContent>
            </Card>
            <Card className="min-w-0 shadow-none">
              <CardHeader>
                <CardTitle>
                  <h3>{t("createSession")}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SingleSessionForm
                  scope={scope}
                  timeZone={timeZone}
                  catalog={current.catalog}
                  classes={current.classes.map((c) => classValues(c)!)}
                  onSaved={saved}
                />
              </CardContent>
            </Card>
            {value && (
              <Card className="min-w-0 shadow-none">
                <CardHeader>
                  <CardTitle>
                    <h3>{t("newProgram")}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ClassDuty
                    scope={scope}
                    classId={value.id}
                    people={
                      current.catalog.duties ??
                      current.catalog.instructors.map((p) => ({
                        ...p,
                        duty: "instructor" as const,
                      }))
                    }
                    onSaved={saved}
                  />
                  <div className="my-6 border-t" />
                  <ProgramForm
                    key={value.id}
                    scope={scope}
                    selected={value}
                    catalog={current.catalog}
                    timeZone={timeZone}
                    onSaved={saved}
                  />
                  <div className="mt-6">
                    <ProgramHistory
                      key={`${value.id}:${attempt}`}
                      scope={scope}
                      classId={value.id}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
