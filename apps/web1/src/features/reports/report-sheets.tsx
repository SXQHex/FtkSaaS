import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Progress } from "../../components/ui/progress";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
export type ExportReportKind = "summary" | "collections" | "debtors" | "earnings" | "crm";
export function ReportExportSheet({
  kind,
  onKind,
  period,
  retry = false,
  fileDescription,
  preparation,
  notice,
  error,
  reviewed,
  onReviewed,
  onStart,
  onClose,
  locked = false,
  canStart = true,
  unsupported = [],
}: {
  kind: ExportReportKind | "";
  onKind: (kind: ExportReportKind | "") => void;
  period: string;
  retry?: boolean;
  fileDescription: string;
  preparation: string;
  notice?: ReactNode;
  error?: string;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  onStart: () => void;
  onClose: () => void;
  locked?: boolean;
  canStart?: boolean;
  unsupported?: ExportReportKind[];
}) {
  const { t } = useTranslation(),
    form = useId();
  return (
    <Sheet
      isOpen
      side="right"
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      className="flex w-full min-w-0 flex-col sm:max-w-lg"
    >
      <SheetHeader>
        <SheetTitle>
          {t(($) => (retry ? $.reports.exportRetryTitle : $.reports.exportTitle))}
        </SheetTitle>
        <SheetDescription>
          {period} · {t(($) => $.reports.csv)}
        </SheetDescription>
      </SheetHeader>
      <form
        id={form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && canStart) onStart();
        }}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5"
      >
        {notice}
        <FieldGroup>
          {!retry && (
            <Field>
              <FieldLabel htmlFor={`${form}-kind`}>{t(($) => $.reports.report)}</FieldLabel>
              <NativeSelect
                id={`${form}-kind`}
                value={kind}
                disabled={locked}
                onChange={(e) => onKind(e.target.value as ExportReportKind | "")}
              >
                <NativeSelectOption value="">{t(($) => $.reports.choose)}</NativeSelectOption>
                {(["summary", "collections", "debtors", "earnings", "crm"] as const).map((key) => (
                  <NativeSelectOption key={key} value={key} disabled={unsupported.includes(key)}>
                    {t(($) => $.reports.reportKinds[key])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt>{t(($) => (retry ? $.reports.exportSourceDate : $.reports.period))}</dt>
            <dd>{period}</dd>
            <dt>{t(($) => $.reports.file)}</dt>
            <dd>{fileDescription}</dd>
            <dt>{t(($) => $.reports.preparation)}</dt>
            <dd>{preparation}</dd>
          </dl>
          {!retry && <FieldDescription>{t(($) => $.reports.preparationHint)}</FieldDescription>}
          <Field orientation="horizontal">
            <Checkbox
              id={`${form}-review`}
              isSelected={reviewed}
              isDisabled={locked}
              onChange={onReviewed}
            />
            <FieldLabel htmlFor={`${form}-review`}>
              {t(($) => (retry ? $.reports.exportRetryReview : $.reports.exportReview))}
            </FieldLabel>
          </Field>
        </FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
      <SheetFooter>
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.reports.cancel)}
        </Button>
        <Button type="submit" form={form} isDisabled={locked || !canStart}>
          {t(($) => (retry ? $.reports.fileActions.retry : $.reports.exportStart))}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
export type ImportStep = "file" | "preview" | "result" | "rows";
export type ImportRowFilter =
  | "all"
  | "problem"
  | "invalid"
  | "duplicate"
  | "pending"
  | "valid"
  | "applied"
  | "failed";
export interface ImportDisplayRow {
  id: string;
  number: string;
  name: string;
  contact: string;
  state: string;
  reason?: string;
  selectable?: boolean;
  selected?: boolean;
}
export interface ImportSummary {
  eligible: string;
  skipped: string;
  warnings: string;
}
export function ReportImportSheet({
  step,
  fileName,
  limits,
  rows,
  summary,
  filter,
  onFilter,
  onFile,
  onTemplate,
  onPreview,
  onApply,
  onBack,
  onClose,
  onReadRows,
  onSelectRow,
  reviewed,
  onReviewed,
  progress,
  notice,
  error,
  locked = false,
  canPreview = true,
  canApply = true,
  canTemplate = false,
  canReadRows = false,
  availableFilters = ["all", "problem", "invalid", "duplicate"],
}: {
  step: ImportStep;
  fileName: string;
  limits: string;
  rows: ImportDisplayRow[];
  summary?: ImportSummary;
  filter: ImportRowFilter;
  onFilter: (filter: ImportRowFilter) => void;
  onFile: (file: File | undefined) => void;
  onTemplate: () => void;
  onPreview: () => void;
  onApply: () => void;
  onBack: () => void;
  onClose: () => void;
  onReadRows: () => void;
  onSelectRow: (id: string, selected: boolean) => void;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  progress?: number;
  notice?: ReactNode;
  error?: string;
  locked?: boolean;
  canPreview?: boolean;
  canApply?: boolean;
  canTemplate?: boolean;
  canReadRows?: boolean;
  availableFilters?: ImportRowFilter[];
}) {
  const { t } = useTranslation(),
    id = useId();
  const title =
    step === "preview"
      ? t(($) => $.reports.preview)
      : step === "rows"
        ? t(($) => $.reports.readRows)
        : t(($) => $.reports.importTitle);
  return (
    <Sheet
      isOpen
      side="right"
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      className="flex w-full min-w-0 flex-col sm:max-w-xl"
    >
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {step === "file"
            ? t(($) => $.reports.fileStep)
            : step === "preview"
              ? t(($) => $.reports.previewStep)
              : fileName || t(($) => $.reports.resultStep)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        {notice}
        {step === "file" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-file`}>{t(($) => $.reports.importFile)}</FieldLabel>
              <FieldDescription id={`${id}-hint`}>
                {t(($) => $.reports.fileHint)} {limits}
              </FieldDescription>
              <Input
                id={`${id}-file`}
                type="file"
                accept=".csv,text/csv"
                disabled={locked}
                aria-describedby={`${id}-hint`}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                isDisabled={locked || !canTemplate}
                onPress={onTemplate}
              >
                {t(($) => $.reports.template)}
              </Button>
            </div>
            <FieldDescription>{t(($) => $.reports.importHint)}</FieldDescription>
          </FieldGroup>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-3 gap-3">
                {(["eligible", "skipped", "warnings"] as const).map((key) => (
                  <Card key={key}>
                    <CardHeader>
                      <CardDescription>{t(($) => $.reports[key])}</CardDescription>
                      <CardTitle className="break-words text-xl tabular-nums">
                        {summary[key]}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
            {progress !== undefined && (
              <Progress aria-label={t(($) => $.reports.importProgress)} value={progress} />
            )}
            {(step === "preview" || step === "rows") && (
              <>
                <ToggleGroup
                  aria-label={t(($) => $.reports.rowFilter)}
                  selectedKeys={[filter]}
                  selectionMode="single"
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const value = [...keys][0];
                    if (
                      !locked &&
                      typeof value === "string" &&
                      availableFilters.includes(value as ImportRowFilter)
                    )
                      onFilter(value as ImportRowFilter);
                  }}
                  isDisabled={locked}
                  variant="outline"
                  size="sm"
                  className="max-w-full flex-wrap"
                >
                  {availableFilters.map((key) => (
                    <ToggleGroupItem key={key} id={key}>
                      {t(($) => $.reports.filters[key])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div
                  role="region"
                  aria-label={t(($) => $.reports.rows)}
                  tabIndex={0}
                  className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Table aria-label={t(($) => $.reports.rows)} className="min-w-[26rem]">
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.reports.columns.row)}</TableHead>
                      <TableHead>{t(($) => $.reports.columns.person)}</TableHead>
                      <TableHead>{t(($) => $.reports.columns.status)}</TableHead>
                    </TableHeader>
                    <TableBody renderEmptyState={() => <p>{t(($) => $.reports.empty)}</p>}>
                      {rows.map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell focusMode={row.selectable ? "child" : "cell"} className="py-6">
                            {row.selectable ? (
                              <Checkbox
                                aria-label={`${t(($) => $.reports.columns.row)} ${row.number}`}
                                isSelected={row.selected}
                                isDisabled={locked}
                                onChange={(selected) => onSelectRow(row.id, selected)}
                              >
                                {row.number}
                              </Checkbox>
                            ) : (
                              row.number
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="break-words font-medium">{row.name}</p>
                            <p className="break-all text-sm text-muted-foreground">{row.contact}</p>
                          </TableCell>
                          <TableCell>
                            <p>{row.state}</p>
                            {row.reason && (
                              <p className="text-sm text-muted-foreground">{row.reason}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {step === "preview" && (
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-review`}
                  isSelected={reviewed}
                  isDisabled={locked}
                  onChange={onReviewed}
                />
                <FieldLabel htmlFor={`${id}-review`}>{t(($) => $.reports.importReview)}</FieldLabel>
              </Field>
            )}
            {step === "result" && <p>{t(($) => $.reports.importHint)}</p>}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        {step === "preview" && (
          <Button variant="ghost" isDisabled={locked} onPress={onBack}>
            {t(($) => $.reports.back)}
          </Button>
        )}
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {step === "result" || step === "rows"
            ? t(($) => $.reports.close)
            : t(($) => $.reports.cancel)}
        </Button>
        {step === "file" && (
          <Button isDisabled={locked || !canPreview} onPress={onPreview}>
            {t(($) => $.reports.preview)}
          </Button>
        )}
        {step === "preview" && (
          <Button isDisabled={locked || !canApply} onPress={onApply}>
            {t(($) => $.reports.importApply)}
          </Button>
        )}
        {step === "result" && (
          <Button isDisabled={locked || !canReadRows} onPress={onReadRows}>
            {t(($) => $.reports.rows)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
