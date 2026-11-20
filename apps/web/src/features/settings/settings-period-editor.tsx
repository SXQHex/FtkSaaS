import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { PlanSheet } from "./plan-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import {
  settingsPeriodIntent,
  writeSettingsPeriod,
  readSettingsPeriodReceipt,
  readSettingsPeriodResult,
  type SettingsPeriodIntent,
} from "./settings-period";

export function SettingsPeriodEditor({
  before,
  timezone,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsSubscriptionSource;
  timezone: string;
  onSaved: (result: SettingsSubscriptionSource) => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null),
    [review, setReview] = useState<SettingsPeriodIntent>(),
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
  const command = useMemberCommand({
    write: writeSettingsPeriod,
    readReceipt: readSettingsPeriodReceipt,
    readResult: readSettingsPeriodResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const title = t(($) => $.settings.periodEditorTitle);
  const description = [
    t(($) => $.settings.periodEditorHint),
    before.subscription.billing?.pending_period_change
      ? t(($) => $.settings.periodReplaceHint)
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  async function prepare() {
    if (!selected || busy.current || locked || review) return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await settingsPeriodIntent(before, selected);
      if (active.current) {
        command.reset();
        setAccepted(false);
        setReview(intent);
      }
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.settings.subscriptionReadError),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={title}
        description={description}
        rows={[
          {
            id: "period",
            title: t(($) => $.settings.periodEditorChoose),
            detail: t(($) => $.settings.subscriptionPeriods[review.target.period]),
          },
          {
            id: "amount",
            title: t(($) => $.settings.periodEditorPrice),
            detail: formatMinorAmount(review.target.amount_minor, review.target.currency),
          },
          {
            id: "effective",
            title: t(($) => $.settings.periodEditorEffective),
            detail: date(review.effectiveAt),
          },
        ]}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        onClose={() => {
          if (locked) return;
          if (command.state === "ready") {
            setReview(undefined);
            setAccepted(false);
          } else onClose();
        }}
        onApply={
          !command.unavailable && command.state === "ready"
            ? () => {
                if (accepted && !locked) void command.start(review);
              }
            : undefined
        }
        notice={command.state === "saved" ? t(($) => $.settings.periodSubmitted) : undefined}
        recoveryActions={
          <EventCommandNotice command={command} onReload={() => window.location.reload()} />
        }
      />
    );
  return (
    <PlanSheet
      open
      title={title}
      selectionLabel={t(($) => $.settings.periodEditorChoose)}
      description={description}
      selected={selected}
      locked={locked}
      error={error}
      options={
        before.subscription.billing?.period_change_options.map((option) => ({
          key: option.id,
          label: t(($) => $.settings.subscriptionPeriods[option.period]),
          description: formatMinorAmount(option.amount_minor, option.currency),
        })) ?? null
      }
      effects={
        before.subscription.period_end
          ? [
              {
                id: "effective",
                title: t(($) => $.settings.periodEditorEffective),
                detail: date(before.subscription.period_end),
              },
            ]
          : null
      }
      onSelect={(value) => {
        if (!locked) {
          setSelected(value);
          setError(undefined);
        }
      }}
      recoveryActions={
        error ? (
          <Button
            type="button"
            variant="outline"
            isDisabled={locked}
            onPress={() => window.location.reload()}
          >
            {t(($) => $.settings.subscriptionReload)}
          </Button>
        ) : undefined
      }
      onReview={() => {
        void prepare();
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
    />
  );
}
