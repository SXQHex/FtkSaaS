import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
export interface LeadActivityRow {
  id: string;
  name: string;
  kind: string;
  note: string | null;
  due: string | null;
  outcome: string | null;
  owner: string | null;
}
export function LeadActivitiesView({
  rows,
  onOpen,
  onAdd,
  disabled = false,
  outcomeLabel,
  showOutcome = true,
}: {
  rows: LeadActivityRow[];
  onOpen?: (id: string) => void;
  onAdd?: () => void;
  disabled?: boolean;
  outcomeLabel?: string;
  showOutcome?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t(($) => $.leads.activitiesHint)}</p>
        {onAdd && (
          <Button size="sm" variant="outline" isDisabled={disabled} onPress={onAdd}>
            {t(($) => $.leads.modes.activity)}
          </Button>
        )}
      </div>
      <Table aria-label={t(($) => $.leads.sections)}>
        <TableHeader>
          {[
            t(($) => $.leads.next),
            t(($) => $.leads.candidate),
            t(($) => $.leads.when),
            t(($) => $.leads.owner),
            ...(showOutcome ? [outcomeLabel ?? t(($) => $.leads.outcome)] : []),
          ].map((label, index) => (
            <TableHead id={label} isRowHeader={index === 0} key={label}>
              {label}
            </TableHead>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow id={row.id} key={row.id} textValue={row.name}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto p-0 text-left whitespace-normal"
                  isDisabled={disabled || !onOpen}
                  onPress={() => onOpen?.(row.id)}
                >
                  {row.note ?? row.kind}
                </Button>
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.due ?? "—"}</TableCell>
              <TableCell>{row.owner ?? t(($) => $.leads.unassigned)}</TableCell>
              {showOutcome && <TableCell>{row.outcome ?? "—"}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <Empty>
          <EmptyDescription>{t(($) => $.leads.noActivities)}</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
export interface LeadApplicationRow {
  id: string;
  name: string;
  interest: string;
  submitted: string;
  consent: string;
  suggestions: string;
  state: string;
}
export function LeadApplicationsView({
  rows,
  onOpen,
  disabled = false,
}: {
  rows: LeadApplicationRow[];
  onOpen?: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t(($) => $.leads.applicationsHint)}</p>
      <Table aria-label={t(($) => $.leads.sections)}>
        <TableHeader>
          {[
            t(($) => $.leads.applicant),
            t(($) => $.leads.interest),
            t(($) => $.leads.submitted),
            t(($) => $.leads.consent),
            t(($) => $.leads.suggestions),
          ].map((label, index) => (
            <TableHead id={label} isRowHeader={index === 0} key={label}>
              {label}
            </TableHead>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow id={row.id} key={row.id} textValue={row.name}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto p-0 text-left whitespace-normal"
                  isDisabled={disabled || !onOpen}
                  onPress={() => onOpen?.(row.id)}
                >
                  {row.name}
                </Button>
                <p className="text-xs text-muted-foreground">{row.state}</p>
              </TableCell>
              <TableCell>{row.interest}</TableCell>
              <TableCell>{row.submitted}</TableCell>
              <TableCell>
                <Badge variant="secondary">{row.consent}</Badge>
              </TableCell>
              <TableCell>{row.suggestions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <Empty>
          <EmptyDescription>{t(($) => $.leads.noApplications)}</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
export function LeadHistoryView({ rows }: { rows: LeadActivityRow[] }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t(($) => $.leads.history)}</h3>
      <ItemGroup>
        {rows.map((row) => (
          <Item key={row.id} role="listitem" size="xs">
            <ItemContent>
              <ItemTitle>{row.kind}</ItemTitle>
              <ItemDescription>
                {[row.note, row.due, row.outcome].filter(Boolean).join(" · ")}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">{t(($) => $.leads.noActivities)}</p>
      )}
    </section>
  );
}

export type LeadFollowupKind = "manual" | "renewal_due" | "inactive_student";
export function LeadFollowupPicker({
  value,
  onChange,
  disabled,
}: {
  value: LeadFollowupKind;
  onChange: (value: LeadFollowupKind) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <search aria-label={t(($) => $.leads.followupKind)}>
      <Field>
        <FieldLabel htmlFor="lead-followup-kind">{t(($) => $.leads.followupKind)}</FieldLabel>
        <NativeSelect
          id="lead-followup-kind"
          name="followup-kind"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "manual" || next === "renewal_due" || next === "inactive_student")
              onChange(next);
          }}
        >
          {(["manual", "renewal_due", "inactive_student"] as const).map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {t(($) => $.leads.followupKinds[kind])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </search>
  );
}
