"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReservationView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { listSessionDocumentContexts } from "../../lib/document-requirements";
import type { SetupScope } from "../../lib/studio-setup";
import { ContextDocuments } from "./context-documents";
import { SelfDocuments } from "./self-documents";
export function SessionDocuments({ scope, sessionId }: { scope: SetupScope; sessionId: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const selfId = useId();
  const id = useId();
  return (
    <section aria-label={t("sessionDocuments")} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{t("sessionDocuments")}</h2>
      <p className="text-sm text-muted-foreground">{t("sessionDocumentsHint")}</p>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "hideContexts" : "showContexts")}
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 max-w-full whitespace-normal"
        aria-expanded={selfOpen}
        aria-controls={selfId}
        onClick={() => setSelfOpen((value) => !value)}
      >
        {t(selfOpen ? "hideSelfDocuments" : "showSelfDocuments")}
      </Button>
      {selfOpen && (
        <div id={selfId}>
          <SelfSessionDocuments
            key={JSON.stringify([scope, sessionId])}
            scope={scope}
            sessionId={sessionId}
          />
        </div>
      )}
      {open && (
        <div id={id}>
          <SessionDocumentContexts
            key={JSON.stringify([scope, sessionId])}
            scope={scope}
            sessionId={sessionId}
          />
        </div>
      )}
    </section>
  );
}
function SessionDocumentContexts({ scope, sessionId }: { scope: SetupScope; sessionId: string }) {
  const t = useTranslations("documents");
  const [page, setPage] = useState<Awaited<ReturnType<typeof listSessionDocumentContexts>> | null>(
      null,
    ),
    [error, setError] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<ReservationView | null>(null);
  const source = useRef<HTMLButtonElement | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void listSessionDocumentContexts(scope, sessionId, cursor)
      .then((result) => {
        if (result.items.some((item) => item.session_id !== sessionId))
          throw Error("mismatchedContext");
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, sessionId, cursor, retry]);
  return (
    <div className="space-y-4">
      <h3 ref={heading} tabIndex={-1} className="font-medium outline-none">
        {t("contextListTitle")}
      </h3>
      {error ? (
        <p role="alert">{t("contextsError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {!page.items.length ? (
            <p className="text-sm">{t("noContexts")}</p>
          ) : (
            <ul className="divide-y">
              {page.items.map((row, index) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <p className="text-sm">
                    {row.subscriber_number
                      ? t("subscriberContext", { number: row.subscriber_number })
                      : t("reservationContext", { index: index + 1 })}
                  </p>
                  <Button
                    className="h-auto min-h-11 max-w-full whitespace-normal"
                    variant="outline"
                    onClick={(event) => {
                      source.current = event.currentTarget;
                      setSelected(row);
                    }}
                  >
                    {t("showRequirements")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {page.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => {
                setPage(null);
                setError(false);
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => {
          setSelected(null);
          setPage(null);
          setError(false);
          setCursor(undefined);
          setRetry((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (source.current?.isConnected ? source.current : heading.current)?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("requirementsTitle")}</SheetTitle>
            <SheetDescription>{t("readOnlyDocuments")}</SheetDescription>
          </SheetHeader>
          <div className="min-w-0 p-4">
            {selected && (
              <ReservationDocuments key={selected.id} scope={scope} reservation={selected} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
function ReservationDocuments({
  scope,
  reservation,
}: {
  scope: SetupScope;
  reservation: ReservationView;
}) {
  const t = useTranslations("documents"),
    id = useId();
  const [gate, setGate] = useState<"reservation" | "attendance">("reservation");
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={id}>{t("documentGate")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={gate}
          onChange={(event) =>
            setGate(event.target.value === "attendance" ? "attendance" : "reservation")
          }
        >
          <option value="reservation">{t("gates.reservation")}</option>
          <option value="attendance">{t("gates.attendance")}</option>
        </select>
      </div>
      <ContextDocuments
        actorId={scope.actorId}
        query={{
          org_id: scope.orgId,
          ...(scope.centerId ? { center_id: scope.centerId } : {}),
          person_id: reservation.person_id,
          context: { gate, subject: { type: "reservations", id: reservation.id } },
        }}
      />
    </div>
  );
}

function SelfSessionDocuments({ scope, sessionId }: { scope: SetupScope; sessionId: string }) {
  const t = useTranslations("documents"),
    id = useId();
  const [gate, setGate] = useState<"reservation" | "attendance">("reservation");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id}>{t("documentGate")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={gate}
          onChange={(event) =>
            setGate(event.target.value === "attendance" ? "attendance" : "reservation")
          }
        >
          <option value="reservation">{t("gates.reservation")}</option>
          <option value="attendance">{t("gates.attendance")}</option>
        </select>
      </div>
      <SelfDocuments
        scope={scope}
        context={{ gate, subject: { type: "sessions", id: sessionId } }}
      />
    </div>
  );
}
