import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Badge } from "../../components/ui/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
} from "../../components/ui/item";
import type { AttendanceResult } from "../../lib/api-contracts/generated";

export interface EventAttendanceRow {
  id: string;
  name: string;
  result: AttendanceResult;
  detail: string;
  disabled: boolean;
}
export type EventAttendanceAction =
  | "record_start"
  | "correct_start"
  | "clear_start"
  | "close_attendance"
  | "correct_attendance";
export function EventAttendanceView({
  planned,
  actual,
  reason,
  onActual,
  onReason,
  rows,
  closed,
  onMark,
  onAction,
  enabledActions,
  locked = false,
  notice,
}: {
  planned: string;
  actual: string;
  reason: string;
  onActual: (value: string) => void;
  onReason: (value: string) => void;
  rows: EventAttendanceRow[] | null;
  closed: boolean;
  onMark: (id: string, value: AttendanceResult) => void;
  onAction: (action: EventAttendanceAction) => void;
  enabledActions: EventAttendanceAction[];
  locked?: boolean;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="event-planned-start">{t(($) => $.eventDetail.planned)}</FieldLabel>
          <Input id="event-planned-start" name="planned_start" value={planned} readOnly />
        </Field>
        <Field>
          <FieldLabel htmlFor="event-actual-start">{t(($) => $.eventDetail.actual)}</FieldLabel>
          <Input
            id="event-actual-start"
            name="actual_start"
            type="datetime-local"
            value={actual}
            disabled={locked}
            onChange={(event) => onActual(event.target.value)}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="event-start-reason">{t(($) => $.eventDetail.reason)}</FieldLabel>
          <Textarea
            id="event-start-reason"
            name="reason"
            value={reason}
            disabled={locked}
            onChange={(event) => onReason(event.target.value)}
            rows={2}
          />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {closed
            ? t(($) => $.eventDetail.closedAttendance)
            : t(($) => $.eventDetail.openAttendance)}
        </Badge>
        {(["record_start", "correct_start", "clear_start"] as const).map((action) => (
          <Button
            key={action}
            variant="outline"
            size="sm"
            isDisabled={locked || !enabledActions.includes(action)}
            onPress={() => onAction(action)}
          >
            {t(($) => $.eventDetail.attendanceActions[action])}
          </Button>
        ))}
      </div>
      {notice}
      {rows === null ? (
        <p role="status">{t(($) => $.eventDetail.unread)}</p>
      ) : (
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.id} variant="outline" role="listitem" className="flex-wrap">
              <ItemContent>
                <ItemTitle>{row.name}</ItemTitle>
                <ItemDescription>{row.detail}</ItemDescription>
                <ItemDescription>{t(($) => $.eventDetail.results[row.result])}</ItemDescription>
              </ItemContent>
              <ItemActions className="min-w-0 max-w-full flex-wrap">
                <ToggleGroup
                  selectionMode="single"
                  disallowEmptySelection
                  aria-label={t(($) => $.eventDetail.markFor, { name: row.name })}
                  selectedKeys={[row.result]}
                  onSelectionChange={(keys) => {
                    const result = [...keys][0];
                    if (["unmarked", "attended", "no_show", "blocked"].includes(String(result)))
                      onMark(row.id, result as AttendanceResult);
                  }}
                  variant="segmented"
                  className="max-w-full flex-wrap"
                >
                  {(["attended", "no_show", "blocked"] as const).map((result) => (
                    <ToggleGroupItem
                      key={result}
                      id={result}
                      isDisabled={locked || row.disabled || closed}
                    >
                      {t(($) => $.eventDetail.results[result])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {(["close_attendance", "correct_attendance"] as const).map((action) => (
          <Button
            key={action}
            variant={action === "close_attendance" ? "default" : "outline"}
            isDisabled={locked || !enabledActions.includes(action)}
            onPress={() => onAction(action)}
          >
            {t(($) => $.eventDetail.attendanceActions[action])}
          </Button>
        ))}
      </div>
    </div>
  );
}
