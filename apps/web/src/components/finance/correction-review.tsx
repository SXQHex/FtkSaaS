"use client";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import type { SetupInput } from "../../lib/studio-setup";
import { effectMoney } from "../../lib/effect-money";
import { FinancePreviewReview } from "./finance-preview-review";
export function CorrectionReview({
  request,
  ...props
}: Omit<ComponentProps<typeof FinancePreviewReview>, "children"> & {
  request: SetupInput<"collection_correct_preview_v1">;
}) {
  const t = useTranslations("finance"),
    locale = useLocale(),
    format = useFormatter();
  return (
    <FinancePreviewReview {...props}>
      <p>
        {t(request.correction.direction)} ·{" "}
        {effectMoney(request.correction.amount_minor, request.correction.currency, locale)}
      </p>
      <p>{request.reason}</p>
      <p>
        {t("correctionTime")}:{" "}
        {format.dateTime(new Date(request.correction.occurred_at), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: props.timeZone,
        })}
      </p>
    </FinancePreviewReview>
  );
}
