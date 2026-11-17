import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { SettingsReviewDialog } from "./settings-review-dialog";
import {
  readSettingsDocument,
  settingsDocumentIntent,
  writeSettingsDocument,
  readSettingsDocumentReceipt,
  readSettingsDocumentResult,
  type SettingsDocumentPatch,
  type SettingsLevel,
  type SettingsDocumentSource,
} from "./settings-document";
import type { SettingsViewData } from "./settings-view";
import type { SettingsFieldKey, SettingsCardKey } from "./settings-layout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
const fields = {
  "ay-tel": "contact_phone",
  "ay-posta": "contact_email",
  "ay-adres": "address",
} as const;
const colors = {
  primaryColor: "primary_color",
  secondaryColor: "secondary_color",
  accentColor: "accent_color",
} as const;
type Draft = Partial<Record<keyof SettingsDocumentPatch, string | null>>;
export function useSettingsDocument({
  scope,
  level,
  enabled,
  readOnly,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  level: SettingsLevel;
  enabled: boolean;
  readOnly: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const [drafts, setDrafts] = useState<Record<SettingsLevel, Draft>>({
      organization: {},
      center: {},
    }),
    [review, setReview] = useState<{
      source: SettingsDocumentSource;
      patch: SettingsDocumentPatch;
      card: SettingsCardKey;
    }>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const draft = drafts[level];
  const setDraft = (next: Draft | ((before: Draft) => Draft)) =>
    setDrafts((previous) => ({
      ...previous,
      [level]: typeof next === "function" ? next(previous[level]) : next,
    }));
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const key = ["settings-document", scope.accountId, scope.orgId, scope.centerId, level];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readSettingsDocument(scope, level),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const command = useMemberCommand({
    write: writeSettingsDocument,
    readReceipt: readSettingsDocumentReceipt,
    readResult: readSettingsDocumentResult,
    onAccessLost,
    onRefresh: async (result) => {
      queries.setQueryData(key, result);
      setDraft((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([field]) => !review || !Object.prototype.hasOwnProperty.call(review.patch, field),
          ),
        ),
      );
      await queries.invalidateQueries(
        { queryKey: ["workspace", scope.accountId, scope.orgId] },
        { throwOnError: true },
      );
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const source =
    !command.unavailable && !query.isError && !query.isFetching ? query.data : undefined;
  const writable = (field: string) =>
    !readOnly &&
    !!source &&
    Object.prototype.hasOwnProperty.call(source.document.values, field) &&
    source.catalog.fields.some((row) => row.key === field && row.writable) === true;
  const values = source?.document.values;
  function current(field: keyof SettingsDocumentPatch): string | null | undefined {
    if (!source) return undefined;
    if (Object.prototype.hasOwnProperty.call(draft, field)) return draft[field];
    const value = values && Reflect.get(values, field);
    return typeof value === "string" || value === null ? value : undefined;
  }
  const fieldData: NonNullable<SettingsViewData["fields"]> = {};
  for (const [presentation, wire] of Object.entries(fields) as [
    keyof typeof fields,
    (typeof fields)[keyof typeof fields],
  ][]) {
    const value = current(wire);
    if (value !== undefined) fieldData[presentation] = { value, writable: writable(wire) };
  }
  const data: SettingsViewData = {
    fields: fieldData,
    forms: {
      "ay-genel": {
        dirty: Object.keys(draft).some((key) =>
          Object.values(fields).some((field) => field === key),
        ),
        pending: locked,
        read: !!source,
        writable: Object.values(fields).some(writable),
      },
      "ay-marka": {
        dirty: Object.keys(draft).some((key) =>
          Object.values(colors).some((field) => field === key),
        ),
        pending: locked,
        read: !!source && level === "organization",
        writable: level === "organization" && Object.values(colors).some(writable),
      },
    },
    brand:
      level === "organization" &&
      source &&
      Object.values(colors).every((key) => current(key) !== undefined)
        ? {
            name: t(($) => $.settings.unknown),
            colors: (
              Object.entries(colors) as [
                keyof typeof colors,
                (typeof colors)[keyof typeof colors],
              ][]
            ).map(([key, wire]) => ({
              key,
              value: current(wire) ?? null,
              writable: writable(wire),
            })),
          }
        : undefined,
  };
  function onField(presentation: SettingsFieldKey, value: string | boolean) {
    if (locked || review || typeof value !== "string" || !(presentation in fields)) return;
    const wire = fields[presentation as keyof typeof fields];
    if (writable(wire))
      setDraft((previous) => ({
        ...previous,
        [wire]: wire === "contact_email" && value === "" ? null : value,
      }));
  }
  function onColor(presentation: keyof typeof colors, value: string) {
    const wire = colors[presentation];
    if (!locked && !review && level === "organization" && writable(wire))
      setDraft((previous) => ({ ...previous, [wire]: value === "" ? null : value }));
  }
  function onDiscard(card: SettingsCardKey) {
    if (locked || review) return;
    const keys =
      card === "ay-genel"
        ? Object.values(fields)
        : card === "ay-marka"
          ? Object.values(colors)
          : [];
    setDraft((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => !keys.some((field) => field === key)),
      ),
    );
    setError(undefined);
  }
  function onSave(card: SettingsCardKey) {
    if (locked || review || !source) return;
    const keys =
      card === "ay-genel"
        ? Object.values(fields)
        : card === "ay-marka"
          ? Object.values(colors)
          : [];
    const patch = Object.fromEntries(
      Object.entries(draft).filter(
        ([field, value]) =>
          keys.some((key) => key === field) && value !== Reflect.get(source.document.values, field),
      ),
    );
    if (!Object.keys(patch).length) {
      onDiscard(card);
      return;
    }
    command.reset();
    setAccepted(false);
    setError(undefined);
    setReview({ source, patch, card });
  }
  async function confirm() {
    if (!review || !accepted || busy.current || locked || command.state !== "ready") return;
    busy.current = true;
    setPreparing(true);
    try {
      const intent = await settingsDocumentIntent(scope, level, review.source, review.patch);
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.settings.documentInvalid),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  const notice: ReactNode =
    command.unavailable || query.isError || error ? (
      <Alert variant="destructive">
        <AlertDescription>
          {error ?? t(($) => $.settings.documentReadError)}{" "}
          <Button
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              if (command.unavailable) {
                window.location.reload();
                return;
              }
              setError(undefined);
              void query.refetch();
            }}
          >
            {t(($) => $.auth.retry)}
          </Button>
        </AlertDescription>
      </Alert>
    ) : null;
  const dialog = review && !command.unavailable && (
    <SettingsReviewDialog
      open
      title={t(($) => $.settings.cards[review.card].title)}
      description={t(($) => $.settings.documentReviewHint)}
      rows={Object.entries(review.patch).map(([wire, value]) => {
        const presentation = Object.entries(fields).find(([, key]) => key === wire)?.[0] as
          | keyof typeof fields
          | undefined;
        const color = Object.entries(colors).find(([, key]) => key === wire)?.[0] as
          | keyof typeof colors
          | undefined;
        const label = presentation
          ? t(($) => $.settings.fields[presentation])
          : color
            ? t(($) => $.settings[color])
            : t(($) => $.settings.unknown);
        return {
          id: wire,
          title: label,
          detail: `${Reflect.get(review.source.document.values, wire) ?? t(($) => $.settings.unsetHint)} → ${value ?? t(($) => $.settings.unsetHint)}`,
        };
      })}
      accepted={accepted}
      onAccepted={setAccepted}
      locked={locked}
      blockers={error ? [{ id: "error", text: error }] : []}
      recoveryActions={
        <EventCommandNotice
          command={command}
          onReload={() => {
            if (!locked) {
              setReview(undefined);
              command.reset();
              void query.refetch();
            }
          }}
        />
      }
      onClose={() => {
        if (!locked) {
          setReview(undefined);
          setError(undefined);
          command.reset();
        }
      }}
      onApply={
        command.state === "ready"
          ? () => {
              void confirm();
            }
          : undefined
      }
    />
  );
  return { data, onField, onColor, onDiscard, onSave, notice, dialog, locked };
}
