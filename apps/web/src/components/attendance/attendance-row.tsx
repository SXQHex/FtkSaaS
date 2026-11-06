"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AttendanceEntryView, AttendanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import type { AttendanceApi } from "../../lib/attendance";
import { AttendanceRowForm } from "./attendance-row-form";
export type AttendanceRowProps = {
  scope: SetupScope;
  view: AttendanceView;
  row: AttendanceEntryView;
  number: number;
  timeZone: string;
  api: AttendanceApi;
  onSaved: (rights?: boolean, error?: string) => void;
};
export function AttendanceRow(props: AttendanceRowProps & { editable: boolean }) {
  const t = useTranslations("attendance"),
    [open, setOpen] = useState(false),
    { row, number, editable, view } = props;
  return (
    <li className="min-w-0 space-y-3 rounded-md border p-4">
      <h4 className="font-medium">
        {row.subscriber_number
          ? t("subscriber", { number: row.subscriber_number })
          : t("participant", { number })}
      </h4>
      <p>{t(`results.${row.result}`)}</p>
      {row.protected && <p className="text-sm text-muted-foreground">{t("protected")}</p>}
      {row.blocked_reason && <p>{t(`reasons.${row.blocked_reason}`)}</p>}
      {editable && (
        <Button variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {t(open ? "hideEditor" : view.closure_state === "closed" ? "correct" : "edit")}
        </Button>
      )}
      {open && <AttendanceRowForm {...props} />}
    </li>
  );
}
