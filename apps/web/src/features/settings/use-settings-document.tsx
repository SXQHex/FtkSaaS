import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SettingsImageUpload, SettingsMediaAsset } from "@ftksaas/api-contracts";
import { preparePhoto, readPhoto, type PhotoDraft } from "../account/profile-photo";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { SettingsReviewDialog } from "./settings-review-dialog";
import {
  readSettingsDocument,
  parseSettingsDocumentPatch,
  settingsDocumentIntent,
  settingsResetIntent,
  type SettingsDocumentIntent,
  writeSettingsDocument,
  readSettingsDocumentReceipt,
  readSettingsDocumentResult,
  type SettingsDocumentPatch,
  type SettingsLevel,
  type SettingsDocumentSource,
  type PreparationFamily,
  type InheritedPreparationFamily,
} from "./settings-document";
import type { SettingsViewData } from "./settings-view";
import type { SettingsFieldKey, SettingsCardKey } from "./settings-layout";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
const generalFields = {
  "ay-tel": "contact_phone",
  "ay-posta": "contact_email",
  "ay-adres": "address",
  "ay-program-sure": "program_duration_minutes",
} as const;
const reminderFields = {
  "ay-h-ders": "lesson_reminders_enabled",
  "ay-h-ders-n": "lesson_reminder_hours",
  "ay-h-paket": "package_reminders_enabled",
  "ay-h-paket-n": "package_reminder_days",
  "ay-h-vade": "payment_reminders_enabled",
  "ay-h-vade-n": "payment_reminder_days",
} as const;
const reminderChoices = {
  lesson_reminder_hours: [1, 3, 24],
  package_reminder_days: [3, 7, 14],
  payment_reminder_days: [1, 3, 7],
} as const;
const billingFields = {
  "billing-name": "billing_name",
  "billing-address": "billing_address",
  "billing-email": "billing_email",
} as const;
const fields = { ...generalFields, ...reminderFields, ...billingFields };
const colors = {
  primaryColor: "primary_color",
  secondaryColor: "secondary_color",
  accentColor: "accent_color",
} as const;
const groups = {
  "ay-genel": Object.values(generalFields),
  "ay-marka": Object.values(colors),
  "ay-hat": Object.values(reminderFields),
  "plan-billing": Object.values(billingFields),
} as const;
type Draft = Partial<Record<keyof SettingsDocumentPatch, string | boolean | null>>;
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
      logo?: SettingsImageUpload | null;
      reset?: SettingsDocumentIntent;
      rows?: { id: string; title: string; detail: string }[];
      inherit?: InheritedPreparationFamily;
    }>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    [logoDraft, setLogoDraft] = useState<PhotoDraft>(),
    [logoError, setLogoError] = useState<string>(),
    [accessDenied, setAccessDenied] = useState(false);
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
  const loseAccess = useCallback(
    (cause: unknown) => {
      const lost = onAccessLost(cause);
      if (lost) setAccessDenied(true);
      return lost;
    },
    [onAccessLost],
  );
  const key = ["settings-document", scope.accountId, scope.orgId, scope.centerId, level];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await readSettingsDocument(scope, level);
      } catch (cause) {
        loseAccess(cause);
        throw cause;
      }
    },
    enabled: enabled && !accessDenied,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const command = useMemberCommand({
    write: writeSettingsDocument,
    readReceipt: readSettingsDocumentReceipt,
    readResult: readSettingsDocumentResult,
    onAccessLost: loseAccess,
    onRefresh: async (result) => {
      queries.setQueryData(key, result);
      setDraft((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([field]) => !review || !Object.prototype.hasOwnProperty.call(review.patch, field),
          ),
        ),
      );
      if (review?.logo !== undefined) setLogoDraft(undefined);
      if (review?.rows)
        await queries.invalidateQueries({
          queryKey: ["preparation-catalog", scope.accountId, scope.orgId],
          refetchType: "none",
        });
      await queries.invalidateQueries(
        { queryKey: ["settings-history", scope.accountId, scope.orgId] },
        { throwOnError: true },
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
    !accessDenied && !command.unavailable && !query.isError && !query.isFetching
      ? query.data
      : undefined;
  const writable = (field: string) =>
    !readOnly &&
    !!source &&
    Object.prototype.hasOwnProperty.call(source.document.values, field) &&
    source.catalog.fields.some((row) => row.key === field && row.writable) === true;
  const values = source?.document.values;
  const asset: SettingsMediaAsset | null | undefined =
    source?.document.scope === "organization" ? source.document.logo : undefined;
  const logoRead = useQuery({
    queryKey: ["settings-logo", scope.accountId, scope.orgId, asset?.id],
    queryFn: async () => {
      try {
        return await readPhoto(asset!, scope);
      } catch (cause) {
        loseAccess(cause);
        throw cause;
      }
    },
    enabled: !!asset && level === "organization" && !accessDenied,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const logoWritable = level === "organization" && writable("address");
  const logoBlob =
    logoDraft === undefined
      ? !logoRead.isError && !logoRead.isFetching
        ? logoRead.data
        : undefined
      : logoDraft?.file;

  function current(field: keyof SettingsDocumentPatch): string | boolean | null | undefined {
    if (!source) return undefined;
    if (Object.prototype.hasOwnProperty.call(draft, field)) return draft[field];
    const value = values && Reflect.get(values, field);
    return typeof value === "number"
      ? String(value)
      : typeof value === "string" || typeof value === "boolean" || value === null
        ? value
        : undefined;
  }
  const fieldData: NonNullable<SettingsViewData["fields"]> = {};
  for (const [presentation, wire] of Object.entries(fields) as [
    keyof typeof fields,
    (typeof fields)[keyof typeof fields],
  ][]) {
    const value = current(wire);
    if (value !== undefined) {
      const choices =
        wire in reminderChoices ? reminderChoices[wire as keyof typeof reminderChoices] : undefined;
      fieldData[presentation] = {
        value,
        writable: writable(wire),
        ...(wire === "program_duration_minutes"
          ? { description: t(($) => $.settings.programDurationHint) }
          : {}),
        ...(choices
          ? {
              options: choices.map((count) => ({
                id: String(count),
                label:
                  wire === "lesson_reminder_hours"
                    ? t(($) => $.settings.reminderHours, { count })
                    : t(($) => $.settings.reminderDays, { count }),
              })),
            }
          : {}),
      };
    }
  }
  const data: SettingsViewData = {
    fields: fieldData,
    forms: {
      "ay-genel": {
        dirty: Object.keys(draft).some((key) =>
          Object.values(generalFields).some((field) => field === key),
        ),
        pending: locked,
        read: !!source,
        writable: Object.values(generalFields).some(writable),
      },
      "ay-hat": {
        dirty: Object.keys(draft).some((key) =>
          Object.values(reminderFields).some((field) => field === key),
        ),
        pending: locked,
        read: !!source,
        writable: Object.values(reminderFields).some(writable),
      },
      "plan-billing": {
        dirty: Object.values(billingFields).some((field) => Object.hasOwn(draft, field)),
        pending: locked,
        read:
          level === "organization" &&
          Object.values(billingFields).some((field) => current(field) !== undefined),
        writable: level === "organization" && Object.values(billingFields).some(writable),
      },
      "ay-marka": {
        dirty:
          logoDraft !== undefined ||
          Object.keys(draft).some((key) => Object.values(colors).some((field) => field === key)),
        pending: locked,
        read: !!source && level === "organization",
        writable:
          level === "organization" && (logoWritable || Object.values(colors).some(writable)),
      },
    },
    brand:
      level === "organization" &&
      source &&
      Object.values(colors).every((key) => current(key) !== undefined)
        ? {
            name: t(($) => $.settings.unknown),
            logo:
              logoDraft === null ? null : logoBlob || asset ? { blob: logoBlob, alt: "" } : null,
            logoError,
            colors: (
              Object.entries(colors) as [
                keyof typeof colors,
                (typeof colors)[keyof typeof colors],
              ][]
            ).map(([key, wire]) => ({
              key,
              value: typeof current(wire) === "string" ? (current(wire) as string) : null,
              writable: writable(wire),
            })),
          }
        : undefined,
  };
  function onField(presentation: SettingsFieldKey, value: string | boolean) {
    if (locked || review || !(presentation in fields)) return;
    const wire = fields[presentation as keyof typeof fields];
    if (wire.startsWith("billing_") && level !== "organization") return;
    if (wire.endsWith("_enabled") ? typeof value !== "boolean" : typeof value !== "string") return;
    if (writable(wire))
      setDraft((previous) => ({
        ...previous,
        [wire]:
          (wire === "contact_email" || wire === "billing_email") && value === "" ? null : value,
      }));
  }
  function onColor(presentation: keyof typeof colors, value: string) {
    const wire = colors[presentation];
    if (!locked && !review && level === "organization" && writable(wire))
      setDraft((previous) => ({ ...previous, [wire]: value === "" ? null : value }));
  }
  function onDiscard(card: SettingsCardKey) {
    if (locked || review) return;
    if (card === "ay-marka") {
      setLogoDraft(undefined);
      setLogoError(undefined);
    }
    const keys = card in groups ? groups[card as keyof typeof groups] : [];
    setDraft((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => !keys.some((field) => field === key)),
      ),
    );
    setError(undefined);
  }
  function onSave(card: SettingsCardKey) {
    if (locked || review || !source || (card === "ay-marka" && logoError)) return;
    if (card === "plan-billing" && level !== "organization") return;
    const keys = card in groups ? groups[card as keyof typeof groups] : [];
    let patch: SettingsDocumentPatch;
    try {
      patch = parseSettingsDocumentPatch(
        Object.fromEntries(
          Object.entries(draft)
            .filter(([field]) => keys.some((key) => key === field))
            .map(([field, value]) => [
              field,
              field in reminderChoices || field === "program_duration_minutes"
                ? Number(value)
                : value,
            ])
            .filter(
              ([field, value]) => value !== Reflect.get(source.document.values, field as string),
            ),
        ),
      );
    } catch {
      setError(t(($) => $.settings.documentInvalid));
      return;
    }
    const logo = card === "ay-marka" ? (logoDraft === null ? null : logoDraft?.upload) : undefined;
    if (!Object.keys(patch).length && logo === undefined) {
      onDiscard(card);
      return;
    }
    command.reset();
    setAccepted(false);
    setError(undefined);
    setReview({ source, patch, card, ...(logo !== undefined ? { logo } : {}) });
  }
  const resetCards = (Object.keys(groups) as (keyof typeof groups)[]).filter(
    (card) => card !== "plan-billing" && groups[card].some(writable),
  );
  async function onReset(card: SettingsCardKey) {
    if (busy.current || locked || review || !source || !(card in groups)) return;
    const keys = groups[card as keyof typeof groups].filter(writable);
    if (!keys.length) return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    command.reset();
    try {
      const intent = await settingsResetIntent(scope, level, source, keys);
      if (active.current) {
        setAccepted(false);
        setReview({ source, patch: intent.patch, card, reset: intent });
      }
    } catch (cause) {
      if (active.current && !loseAccess(cause))
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
  async function confirm() {
    if (!review || !accepted || busy.current || locked || command.state !== "ready") return;
    busy.current = true;
    setPreparing(true);
    try {
      const intent =
        review.reset ??
        (await settingsDocumentIntent(
          scope,
          level,
          review.source,
          review.patch,
          review.logo,
          review.inherit,
        ));
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !loseAccess(cause))
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
    accessDenied || command.unavailable || query.isError || error || logoRead.isError ? (
      <Alert variant="destructive">
        <AlertDescription>
          {error ?? t(($) => $.settings.documentReadError)}{" "}
          <Button
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              if (accessDenied || command.unavailable) {
                window.location.reload();
                return;
              }
              setError(undefined);
              void query.refetch();
              if (logoRead.isError) void logoRead.refetch();
            }}
          >
            {t(($) => $.auth.retry)}
          </Button>
        </AlertDescription>
      </Alert>
    ) : null;
  const reviewValue = (wire: string, value: unknown) => {
    if (value == null) return t(($) => $.settings.unsetHint);
    if (typeof value === "boolean")
      return value ? t(($) => $.settings.on) : t(($) => $.settings.off);
    if (typeof value === "number" && wire in reminderChoices)
      return wire === "lesson_reminder_hours"
        ? t(($) => $.settings.reminderHours, { count: value })
        : t(($) => $.settings.reminderDays, { count: value });
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : t(($) => $.settings.unknown);
  };
  const dialog = review && !accessDenied && !command.unavailable && (
    <SettingsReviewDialog
      open
      title={
        review.rows
          ? t(($) => $.settings.preparation.title)
          : t(($) => $.settings.cards[review.card].title)
      }
      description={
        review.reset
          ? t(($) => $.settings.resetReviewHint)
          : t(($) => $.settings.documentReviewHint)
      }
      rows={
        review.rows ?? [
          ...Object.entries(review.patch).map(([wire, value]) => {
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
              detail: `${reviewValue(wire, Reflect.get(review.source.document.values, wire))} → ${reviewValue(wire, value)}`,
            };
          }),
          ...(review.logo !== undefined
            ? [
                {
                  id: "logo",
                  title: t(($) => $.settings.logoLabel),
                  detail:
                    review.logo === null
                      ? t(($) => $.settings.logoRemoveReview)
                      : t(($) => $.settings.logoUploadReview),
                },
              ]
            : []),
        ]
      }
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
  async function selectLogo(file: File) {
    if (busy.current || locked || review || !logoWritable) return;
    busy.current = true;
    setPreparing(true);
    setLogoError(undefined);
    setError(undefined);
    try {
      const upload = await preparePhoto(file);
      if (active.current) setLogoDraft({ upload, file });
    } catch (cause) {
      if (active.current)
        setLogoError(
          cause instanceof Error && cause.message === "PHOTO_SIZE"
            ? t(($) => $.photo.sizeError)
            : cause instanceof Error && cause.message === "PHOTO_TYPE"
              ? t(($) => $.photo.typeError)
              : t(($) => $.photo.fileError),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  return {
    source,
    reviewPreparation: (
      patch: Pick<SettingsDocumentPatch, PreparationFamily>,
      rows: NonNullable<NonNullable<typeof review>["rows"]>,
      inherit?: InheritedPreparationFamily,
    ) => {
      if (locked || review || !source || readOnly) return;
      setAccepted(false);
      setError(undefined);
      command.reset();
      setReview({ source, patch, card: "sablon-0", rows, inherit });
    },
    data,
    onField,
    onColor,
    onDiscard,
    onSave,
    resetCards,
    onReset: (card: SettingsCardKey) => {
      void onReset(card);
    },
    notice,
    dialog,
    locked,
    onLogo: logoWritable
      ? (file: File) => {
          void selectLogo(file);
        }
      : undefined,
    logoAccept: logoWritable ? "image/png,image/jpeg,image/webp" : undefined,
    canRemoveLogo: logoWritable && logoDraft !== null && !!(asset || logoDraft?.file),
    onRemoveLogo: () => {
      if (!locked && !review && logoWritable) {
        setLogoDraft(asset ? null : undefined);
        setLogoError(undefined);
      }
    },
  };
}
