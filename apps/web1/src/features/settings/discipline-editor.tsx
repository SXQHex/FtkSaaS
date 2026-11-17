import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "../../components/ui/button";
import { DisciplineSheet, type DisciplineDraft } from "./discipline-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { readDisciplineBase, type DisciplineBase, type DisciplineLevel } from "./discipline-reader";
import { disciplineDraft, disciplineIntent, type DisciplineIntent } from "./discipline-command";
import { useDisciplineCommand } from "./use-discipline-command";

export function DisciplineEditor({
  scope,
  level,
  id,
  scopeLabel,
  onClose,
  onRefresh,
  onLockChange,
  onAccessLost,
  canWrite,
}: {
  scope: ClientScope;
  level: DisciplineLevel;
  id?: string;
  scopeLabel: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const [base, setBase] = useState<DisciplineBase>(),
    [draft, setDraft] = useState(() => disciplineDraft());
  const [loaded, setLoaded] = useState(!id && level === "organization"),
    [reading, setReading] = useState(Boolean(id));
  const [error, setError] = useState<string>(),
    [accepted, setAccepted] = useState(false);
  const [review, setReview] = useState<{
    base?: DisciplineBase;
    draft: DisciplineDraft;
    intent?: DisciplineIntent;
  }>();
  const mounted = useRef(true),
    readingRef = useRef(false);
  const { accountId, orgId, centerId } = scope;
  const command = useDisciplineCommand({
    onAccessLost,
    onRefresh: async (result) => {
      await onRefresh();
      if (!mounted.current) return;
      setBase(result);
      setDraft(disciplineDraft(result));
      setReview(undefined);
      setLoaded(true);
    },
  });
  const locked = command.locked || reading;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function handleSourceFailure(failure: unknown) {
    if (!onAccessLost(failure)) setError(t(($) => $.settings.disciplineStatus.readError));
  }
  const sourceFailure = useEffectEvent(handleSourceFailure);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (id) {
      void readDisciplineBase({ accountId, orgId, centerId }, level, id)
        .then((value) => {
          if (!active) return;
          setBase(value);
          setDraft(disciplineDraft(value));
          setLoaded(true);
        })
        .catch((failure) => {
          if (active) sourceFailure(failure);
        })
        .finally(() => {
          if (active) setReading(false);
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [accountId, orgId, centerId, level, id]);
  async function reload() {
    if (readingRef.current || command.locked) return;
    readingRef.current = true;
    setReading(true);
    setError(undefined);
    setReview(undefined);
    try {
      const currentId = base?.discipline.id ?? id;
      const next = currentId ? await readDisciplineBase(scope, level, currentId) : undefined;
      await onRefresh();
      if (!mounted.current) return;
      setBase(next);
      setDraft(disciplineDraft(next));
      setLoaded(true);
      command.reset();
    } catch (failure) {
      if (mounted.current) handleSourceFailure(failure);
    } finally {
      readingRef.current = false;
      if (mounted.current) setReading(false);
    }
  }
  async function prepare() {
    if (readingRef.current || command.locked || !loaded || !canWrite) return;
    readingRef.current = true;
    setReading(true);
    setError(undefined);
    try {
      const deactivating =
        base?.version !== null &&
        base !== undefined &&
        disciplineDraft(base).state === "active" &&
        draft.state === "inactive";
      const currentId = base?.discipline.id ?? id;
      const fresh = currentId
        ? await readDisciplineBase(scope, level, currentId, deactivating)
        : undefined;
      if (
        base &&
        (fresh?.version !== base.version ||
          fresh?.entityId !== base.entityId ||
          fresh?.discipline.version !== base.discipline.version)
      )
        throw new Error("DISCIPLINE_SOURCE_CHANGED");
      // Freeze one command for review; only explicit Apply can send it.
      const intent = fresh?.effects?.blocking
        ? undefined
        : disciplineIntent(scope, level, draft, fresh);
      if (!mounted.current) return;
      command.reset();
      setAccepted(false);
      setReview({ ...(fresh ? { base: fresh } : {}), draft: structuredClone(draft), intent });
    } catch (failure) {
      if (!mounted.current || onAccessLost(failure)) return;
      setError(
        failure instanceof Error && failure.message === "DISCIPLINE_NO_CHANGES"
          ? t(($) => $.settings.disciplineStatus.noChanges)
          : failure instanceof Error && failure.message === "DISCIPLINE_SOURCE_CHANGED"
            ? t(($) => $.settings.disciplineStatus.stale)
            : failure instanceof Error && failure.message === "DISCIPLINE_OPEN_OPERATIONS"
              ? t(($) => $.settings.disciplineStatus.openOperations)
              : t(($) => $.settings.disciplineStatus.prepareError),
      );
    } finally {
      readingRef.current = false;
      if (mounted.current) setReading(false);
    }
  }
  const commandState = command.state;
  const notice = reading
    ? t(($) => $.settings.disciplineStatus.reading)
    : commandState === "ready"
      ? undefined
      : t(($) => $.settings.disciplineStatus[commandState]);
  const recovery = (
    <div className="flex flex-wrap gap-2">
      {command.state === "unknown" && (
        <Button
          variant="outline"
          type="button"
          isDisabled={command.busy || !canWrite}
          onPress={() => {
            void command.retry();
          }}
        >
          {t(($) => $.settings.disciplineStatus.retrySame)}
        </Button>
      )}
      {["unknown", "pending", "saved-unread"].includes(command.state) && (
        <Button
          variant="outline"
          type="button"
          isDisabled={command.busy}
          onPress={() => {
            void command.readReceipt();
          }}
        >
          {t(($) => $.settings.disciplineStatus.readResult)}
        </Button>
      )}
      {!command.locked && (error || ["stale", "rejected"].includes(command.state)) && (
        <Button
          variant="outline"
          type="button"
          isDisabled={reading}
          onPress={() => {
            void reload();
          }}
        >
          {t(($) => $.settings.disciplineStatus.reload)}
        </Button>
      )}
    </div>
  );
  const effects = review?.base?.effects;
  const labels: Record<keyof DisciplineDraft, string> = {
    name: t(($) => $.settings.disciplineEditor.name),
    state: t(($) => $.settings.disciplineStatus.state),
    description: t(($) => $.settings.disciplineEditor.descriptionField),
    publicVisible: t(($) => $.settings.disciplineEditor.publicVisible),
    color: t(($) => $.settings.disciplineEditor.color),
    icon: t(($) => $.settings.disciplineEditor.icon),
    displayOrder: t(($) => $.settings.disciplineEditor.order),
    allowCenterDescription: t(($) => $.settings.disciplineEditor.allowLocal),
  };
  const display = (value: DisciplineDraft[keyof DisciplineDraft], key: keyof DisciplineDraft) =>
    typeof value === "boolean"
      ? value
        ? t(($) => $.settings.on)
        : t(($) => $.settings.off)
      : value === null
        ? key === "description" && level === "center"
          ? t(($) => $.settings.disciplineStatus.inheritedDescription)
          : t(($) => $.settings.disciplineStatus.noValue)
        : key === "state"
          ? value === "active"
            ? t(($) => $.settings.on)
            : t(($) => $.settings.off)
          : value;
  const before = disciplineDraft(review?.base);
  const rows = review
    ? [
        {
          id: "scope",
          title: scopeLabel,
          detail: review.base?.version
            ? review.draft.name
            : t(($) => $.settings.disciplineEditor.newRecord),
        },
        ...(review.base?.version == null
          ? [{ id: "new-state", title: labels.state, detail: display(review.draft.state, "state") }]
          : []),
        ...(Object.keys(labels) as (keyof DisciplineDraft)[])
          .filter(
            (key) =>
              before[key] !== review.draft[key] &&
              (key !== "state" || review.base?.version != null),
          )
          .map((key) => ({
            id: key,
            title: labels[key],
            detail: `${display(before[key], key)} → ${display(review.draft[key], key)}`,
          })),
        ...(effects
          ? Object.entries(effects.counts).map(([key, count]) => ({
              id: key,
              title: t(($) => $.settings.disciplineEffects[key as keyof typeof effects.counts]),
              detail: String(count),
            }))
          : []),
      ]
    : null;
  return (
    <>
      <DisciplineSheet
        open
        scope={level}
        scopeLabel={scopeLabel}
        version={base?.version ?? null}
        draft={draft}
        loaded={loaded}
        writable={canWrite && !command.unavailable}
        descriptionWritable={
          level === "organization" ||
          base?.discipline.presentation.organization.allow_center_description === true
        }
        locked={locked || Boolean(review)}
        notice={notice}
        error={error}
        onDraft={(next) => {
          setError(undefined);
          setDraft(next);
        }}
        onSubmit={() => {
          void prepare();
        }}
        onClose={onClose}
        recoveryActions={!review ? recovery : undefined}
      />
      <SettingsReviewDialog
        open={Boolean(review)}
        title={t(($) => $.settings.disciplineStatus.reviewTitle)}
        description={
          effects?.truncated
            ? t(($) => $.settings.disciplineStatus.truncated)
            : t(($) => $.settings.disciplineStatus.reviewDescription)
        }
        rows={rows}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={command.locked || reading}
        blockers={
          effects?.blocking
            ? [
                {
                  id: "open-operations",
                  text: t(($) => $.settings.disciplineStatus.openOperations),
                },
              ]
            : []
        }
        onClose={() => {
          if (!command.locked) setReview(undefined);
        }}
        notice={notice}
        recoveryActions={recovery}
        onApply={
          canWrite && review?.intent && accepted && !effects?.blocking && command.state === "ready"
            ? () => {
                if (review.intent) void command.start(review.intent);
              }
            : undefined
        }
      />
    </>
  );
}
