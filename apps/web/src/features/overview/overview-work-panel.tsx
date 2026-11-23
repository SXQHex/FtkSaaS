import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import type { ManagementWorkView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { ApplicationEditor } from "../leads/application-editor";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import {
  readOverviewWorkSource,
  overviewFollowupIntent,
  writeOverviewFollowup,
  readOverviewFollowupReceipt,
  readOverviewFollowupResult,
} from "./overview-work";

export function OverviewWorkPanel({
  scope,
  task,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  task: ManagementWorkView;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(""),
    [review, setReview] = useState(false),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const query = useQuery({
    queryKey: [
      "overview-work-source",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      task.kind,
      task.id,
      task.version,
    ],
    queryFn: (context) => readOverviewWorkSource(scope, task, context),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const command = useMemberCommand({
    write: writeOverviewFollowup,
    readReceipt: readOverviewFollowupReceipt,
    readResult: readOverviewFollowupResult,
    onRefresh: async () => {
      await onSaved();
    },
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const source =
    !query.isError && !query.isFetching && query.isFetchedAfterMount && !command.unavailable
      ? query.data
      : undefined;
  async function apply() {
    if (
      source?.kind !== "followup" ||
      !accepted ||
      busy.current ||
      locked ||
      command.state !== "ready"
    )
      return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await overviewFollowupIntent(source, outcome);
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError && cause.code === "VERSION_CONFLICT"
            ? t(($) => $.overview.workChanged)
            : t(($) => $.overview.workReadError),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  if (source?.kind === "application")
    return (
      <ApplicationEditor
        scope={scope}
        id={task.id}
        canReview
        onClose={onClose}
        onSaved={onSaved}
        onLockChange={onLockChange}
      />
    );
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={t(($) => $.overview.workOutcome)}
        description={t(($) => $.overview.workOutcomeHint)}
        rows={
          source?.kind === "followup"
            ? [{ id: "source", title: source.task.title, detail: outcome.trim() }]
            : null
        }
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        blockers={error ? [{ id: "error", text: error }] : []}
        onClose={() => {
          if (!locked) {
            if (command.state === "ready") setReview(false);
            else onClose();
          }
        }}
        onApply={
          source?.kind === "followup" && command.state === "ready"
            ? () => {
                void apply();
              }
            : undefined
        }
        recoveryActions={
          <>
            {error && !locked && (
              <Button type="button" variant="outline" onPress={onClose}>
                {t(($) => $.overview.workReload)}
              </Button>
            )}
            <EventCommandNotice command={command} onReload={onClose} />
          </>
        }
      />
    );
  return (
    <Sheet
      isOpen
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.overview.workDetail)}</SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{t(($) => $.overview.workDetailHint)}</SheetDescription>
        </Text>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {query.isError || command.unavailable ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>
              {t(($) => $.overview.workReadError)}{" "}
              <Button variant="outline" onPress={onClose}>
                {t(($) => $.overview.workReload)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : !source ? (
          <p>{t(($) => $.overview.tasksUnread)}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="font-medium wrap-anywhere">{source.task.title}</p>
            {source.task.person_name && <p>{source.task.person_name}</p>}
            {source.kind === "flow" ? (
              <LinkButton variant="outline" href={source.href}>
                {t(($) => $.overview.workFlow)}
              </LinkButton>
            ) : (
              <>
                {source.values.note && (
                  <p className="whitespace-pre-wrap wrap-anywhere">{source.values.note}</p>
                )}
                <form
                  id="overview-followup-result"
                  method="post"
                  aria-label={t(($) => $.overview.workOutcome)}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!locked && outcome.trim()) {
                      setAccepted(false);
                      setReview(true);
                    }
                  }}
                >
                  <Field>
                    <FieldLabel htmlFor="overview-followup-outcome">
                      {t(($) => $.overview.workOutcome)}
                    </FieldLabel>
                    <Textarea
                      id="overview-followup-outcome"
                      name="outcome"
                      value={outcome}
                      required
                      readOnly={locked}
                      onChange={(event) => setOutcome(event.target.value)}
                    />
                  </Field>
                </form>
              </>
            )}
          </div>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        {source?.kind === "followup" && (
          <Button
            type="submit"
            form="overview-followup-result"
            isDisabled={locked || !outcome.trim()}
          >
            {t(($) => $.overview.workReview)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
