"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Badge } from "@ftksaas/ui/components/badge";
import { classValues, getClasses, getProgramCatalog } from "../../lib/program";
import { setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey } from "../setup/setup-command";
import { ProgramRecovery } from "./program-recovery";
import { CalendarPlus, ChevronRight, GraduationCap, Pencil, Plus, UserRound } from "lucide-react";
import { ProgramEditorPanel, type ProgramEditorMode } from "./program-editor-panel";
import { ProgramHistory } from "./program-history";
import type { ProgramCatalog } from "./program-form";
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
  const scopeKey = `${scope.actorId}:${scope.orgId}:${scope.centerId}`;
  const [editor, setEditor] = useState<{ scopeKey: string; mode: ProgramEditorMode } | null>(null);
  const opened = editor?.scopeKey === scopeKey ? editor.mode : null;
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  function restoreFocus() {
    (opener.current?.isConnected ? opener.current : heading.current)?.focus();
  }
  function open(mode: ProgramEditorMode) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor({ scopeKey, mode });
  }
  const key = `${scopeKey}:${attempt}`;
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
    setEditor(null);
    setSavedNotice(true);
    refresh();
    onChanged();
  }
  return (
    <section className="min-w-0 space-y-6" aria-label={t("title")}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("managerHint")}</p>
        </div>
        <Button variant="outline" disabled={!!opened} onClick={refresh}>
          {t("refresh")}
        </Button>
      </header>
      {savedNotice && <output aria-live="polite">{t("saved")}</output>}
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.error && <p role="alert">{errors(current.error)}</p>}
      {current && (!opened || current.error) && (
        <ProgramRecovery key={key} scope={scope} onSaved={saved} />
      )}
      {current?.catalog && current.classes && (
        <>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => open("createClass")}>
              <Plus aria-hidden="true" />
              {t("createClass")}
            </Button>
            <Button variant="outline" onClick={() => open("session")}>
              <CalendarPlus aria-hidden="true" />
              {t("singleAction")}
            </Button>
          </div>
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <section className="min-w-0 space-y-3" aria-label={t("classList")}>
              <h3 className="text-sm font-medium text-muted-foreground">{t("classList")}</h3>
              {!current.classes.length && (
                <div className="rounded-xl border border-dashed p-6">
                  <GraduationCap className="mb-4 size-7 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm leading-6 text-muted-foreground">{t("emptyClasses")}</p>
                </div>
              )}
              {current.classes.map((row) => {
                const c = classValues(row)!;
                return (
                  <Card
                    key={c.id}
                    className={
                      selectedId === c.id ? "border-foreground/30 shadow-none" : "shadow-none"
                    }
                  >
                    <CardContent className="space-y-4 pt-5">
                      <div className="space-y-2">
                        <h3 className="break-words font-medium">{c.name}</h3>
                        <Badge variant="secondary">
                          {t(c.external_open ? "openGroup" : "fixedGroup")}
                        </Badge>
                      </div>
                      <Button
                        variant={selectedId === c.id ? "secondary" : "outline"}
                        className="w-full justify-between"
                        aria-label={t("manageNamedClass", { name: c.name })}
                        aria-pressed={selectedId === c.id}
                        onClick={() => setSelectedId(c.id)}
                      >
                        {t("manageClass")}
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
            {value ? (
              <Card className="min-w-0 self-start shadow-none">
                <CardHeader>
                  <h3 className="text-xs font-medium text-muted-foreground">{t("classDetail")}</h3>
                  <CardTitle>
                    <h4 className="break-words">{value.name}</h4>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {current.catalog.disciplines.find((d) => d.id === value.discipline_id)?.name ??
                      t("unavailableDiscipline")}
                  </p>
                </CardHeader>
                <CardContent className="min-w-0 space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      className="h-auto min-h-11 whitespace-normal sm:col-span-2"
                      onClick={() => open("program")}
                    >
                      <CalendarPlus aria-hidden="true" />
                      {t("planAction")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto min-h-11 whitespace-normal"
                      onClick={() => open("editClass")}
                    >
                      <Pencil aria-hidden="true" />
                      {t("editClass")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto min-h-11 whitespace-normal"
                      onClick={() => open("duties")}
                    >
                      <UserRound aria-hidden="true" />
                      {t("defaultDuties")}
                    </Button>
                  </div>
                  <div className="border-t pt-5">
                    <ProgramHistory
                      key={`${value.id}:${attempt}`}
                      scope={scope}
                      classId={value.id}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex min-h-48 min-w-0 flex-col items-start justify-center gap-3 rounded-xl border border-dashed p-6">
                <GraduationCap className="size-7 text-muted-foreground" aria-hidden="true" />
                <h3 className="font-medium">{t("chooseClass")}</h3>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {t("chooseClassHint")}
                </p>
              </div>
            )}
          </div>
          {opened && (
            <ProgramEditorPanel
              key={`${scopeKey}:${opened}:${opened === "createClass" || opened === "session" ? "new" : value?.id}`}
              mode={opened}
              scope={scope}
              selected={value ?? undefined}
              classes={current.classes.map((c) => classValues(c)!)}
              catalog={current.catalog}
              timeZone={timeZone}
              onSaved={saved}
              onClose={() => setEditor(null)}
              onRestoreFocus={restoreFocus}
            />
          )}
        </>
      )}
    </section>
  );
}
