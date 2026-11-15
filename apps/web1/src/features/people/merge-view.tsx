import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, CheckIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import {
  Field,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "../../components/ui/field";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Empty, EmptyDescription } from "../../components/ui/empty";

export type MergeFilter = "pending" | "completed";
export interface MergeListItem {
  id: string;
  name: string;
  description: string;
  detail: string | null;
}
export type MergeComparisonField =
  | "name"
  | "email"
  | "phone"
  | "account"
  | "createdBy"
  | "status"
  | "rights"
  | "reservations"
  | "payments"
  | "debt"
  | "documents";
export interface MergeComparison {
  field: MergeComparisonField;
  values: [string | null, string | null];
}
export interface MergeDetail {
  id: string;
  title: string;
  description: string;
  records: [{ name: string; description: string }, { name: string; description: string }];
  comparison: MergeComparison[];
  effects: { label: string; value: string; description: string | null }[];
  blockers: string[];
  // Display-only values must come from the scoped reader/preview, never demo calculations.
  notice?: string;
  completed?: boolean;
  profileAction?: ReactNode;
}
export function MergeView({
  items,
  selectedId,
  filter,
  pendingLabel,
  detail,
  keptRecord,
  reason,
  reviewed,
  state,
  locked = false,
  canApply = false,
  reasonError,
  listNotice,
  selectionControls,
  onBack,
  onFilter,
  onSelect,
  onKeep,
  onReason,
  onReviewed,
  onPreview,
  onApply,
  onDismiss,
  onRetry,
  completedAvailable = true,
  listActions,
}: {
  items: MergeListItem[];
  selectedId?: string;
  filter: MergeFilter;
  pendingLabel: string | null;
  detail?: MergeDetail;
  keptRecord: "0" | "1";
  reason: string;
  reviewed: boolean;
  state: "loading" | "ready" | "error";
  locked?: boolean;
  canApply?: boolean;
  reasonError?: string;
  listNotice?: string;
  selectionControls?: ReactNode;
  onBack?: () => void;
  onFilter?: (filter: MergeFilter) => void;
  onSelect?: (id: string) => void;
  onKeep?: (record: "0" | "1") => void;
  onReason?: (reason: string) => void;
  onReviewed?: (reviewed: boolean) => void;
  onPreview?: () => void;
  onApply?: () => void;
  onDismiss?: () => void;
  onRetry?: () => void;
  completedAvailable?: boolean;
  listActions?: ReactNode;
}) {
  const { t } = useTranslation();
  const unknown = t(($) => $.peopleMerge.unknown);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Button
        variant="link"
        className="-mb-2 min-h-0 self-start p-0"
        onPress={onBack}
        isDisabled={!onBack || locked}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t(($) => $.people.title)}
      </Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.peopleMerge.title)}</h1>
        <p className="text-sm text-muted-foreground">{t(($) => $.peopleMerge.description)}</p>
      </header>
      {selectionControls}
      <div className="grid min-w-0 items-start gap-4 min-[1181px]:grid-cols-[21rem_minmax(0,1fr)]">
        <Card className="min-w-0 gap-0 pb-0">
          <CardHeader className="pb-4">
            <ToggleGroup
              variant="segmented"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[filter]}
              onSelectionChange={(keys) => {
                const key = [...keys][0];
                if (key === "pending" || key === "completed") onFilter?.(key);
              }}
              isDisabled={locked || !onFilter}
              aria-label={t(($) => $.peopleMerge.filterLabel)}
            >
              {(["pending", "completed"] as const).map((key) => (
                <ToggleGroupItem
                  key={key}
                  id={key}
                  isDisabled={key === "completed" && !completedAvailable}
                >
                  {t(($) => $.peopleMerge.filters[key])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent className="px-0">
            {listNotice && (
              <Alert className="mx-4 mb-4 w-auto">
                <AlertDescription>{listNotice}</AlertDescription>
              </Alert>
            )}
            {state === "loading" ? (
              <Empty>
                <EmptyDescription role="status">{t(($) => $.peopleMerge.loading)}</EmptyDescription>
              </Empty>
            ) : state === "error" ? (
              <Empty>
                <EmptyDescription role="status">
                  {t(($) => $.peopleMerge.readError)}
                </EmptyDescription>
                <Button variant="outline" onPress={onRetry} isDisabled={!onRetry}>
                  {t(($) => $.people.refresh)}
                </Button>
              </Empty>
            ) : items.length ? (
              <ToggleGroup
                orientation="vertical"
                spacing={0}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={selectedId ? [selectedId] : []}
                onSelectionChange={(keys) => {
                  const id = [...keys][0];
                  if (typeof id === "string") onSelect?.(id);
                }}
                isDisabled={locked || !onSelect}
                aria-label={t(($) => $.peopleMerge.listLabel)}
                className="w-full"
              >
                {items.map((item) => (
                  <ToggleGroupItem
                    key={item.id}
                    id={item.id}
                    className="h-auto w-full justify-start rounded-none! px-4 py-3 text-left whitespace-normal"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>
                            {item.name
                              .split(/\s+/u)
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="break-words">{item.name}</span>
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {item.description}
                      </span>
                      {item.detail && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <Empty>
                <EmptyDescription>{t(($) => $.peopleMerge.empty[filter])}</EmptyDescription>
              </Empty>
            )}
          </CardContent>
          <CardFooter className="mt-0 flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground">{pendingLabel ?? unknown}</p>
            {listActions}
          </CardFooter>
        </Card>
        <div className="flex min-w-0 flex-col gap-4" aria-busy={state === "loading"}>
          {!detail ? (
            <Card>
              <CardContent>
                <Empty>
                  <EmptyDescription>{t(($) => $.peopleMerge.selectPrompt)}</EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          ) : detail.completed ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <Alert role="status">
                  <CheckIcon />
                  <AlertDescription>
                    {detail.notice ?? t(($) => $.peopleMerge.completed)}
                  </AlertDescription>
                </Alert>
                {detail.profileAction}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>
                    <h2>{detail.title}</h2>
                  </CardTitle>
                  <CardDescription>{detail.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-3.5">
                  <FieldSet>
                    <FieldLegend variant="label" className="sr-only">
                      {t(($) => $.peopleMerge.keepLabel)}
                    </FieldLegend>
                    <RadioGroup
                      value={keptRecord}
                      onChange={(value) => {
                        if (value === "0" || value === "1") onKeep?.(value);
                      }}
                      isDisabled={locked || !onKeep}
                      aria-label={t(($) => $.peopleMerge.keepLabel)}
                    >
                      {detail.records.map((record, index) => (
                        <Field
                          key={index}
                          orientation="horizontal"
                          className="rounded-md border p-3 has-data-selected:border-foreground"
                        >
                          <RadioGroupItem
                            id={`merge-keep-${index}`}
                            value={String(index)}
                            aria-describedby={`merge-keep-detail-${index}`}
                          />
                          <FieldLabel
                            htmlFor={`merge-keep-${index}`}
                            className="flex min-w-0 flex-col items-start gap-1 whitespace-normal"
                          >
                            <span>{t(($) => $.peopleMerge.keepRecord, { number: index + 1 })}</span>
                            <span
                              id={`merge-keep-detail-${index}`}
                              className="text-xs font-normal text-muted-foreground"
                            >
                              {record.description}
                            </span>
                          </FieldLabel>
                        </Field>
                      ))}
                    </RadioGroup>
                  </FieldSet>
                  <Table
                    aria-label={t(($) => $.peopleMerge.comparisonLabel)}
                    className="min-w-[32rem] table-fixed"
                  >
                    <TableHeader>
                      <TableHead isRowHeader className="w-34">
                        <span className="sr-only">{t(($) => $.peopleMerge.field)}</span>
                      </TableHead>
                      {detail.records.map((record, index) => (
                        <TableHead key={index} className="last:text-left">
                          {t(($) => $.peopleMerge.record, { number: index + 1 })}
                          <span className="sr-only">: {record.name}</span>
                          {keptRecord === String(index) && (
                            <Badge variant="secondary" className="ml-1">
                              {t(($) => $.peopleMerge.kept)}
                            </Badge>
                          )}
                        </TableHead>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {detail.comparison.map((row) => (
                        <TableRow key={row.field}>
                          <TableCell className="py-[9px] text-muted-foreground">
                            {t(($) => $.peopleMerge.fields[row.field])}
                          </TableCell>
                          {row.values.map((value, index) => (
                            <TableCell
                              key={index}
                              className="py-[9px] align-top break-words whitespace-normal last:text-left"
                            >
                              {value ?? unknown}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>
                    <h2>{t(($) => $.peopleMerge.impactTitle)}</h2>
                  </CardTitle>
                  <CardDescription>{t(($) => $.peopleMerge.impactDescription)}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {detail.effects.length ? (
                    <ItemGroup className="gap-0 overflow-hidden rounded-lg border">
                      {detail.effects.map((effect, index) => (
                        <Item
                          key={index}
                          role="listitem"
                          className="rounded-none border-0 border-b border-b-border px-3 py-3 last:border-b-0"
                        >
                          <ItemContent>
                            <ItemTitle className="flex w-full items-start justify-between gap-3">
                              <span className="font-normal">{effect.label}</span>
                              <span className="max-w-[70%] text-right font-semibold break-words">
                                {effect.value}
                              </span>
                            </ItemTitle>
                            {effect.description && (
                              <ItemDescription className="text-xs">
                                {effect.description}
                              </ItemDescription>
                            )}
                          </ItemContent>
                        </Item>
                      ))}
                    </ItemGroup>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t(($) => $.peopleMerge.previewRequired)}
                    </p>
                  )}
                  {detail.blockers.map((blocker, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangleIcon />
                      <AlertDescription>{blocker}</AlertDescription>
                    </Alert>
                  ))}
                  {detail.notice && (
                    <Alert role="status">
                      <AlertDescription>{detail.notice}</AlertDescription>
                    </Alert>
                  )}
                  <form
                    id="person-merge"
                    method="post"
                    aria-label={t(($) => $.peopleMerge.title)}
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!locked) onApply?.();
                    }}
                  >
                    <FieldGroup>
                      <Field data-invalid={Boolean(reasonError)}>
                        <FieldLabel htmlFor="merge-reason">
                          {t(($) => $.peopleMerge.reason)} <span aria-hidden="true">*</span>
                        </FieldLabel>
                        <FieldDescription id="merge-reason-help">
                          {t(($) => $.peopleMerge.reasonHelp)}
                        </FieldDescription>
                        <Textarea
                          id="merge-reason"
                          name="reason"
                          rows={2}
                          required
                          value={reason}
                          disabled={locked || !onReason}
                          onChange={(event) => onReason?.(event.target.value)}
                          aria-invalid={Boolean(reasonError)}
                          aria-describedby={
                            reasonError
                              ? "merge-reason-help merge-reason-error"
                              : "merge-reason-help"
                          }
                          className="max-h-48 resize-y! rounded-md border-input! bg-transparent!"
                        />
                        {reasonError && (
                          <FieldError id="merge-reason-error">{reasonError}</FieldError>
                        )}
                      </Field>
                      <Field orientation="horizontal">
                        <Checkbox
                          id="merge-reviewed"
                          name="reviewed"
                          isRequired
                          isSelected={reviewed}
                          onChange={onReviewed}
                          isDisabled={locked || !onReviewed}
                        />
                        <FieldLabel
                          htmlFor="merge-reviewed"
                          className="flex flex-col items-start gap-1 py-2"
                        >
                          <span>{t(($) => $.peopleMerge.reviewed)}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t(($) => $.peopleMerge.irreversible)}
                          </span>
                        </FieldLabel>
                      </Field>
                    </FieldGroup>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <Button variant="ghost" onPress={onDismiss} isDisabled={!onDismiss || locked}>
                    {t(($) => $.peopleMerge.notDuplicate)}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {onPreview && (
                      <Button variant="outline" onPress={onPreview} isDisabled={locked}>
                        {t(($) => $.peopleMerge.preview)}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      form="person-merge"
                      isDisabled={!onApply || !canApply || locked}
                    >
                      {t(($) => $.peopleMerge.apply)}
                    </Button>
                  </div>
                  {!onDismiss && (
                    <p className="w-full text-xs text-muted-foreground">
                      {t(($) => $.peopleMerge.dismissUnavailable)}
                    </p>
                  )}
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
