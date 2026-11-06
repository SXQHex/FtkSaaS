"use client";
import { useTranslations } from "next-intl";
import { FlowError } from "../bookings/flow-controls";
export function AttendanceError({ code }: { code: string }) {
  const t = useTranslations("attendance");
  return code === "FORBIDDEN" ? (
    <p role="alert">{t("conditionsChanged")}</p>
  ) : (
    <FlowError code={code} />
  );
}
