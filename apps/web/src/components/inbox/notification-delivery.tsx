"use client";
import { useFormatter, useTranslations } from "next-intl";
import type { JobStatusView } from "@ftksaas/api-contracts";
import { FlowError } from "../bookings/flow-controls";
export function NotificationDelivery({ job }: { job: JobStatusView }) {
  const t = useTranslations("reports"),
    f = useFormatter();
  return (
    <div className="space-y-1 text-sm">
      <p>
        {t("emailJob")} · {t(`states.${job.state}`)}
      </p>
      {job.safe_error_code && <FlowError code={job.safe_error_code} />}
      {job.state === "succeeded" && !job.email_delivery && <p>{t("email.accepted")}</p>}
      {job.email_delivery && (
        <p>
          {t(`email.${job.email_delivery.state}`)}
          {job.email_delivery.occurred_at &&
            ` · ${f.dateTime(new Date(job.email_delivery.occurred_at), { dateStyle: "medium", timeStyle: "short" })}`}
        </p>
      )}
    </div>
  );
}
