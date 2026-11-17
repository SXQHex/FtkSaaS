import { useTranslation } from "react-i18next";
import type { Preview } from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function EventPreviewEffects({ preview }: { preview: Preview }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t(($) => $.eventDetail.previewHint)}</p>
      {preview.effects.length ? (
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {preview.effects.map((effect, index) => (
            <li key={index}>
              {t(($) => $.sessionDetail.effectActions[effect.action])}
              {effect.quantity != null ? ` · ${effect.quantity}` : ""}
              {effect.amount_minor != null && effect.currency
                ? ` · ${formatMinorAmount(effect.amount_minor, effect.currency)}`
                : ""}
              {effect.reason ? ` · ${effect.reason}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t(($) => $.memberProfile.nativeEffectsHint)}</p>
      )}
      {preview.blockers.map((blocker, index) => (
        <Alert key={index} variant="destructive">
          <AlertDescription>{scheduleBackendError(blocker.code, t)}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
