"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView, PersonView } from "@ftksaas/api-contracts";
import { ArrowUpRight, Search, Users, X } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { errorMessageKey } from "../../lib/api";
import {
  readCreatedPeople,
  saveCreatedPeople,
  studentActions,
  studentState,
  type StudentActions,
  type StudentScope,
} from "../../lib/students";
import { StudentChange } from "./student-change";
import { PersonEdit } from "./person-edit";
import { PersonCreate } from "./person-create";
import { PersonInvitation } from "./person-invitation";
import { PersonMerge } from "./person-merge";
import {
  mergeActions,
  type MergeActions,
  disciplineActions,
  type DisciplineActions,
} from "../../lib/student-management";
import { PersonDisciplines } from "./person-disciplines";

const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function StudentsWorkspace({
  studios,
  actorId,
}: {
  studios: { organization: OrganizationView; centers: CenterView[] }[];
  actorId: string;
}) {
  const t = useTranslations("students");
  const scopes = studios
    .filter(({ organization }) => ["normal", "grace"].includes(organization.access_mode))
    .flatMap(({ organization, centers }) =>
      centers
        .filter((center) => center.accessible && center.state === "active")
        .map((center) => ({ organization, center })),
    );
  const [selected, setSelected] = useState("");
  const scope = scopes.find(({ center }) => center.id === selected) ?? scopes[0];
  if (!scope)
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6">
        <Users aria-hidden="true" className="size-6 text-muted-foreground" />
        <h2 className="font-semibold">{t("noCenter")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("noCenterHint")}</p>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {scopes.length > 1 ? (
          scopes.map(({ organization, center }) => (
            <Button
              key={center.id}
              className={buttonClass}
              variant={scope.center.id === center.id ? "secondary" : "outline"}
              aria-pressed={scope.center.id === center.id}
              onClick={() => setSelected(center.id)}
            >
              {organization.name} / {center.name}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {scope.organization.name} / {scope.center.name}
          </p>
        )}
      </div>
      <StudentDirectory
        key={`${actorId}:${scope.organization.id}:${scope.center.id}`}
        scope={{ actorId, orgId: scope.organization.id, centerId: scope.center.id }}
        centerName={scope.center.name}
        actions={studentActions}
        disciplines={disciplineActions}
        merging={mergeActions}
      />
    </div>
  );
}

function CreatedStudentRows({
  ids,
  scope,
  actions,
  onOpen,
}: {
  ids: string[];
  scope: StudentScope;
  actions: StudentActions;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("students");
  const [people, setPeople] = useState<{ id: string; name?: string; error?: string }[]>(
    ids.map((id) => ({ id })),
  );
  useEffect(() => {
    let active = true;
    Promise.all(
      ids.map(async (id) => {
        try {
          const person = await actions.person(scope.orgId, scope.centerId, id);
          return { id, name: person.display_name };
        } catch (error) {
          return { id, error: errorMessageKey(error) };
        }
      }),
    ).then((result) => {
      if (active) setPeople(result);
    });
    return () => {
      active = false;
    };
  }, [actions, ids, scope.orgId, scope.centerId]);
  return (
    <section className="space-y-3 rounded-xl border p-5" aria-labelledby="created-students-title">
      <h2 id="created-students-title" className="font-semibold">
        {t("awaitingActivation")}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">{t("awaitingActivationHint")}</p>
      <ul className="divide-y rounded-lg border">
        {people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => onOpen(person.id)}
            >
              <span className="font-medium">
                {person.name ?? (person.error ? t("createdPersonUnavailable") : t("loadingDetail"))}
              </span>
              <Badge variant="outline">{t("states.none")}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The public design route injects fictional actions; the live wrapper always uses the backend.
export function StudentDirectory({
  scope,
  centerName,
  actions,
  disciplines,
  merging,
}: {
  scope: StudentScope;
  centerName: string;
  actions: StudentActions;
  disciplines?: DisciplineActions;
  merging?: MergeActions;
}) {
  const t = useTranslations("students");
  const api = useTranslations("api");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<{ id: string } | null>(null);
  const [createdIds, setCreatedIds] = useState(() => readCreatedPeople(scope));
  const opener = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<{
    key: string;
    data?: Awaited<ReturnType<StudentActions["list"]>>;
    error?: string;
  } | null>(null);
  const cursor = cursors.at(-1);
  const key = JSON.stringify([scope.actorId, scope.orgId, scope.centerId, query, cursor, attempt]);
  useEffect(() => {
    let active = true;
    actions
      .list({ orgId: scope.orgId, centerId: scope.centerId, query, cursor })
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((error: unknown) => {
        if (active) setResult({ key, error: errorMessageKey(error) });
      });
    return () => {
      active = false;
    };
  }, [actions, scope.orgId, scope.centerId, query, cursor, key]);
  const current = result?.key === key ? result : null;
  function refresh() {
    setCursors([undefined]);
    setAttempt((value) => value + 1);
  }
  function onCreated(personId: string) {
    try {
      const next = [...new Set([...createdIds, personId])];
      saveCreatedPeople(scope, next);
      setCreatedIds(next);
      setSelected({ id: personId });
      return true;
    } catch {
      return false;
    }
  }
  function onActivated(personId: string) {
    if (!createdIds.includes(personId)) return;
    const next = createdIds.filter((id) => id !== personId);
    try {
      saveCreatedPeople(scope, next);
    } catch {
      /* The profile can still be refreshed from the backend next time. */
    }
    setCreatedIds(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    refresh();
  }
  return (
    <section className="min-w-0 space-y-5 wrap-anywhere" aria-label={t("directory")}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 space-y-2 sm:flex-1">
          <Label htmlFor="student-search">{t("search")}</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            />
            <Input
              id="student-search"
              ref={searchInput}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 min-w-0 pl-10"
              placeholder={t("searchPlaceholder")}
            />
          </div>
        </div>
        <Button type="submit" className={buttonClass}>
          {t("searchButton")}
        </Button>
        <Button type="button" variant="outline" className={buttonClass} onClick={refresh}>
          {t("refresh")}
        </Button>
      </form>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("listHint")}</p>
        <PersonCreate scope={scope} actions={actions} onCreated={onCreated} />
      </div>
      {createdIds.length > 0 && (
        <CreatedStudentRows
          ids={createdIds}
          scope={scope}
          actions={actions}
          onOpen={(id) => setSelected({ id })}
        />
      )}
      {query && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p>{t("searching", { query })}</p>
          <Button
            variant="ghost"
            className={buttonClass}
            onClick={() => {
              setSearch("");
              setQuery("");
              refresh();
            }}
          >
            {t("clear")}
          </Button>
        </div>
      )}
      {!current && (
        <output className="block rounded-xl border p-6 text-sm" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {current?.error && (
        <div className="space-y-3 rounded-xl border p-6">
          <p role="alert" className="text-sm leading-6">
            {api(current.error)}
          </p>
          <Button
            variant="outline"
            className={buttonClass}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {current?.data && (
        <>
          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">{t("directory")}</h2>
              <output className="mt-1 block text-sm text-muted-foreground" aria-live="polite">
                {t("pageCount", { page: cursors.length, count: current.data.items.length })}
              </output>
            </div>
            {current.data.items.length ? (
              <ul className="divide-y">
                {current.data.items.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      ref={(node) => {
                        if (node && selected?.id === person.id) opener.current = node;
                      }}
                      className="flex min-h-24 w-full flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        setSelected({ id: person.id });
                      }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="font-medium">{person.display_name}</span>
                        <span className="text-xs text-muted-foreground">{t("openDetail")}</span>
                      </span>
                      <Badge variant="outline" className="max-w-full whitespace-normal">
                        {t(`states.${studentState(person, scope.centerId)}`)}
                      </Badge>
                      <ArrowUpRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2 px-5 py-10">
                <h3 className="font-medium">{t(query ? "noResults" : "empty")}</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t(query ? "noResultsHint" : "emptyHint")}
                </p>
              </div>
            )}
          </div>
        </>
      )}
      <nav aria-label={t("pagination")} className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className={buttonClass}
          disabled={cursors.length === 1}
          onClick={() => setCursors((values) => values.slice(0, -1))}
        >
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          className={buttonClass}
          disabled={!current?.data?.next_cursor}
          onClick={() => {
            const next = current?.data?.next_cursor;
            if (next) setCursors((values) => [...values, next]);
          }}
        >
          {t("next")}
        </Button>
      </nav>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent
            showCloseButton={false}
            className="w-full min-w-0 overflow-y-auto sm:max-w-lg wrap-anywhere"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener.current?.isConnected) opener.current.focus();
              else searchInput.current?.focus();
            }}
          >
            <SheetHeader className="pr-16">
              <SheetTitle>{t("detailTitle")}</SheetTitle>
              <SheetDescription>{centerName}</SheetDescription>
            </SheetHeader>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 min-h-11 min-w-11"
                aria-label={t("close")}
              >
                <X />
              </Button>
            </SheetClose>
            <StudentDetail
              key={selected.id}
              scope={scope}
              personId={selected.id}
              centerName={centerName}
              actions={actions}
              disciplines={disciplines}
              merging={merging}
              onMerged={(id) => {
                refresh();
                setSelected({ id });
              }}
              onSaved={refresh}
              onActivated={onActivated}
            />
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}

function StudentDetail({
  scope,
  personId,
  centerName,
  actions,
  onSaved,
  onActivated,
  disciplines,
  merging,
  onMerged,
}: {
  scope: StudentScope;
  personId: string;
  centerName: string;
  actions: StudentActions;
  onSaved: () => void;
  onActivated: (personId: string) => void;
  onMerged: (id: string) => void;
  disciplines?: DisciplineActions;
  merging?: MergeActions;
}) {
  const t = useTranslations("students");
  const api = useTranslations("api");
  const [attempt, setAttempt] = useState(0);
  const [changeRevision, setChangeRevision] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    person?: PersonView;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    actions
      .person(scope.orgId, scope.centerId, personId)
      .then((person) => {
        if (active) setResult({ attempt, person });
      })
      .catch((error: unknown) => {
        if (active) setResult({ attempt, error: errorMessageKey(error) });
      });
    return () => {
      active = false;
    };
  }, [actions, scope.orgId, scope.centerId, personId, attempt]);
  const current = result?.attempt === attempt ? result : null;
  const person = current?.person;
  const relationships = person?.relationships.filter((item) => item.center_id === scope.centerId);
  function refreshPersonAndList() {
    setAttempt((value) => value + 1);
    onSaved();
  }
  return (
    <div className="min-w-0 space-y-6 px-5 pb-8">
      {!current && (
        <output className="block text-sm" aria-live="polite">
          {t("loadingDetail")}
        </output>
      )}
      {current?.error && (
        <div className="space-y-3">
          <p role="alert" className="text-sm leading-6">
            {api(current.error)}
          </p>
          <Button
            variant="outline"
            className={buttonClass}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {person && (
        <>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">{person.display_name}</h2>
            <Badge variant="outline" className="max-w-full whitespace-normal">
              {t(`states.${studentState(person, scope.centerId)}`)}
            </Badge>
          </div>
          <section className="space-y-3" aria-label={t("contacts")}>
            <h3 className="font-semibold">{t("contacts")}</h3>
            {person.contacts?.length ? (
              <dl className="divide-y rounded-xl border px-4">
                {person.contacts.map((contact, index) => (
                  <div key={index} className="space-y-1 py-4 text-sm">
                    <dt className="text-muted-foreground">{t(contact.kind)}</dt>
                    <dd>{contact.value}</dd>
                    <dd className="text-xs text-muted-foreground">
                      {t(contact.verified_at ? "verifiedContact" : "unverifiedContact")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {t(person.contacts ? "noContacts" : "contactsNotShared")}
              </p>
            )}
          </section>
          <section className="space-y-3" aria-label={t("centerRoles")}>
            <h3 className="font-semibold">{t("centerRoles")}</h3>
            {relationships?.length ? (
              <ul className="space-y-2 text-sm">
                {["student", "instructor", "staff", "candidate"].map((kind) => {
                  const matches = relationships.filter((item) => item.kind === kind);
                  return matches.length ? (
                    <li key={kind} className="flex flex-wrap justify-between gap-2">
                      <span>{t(`roles.${kind}`)}</span>
                      <span className="text-muted-foreground">
                        {t(
                          `states.${matches.some((item) => item.state === "active") ? "active" : "inactive"}`,
                        )}
                      </span>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noRelationships")}</p>
            )}
          </section>
          <section className="space-y-3 border-t pt-6" aria-label={t("documents")}>
            <h3 className="font-semibold">{t("documents")}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{t("documentStatusHint")}</p>
          </section>
        </>
      )}
      <PersonEdit
        key={`${personId}:${person?.version ?? "loading"}`}
        scope={scope}
        personId={personId}
        person={person}
        actions={actions}
        onSaved={refreshPersonAndList}
      />
      {person && disciplines && (
        <PersonDisciplines
          scope={scope}
          person={person}
          actions={disciplines}
          onSaved={refreshPersonAndList}
        />
      )}
      {person && merging && (
        <PersonMerge scope={scope} person={person} actions={merging} onMerged={onMerged} />
      )}
      {person && <PersonInvitation scope={scope} person={person} actions={actions} />}
      <StudentChange
        key={changeRevision}
        scope={scope}
        personId={personId}
        person={person}
        centerName={centerName}
        actions={actions}
        onSaved={() => {
          setAttempt((value) => value + 1);
          setChangeRevision((value) => value + 1);
          onSaved();
          onActivated(personId);
        }}
      />
    </div>
  );
}
