import { useTranslation } from "react-i18next";
import type { MemberLessonCancellation } from "@ftksaas/api-contracts";
export function MemberCancellationPolicy({
  value,
  timezone,
}: {
  value: MemberLessonCancellation;
  timezone: string;
}) {
  const { t } = useTranslation();
  if (value.status !== "available" || !value.terms)
    return <p>{t(($) => $.memberClasses.policyUnknown)}</p>;
  const terms = value.terms;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {t(($) => $.memberClasses.policyBefore, {
          effect: t(($) => $.memberClasses.effects[terms.before_cutoff]),
        })}
      </p>
      <p>
        {t(($) => $.memberClasses.policyAfter, {
          effect: t(($) => $.memberClasses.effects[terms.after_cutoff]),
        })}
      </p>
      <p>
        {t(($) => $.memberClasses.policyNoShow, {
          effect: t(($) => $.memberClasses.effects[terms.no_show]),
        })}
      </p>
      {value.cutoff_at && (
        <p>
          {t(($) => $.memberClasses.cutoff, {
            time: new Intl.DateTimeFormat("tr-TR", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: timezone,
            }).format(new Date(value.cutoff_at)),
          })}
        </p>
      )}
    </div>
  );
}
