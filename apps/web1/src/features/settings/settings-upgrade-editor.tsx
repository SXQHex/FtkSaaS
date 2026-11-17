import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "../../components/ui/button";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { PlanSheet } from "./plan-sheet";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import {
  settingsUpgradeIntent,
  writeSettingsUpgrade,
  readSettingsUpgradeReceipt,
  readSettingsUpgradeResult,
  type SettingsUpgradeQuote,
} from "./settings-upgrade";

type UpgradeResult = Awaited<ReturnType<typeof readSettingsUpgradeResult>>;
export function SettingsUpgradeEditor({
  before,
  timezone,
  onSaved,
  onPay,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsSubscriptionSource;
  timezone: string;
  onSaved: (result: SettingsSubscriptionSource) => Promise<void>;
  onPay: (current: SettingsSubscriptionSource, quote: SettingsUpgradeQuote) => void;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null),
    [result, setResult] = useState<UpgradeResult>(),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const saved = useRef<{ key: string; value: SettingsUpgradeQuote } | undefined>(undefined),
    busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: async (intent: Parameters<typeof writeSettingsUpgrade>[0]) => {
      const value = await writeSettingsUpgrade(intent);
      saved.current = { key: intent.key, value };
      return { primary_id: value.quote.id };
    },
    readReceipt: readSettingsUpgradeReceipt,
    readResult: (intent, id) =>
      readSettingsUpgradeResult(
        intent,
        saved.current?.key === intent.key ? saved.current.value : undefined,
        id,
      ),
    onRefresh: async (next) => {
      await onSaved(next.current);
      if (active.current) setResult(next);
    },
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  async function prepare() {
    if (!selected || busy.current || locked || command.state !== "ready") return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await settingsUpgradeIntent(before, selected);
      if (active.current) await command.start(intent);
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
  const quote = result?.quote;
  if (result)
    return (
      <PlanSheet
        open
        readOnly
        title={t(($) => $.settings.upgradeQuoteTitle)}
        options={[]}
        selected={null}
        description={t(($) => $.settings.upgradeQuoteHint)}
        locked={locked}
        error={error}
        effects={
          quote
            ? [
                {
                  id: "plan",
                  title: t(($) => $.settings.changePlan),
                  detail: `${t(($) => $.settings.subscriptionPlans[quote.from_plan])} → ${t(($) => $.settings.subscriptionPlans[quote.to_plan])}`,
                },
                {
                  id: "amount",
                  title: t(($) => $.settings.upgradeQuoteDue),
                  detail: formatMinorAmount(quote.amount_minor, quote.currency),
                },
                {
                  id: "period",
                  title: t(($) => $.settings.periodEditorEffective),
                  detail: `${date(quote.period_start)} — ${date(quote.period_end)}`,
                },
                {
                  id: "expiry",
                  title: t(($) => $.settings.upgradeQuoteExpiry),
                  detail: date(quote.expires_at),
                },
              ]
            : null
        }
        notice={
          !quote
            ? t(($) => $.settings.upgradeQuoteMissing)
            : !result.usable
              ? t(($) => $.settings.upgradeQuoteExpired)
              : undefined
        }
        onClose={() => {
          if (!locked) onClose();
        }}
        primaryAction={
          <Button
            type="button"
            isDisabled={locked || !quote || !result.usable}
            onPress={() => {
              if (!quote || !result.usable || locked) return;
              if (Date.parse(quote.expires_at) <= Date.now()) {
                setError(t(($) => $.settings.upgradeQuoteExpired));
                return;
              }
              onPay(result.current, { scope: result.scope, quote });
            }}
          >
            {t(($) => $.settings.reportPayment)}
          </Button>
        }
        recoveryActions={
          <Button
            type="button"
            variant="outline"
            isDisabled={locked}
            onPress={() => window.location.reload()}
          >
            {t(($) => $.settings.subscriptionReload)}
          </Button>
        }
      />
    );
  return (
    <PlanSheet
      open
      title={t(($) => $.settings.upgradeQuoteTitle)}
      reviewLabel={t(($) => $.settings.upgradeQuotePrepare)}
      description={t(($) => $.settings.upgradeCatalogHint)}
      selected={selected}
      locked={locked}
      error={error}
      options={
        before.subscription.billing?.upgrade_options?.map((option) => ({
          key: option.target.id,
          label: t(($) => $.settings.subscriptionPlans[option.plan]),
          description: t(($) => $.settings.subscriptionTerms, {
            period: t(($) => $.settings.subscriptionPeriods[option.target.period]),
            amount: formatMinorAmount(option.target.amount_minor, option.target.currency),
          }),
        })) ?? null
      }
      effects={[]}
      onSelect={
        command.state === "ready" && !command.unavailable
          ? (value) => {
              if (!locked) {
                setSelected(value);
                setError(undefined);
              }
            }
          : undefined
      }
      onReview={
        command.state === "ready" && !command.unavailable
          ? () => {
              void prepare();
            }
          : undefined
      }
      onClose={() => {
        if (!locked) onClose();
      }}
      recoveryActions={
        <>
          {error && !locked && (
            <Button type="button" variant="outline" onPress={() => window.location.reload()}>
              {t(($) => $.settings.subscriptionReload)}
            </Button>
          )}
          <EventCommandNotice command={command} onReload={() => window.location.reload()} />
        </>
      }
    />
  );
}
