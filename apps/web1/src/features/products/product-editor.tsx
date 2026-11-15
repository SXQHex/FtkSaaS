import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArchiveIcon, LockKeyholeIcon, XIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldContent,
  FieldDescription,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../../components/ui/alert-dialog";

export interface ProductDraft {
  name: string;
  kind: "credit" | "timed";
  bookingMode: "" | "priority" | "flexible";
  refundMethod: "" | "none" | "credit_ratio" | "used_at_unit_price" | "time_ratio";
  refundUnit: string;
  extendsValidity: boolean;
  scopeKind: "" | "center_all_disciplines" | "center_discipline";
  disciplineId: string;
  credits: string;
  validityDays: string;
  price: string;
  currency: string;
  scopes: string[];
  quotaPeriod: "none" | "week" | "month";
  quotaLimit: string;
  freeze: boolean;
  freezeDays: string;
  negativeValue: string;
  onSale: boolean;
  versionNote: string;
}
export interface ProductHistoryRow {
  id: string;
  title: string;
  detail: string;
}
export interface ProductEditorSupport {
  validity: boolean;
  saleState: boolean;
  negativeValue: boolean;
  versionNote: boolean;
}

// Field values and capabilities are supplied by the reader/controller, never demo defaults.
export function ProductEditor({
  open,
  editing,
  stage,
  draft,
  support,
  unitPrice,
  draftLoaded = false,
  versions,
  sales,
  changes,
  effects,
  accepted,
  notice,
  pending = false,
  readOnly = false,
  onClose,
  onDraft,
  onStage,
  onAccepted,
  onPublish,
  onSaveDraft,
  onDeleteDraft,
  onArchive,
  disciplines = [],
  scopesEditable = true,
}: {
  disciplines?: { id: string; name: string }[];
  scopesEditable?: boolean;
  open: boolean;
  editing: boolean;
  stage: "edit" | "review";
  draft: ProductDraft;
  support: ProductEditorSupport;
  unitPrice: string | null;
  draftLoaded?: boolean;
  versions: ProductHistoryRow[] | null;
  sales: ProductHistoryRow[] | null;
  changes: ProductHistoryRow[];
  effects: ProductHistoryRow[];
  accepted: boolean;
  notice?: ReactNode;
  pending?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onDraft: (draft: ProductDraft) => void;
  onStage: (stage: "edit" | "review") => void;
  onAccepted: (accepted: boolean) => void;
  onPublish?: () => void;
  onSaveDraft?: () => void;
  onDeleteDraft?: () => void;
  onArchive?: () => void;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  const history = (label: string, rows: ProductHistoryRow[] | null) => (
    <section className="flex min-w-0 flex-col gap-2" aria-label={label}>
      <h3 className="text-sm font-semibold">{label}</h3>
      {rows && rows.length > 0 && (
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.id} role="listitem" variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{row.title}</ItemTitle>
                <ItemDescription>{row.detail}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      {(!rows || rows.length === 0) && (
        <p className="text-sm text-muted-foreground">{t(($) => $.products.unavailable)}</p>
      )}
    </section>
  );
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      isKeyboardDismissDisabled={pending}
      isDismissable={!pending}
      showCloseButton={false}
    >
      <SheetHeader className="relative pe-14">
        <SheetTitle>{t(($) => (editing ? $.products.edit : $.products.new))}</SheetTitle>
        <SheetDescription>{t(($) => $.products.editorDescription)}</SheetDescription>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute end-4 top-4"
          aria-label={t(($) => $.products.close)}
          onPress={onClose}
          isDisabled={pending}
        >
          <XIcon />
        </Button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 [scrollbar-gutter:stable] [overscroll-behavior:contain]">
        {notice}
        {stage === "edit" ? (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product-name">{t(($) => $.products.name)}</FieldLabel>
                <Input
                  id="product-name"
                  name="productName"
                  autoComplete="off"
                  value={draft.name}
                  readOnly={editing}
                  placeholder={t(($) => $.products.namePlaceholder)}
                  onChange={(e) => set("name", e.target.value)}
                  disabled={pending || readOnly}
                />
              </Field>
              <FieldSet>
                <FieldLegend>{t(($) => $.products.kind)}</FieldLegend>
                <ToggleGroup
                  variant="segmented"
                  size="segmented"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([draft.kind])}
                  isDisabled={pending || readOnly}
                  className="max-w-full flex-wrap"
                  aria-label={t(($) => $.products.kind)}
                  onSelectionChange={(keys) =>
                    set("kind", [...keys][0] === "timed" ? "timed" : "credit")
                  }
                >
                  <ToggleGroupItem id="credit">{t(($) => $.products.creditKind)}</ToggleGroupItem>
                  <ToggleGroupItem id="timed">{t(($) => $.products.timedKind)}</ToggleGroupItem>
                </ToggleGroup>
              </FieldSet>
              <FieldGroup className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                {draft.kind === "credit" && (
                  <Field>
                    <FieldLabel htmlFor="product-credits">
                      {t(($) => $.products.credits)}
                    </FieldLabel>
                    <Input
                      id="product-credits"
                      name="credits"
                      inputMode="numeric"
                      value={draft.credits}
                      onChange={(e) => set("credits", e.target.value)}
                      disabled={pending || readOnly}
                    />
                  </Field>
                )}
                <Field data-disabled={!support.validity}>
                  <FieldLabel htmlFor="product-validity">{t(($) => $.products.days)}</FieldLabel>
                  <Input
                    id="product-validity"
                    name="validityDays"
                    inputMode="numeric"
                    value={draft.validityDays}
                    onChange={(e) => set("validityDays", e.target.value)}
                    disabled={pending || readOnly || !support.validity}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-price">{t(($) => $.products.priceMinor)}</FieldLabel>
                  <Input
                    id="product-price"
                    name="price"
                    inputMode="numeric"
                    aria-describedby="product-money-hint"
                    value={draft.price}
                    onChange={(e) => set("price", e.target.value)}
                    disabled={pending || readOnly}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-currency">
                    {t(($) => $.products.currency)}
                  </FieldLabel>
                  <Input
                    id="product-currency"
                    name="currency"
                    value={draft.currency}
                    onChange={(e) => set("currency", e.target.value)}
                    disabled={pending || readOnly}
                    autoComplete="off"
                  />
                </Field>
                {draft.kind === "credit" && (
                  <Field>
                    <FieldLabel htmlFor="product-unit">{t(($) => $.products.unitPrice)}</FieldLabel>
                    <Input
                      id="product-unit"
                      name="unitPrice"
                      value={unitPrice ?? t(($) => $.products.unknown)}
                      readOnly
                    />
                  </Field>
                )}
              </FieldGroup>
              <p id="product-money-hint" className="text-xs text-muted-foreground">
                {t(($) => $.products.moneyHint)}
              </p>
              <FieldGroup className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="product-booking">{t(($) => $.products.booking)}</FieldLabel>
                  <NativeSelect
                    id="product-booking"
                    name="bookingMode"
                    value={draft.bookingMode}
                    disabled={pending || readOnly}
                    onChange={(e) =>
                      set("bookingMode", e.target.value as ProductDraft["bookingMode"])
                    }
                  >
                    <NativeSelectOption value="">{t(($) => $.products.choose)}</NativeSelectOption>
                    <NativeSelectOption value="priority">
                      {t(($) => $.products.priority)}
                    </NativeSelectOption>
                    <NativeSelectOption value="flexible">
                      {t(($) => $.products.flexible)}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="product-refund">{t(($) => $.products.refund)}</FieldLabel>
                  <NativeSelect
                    id="product-refund"
                    name="refundMethod"
                    value={draft.refundMethod}
                    disabled={pending || readOnly}
                    onChange={(e) =>
                      set("refundMethod", e.target.value as ProductDraft["refundMethod"])
                    }
                  >
                    <NativeSelectOption value="">{t(($) => $.products.choose)}</NativeSelectOption>
                    <NativeSelectOption value="none">
                      {t(($) => $.products.refundNone)}
                    </NativeSelectOption>
                    <NativeSelectOption value="credit_ratio">
                      {t(($) => $.products.creditRatio)}
                    </NativeSelectOption>
                    <NativeSelectOption value="used_at_unit_price">
                      {t(($) => $.products.usedUnit)}
                    </NativeSelectOption>
                    <NativeSelectOption value="time_ratio">
                      {t(($) => $.products.timeRatio)}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                {draft.refundMethod === "used_at_unit_price" && (
                  <Field>
                    <FieldLabel htmlFor="product-refund-unit">
                      {t(($) => $.products.refundUnit)}
                    </FieldLabel>
                    <Input
                      id="product-refund-unit"
                      name="refundUnit"
                      inputMode="numeric"
                      value={draft.refundUnit}
                      disabled={pending || readOnly}
                      onChange={(e) => set("refundUnit", e.target.value)}
                    />
                  </Field>
                )}
              </FieldGroup>
              <FieldSet>
                <FieldLegend>{t(($) => $.products.scopes)}</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="product-scope-kind">
                      {t(($) => $.products.scopeBoundary)}
                    </FieldLabel>
                    <NativeSelect
                      id="product-scope-kind"
                      name="scopeKind"
                      value={draft.scopeKind}
                      disabled={pending || readOnly || !scopesEditable}
                      onChange={(e) =>
                        set("scopeKind", e.target.value as ProductDraft["scopeKind"])
                      }
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.products.choose)}
                      </NativeSelectOption>
                      <NativeSelectOption value="center_all_disciplines">
                        {t(($) => $.products.centerAll)}
                      </NativeSelectOption>
                      <NativeSelectOption value="center_discipline">
                        {t(($) => $.products.centerDiscipline)}
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  {draft.scopeKind === "center_discipline" && (
                    <Field>
                      <FieldLabel htmlFor="product-discipline">
                        {t(($) => $.products.discipline)}
                      </FieldLabel>
                      <NativeSelect
                        id="product-discipline"
                        name="disciplineId"
                        value={draft.disciplineId}
                        disabled={pending || readOnly || !scopesEditable}
                        onChange={(e) => set("disciplineId", e.target.value)}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.products.choose)}
                        </NativeSelectOption>
                        {disciplines.map((row) => (
                          <NativeSelectOption key={row.id} value={row.id}>
                            {row.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                  )}
                </FieldGroup>
                <FieldGroup className="gap-3">
                  {[
                    {
                      id: "lesson",
                      label: t(($) => $.products.lessons),
                      hint: t(($) => $.products.lessonHint),
                    },
                    {
                      id: "event",
                      label: t(($) => $.products.event),
                      hint: t(($) => $.products.eventHint),
                    },
                  ].map((scope) => (
                    <Field key={scope.id} orientation="horizontal">
                      <Checkbox
                        id={`product-scope-${scope.id}`}
                        name="scopes"
                        value={scope.id}
                        aria-labelledby={`product-scope-label-${scope.id}`}
                        isSelected={draft.scopes.includes(scope.id)}
                        isDisabled={pending || readOnly || !scopesEditable}
                        onChange={(value) =>
                          set(
                            "scopes",
                            value
                              ? [...draft.scopes, scope.id]
                              : draft.scopes.filter((id) => id !== scope.id),
                          )
                        }
                      />
                      <FieldContent>
                        <FieldLabel
                          id={`product-scope-label-${scope.id}`}
                          htmlFor={`product-scope-${scope.id}`}
                        >
                          {scope.label}
                        </FieldLabel>
                        <FieldDescription>{scope.hint}</FieldDescription>
                      </FieldContent>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>{t(($) => $.products.quota)}</FieldLegend>
                <FieldGroup className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="product-period">{t(($) => $.products.period)}</FieldLabel>
                    <NativeSelect
                      id="product-period"
                      name="quotaPeriod"
                      value={draft.quotaPeriod}
                      disabled={pending || readOnly}
                      onChange={(e) =>
                        set("quotaPeriod", e.target.value as ProductDraft["quotaPeriod"])
                      }
                    >
                      <NativeSelectOption value="none">
                        {t(($) => $.products.none)}
                      </NativeSelectOption>
                      <NativeSelectOption value="week">
                        {t(($) => $.products.week)}
                      </NativeSelectOption>
                      <NativeSelectOption value="month">
                        {t(($) => $.products.month)}
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  {draft.quotaPeriod !== "none" && (
                    <Field>
                      <FieldLabel htmlFor="product-quota-limit">
                        {t(($) => $.products.quotaLimit)}
                      </FieldLabel>
                      <Input
                        id="product-quota-limit"
                        name="quotaLimit"
                        inputMode="numeric"
                        value={draft.quotaLimit}
                        disabled={pending || readOnly}
                        onChange={(e) => set("quotaLimit", e.target.value)}
                      />
                    </Field>
                  )}
                </FieldGroup>
                <FieldDescription>{t(($) => $.products.quotaHint)}</FieldDescription>
              </FieldSet>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel id="product-freeze-label" htmlFor="product-freeze">
                    {t(($) => $.products.allowFreeze)}
                  </FieldLabel>
                  <FieldDescription>{t(($) => $.products.freezeHint)}</FieldDescription>
                </FieldContent>
                <Switch
                  id="product-freeze"
                  name="allowFreeze"
                  aria-labelledby="product-freeze-label"
                  isSelected={draft.freeze}
                  onChange={(value) => set("freeze", value)}
                  isDisabled={pending}
                />
              </Field>
              {draft.freeze && (
                <Field orientation="horizontal">
                  <FieldLabel id="product-extend-label" htmlFor="product-extend">
                    {t(($) => $.products.extendsValidity)}
                  </FieldLabel>
                  <Switch
                    id="product-extend"
                    name="extendsValidity"
                    aria-labelledby="product-extend-label"
                    isSelected={draft.extendsValidity}
                    isDisabled={pending || readOnly}
                    onChange={(value) => set("extendsValidity", value)}
                  />
                </Field>
              )}
              {draft.freeze && (
                <Field>
                  <FieldLabel htmlFor="product-freeze-days">
                    {t(($) => $.products.freezeDays)}
                  </FieldLabel>
                  <Input
                    id="product-freeze-days"
                    name="freezeDays"
                    inputMode="numeric"
                    className="max-w-32"
                    value={draft.freezeDays}
                    disabled={pending || readOnly}
                    onChange={(e) => set("freezeDays", e.target.value)}
                  />
                </Field>
              )}
              <Field data-disabled={!support.negativeValue}>
                <FieldLabel htmlFor="product-negative">
                  {t(($) => $.products.negativeValue)}
                </FieldLabel>
                <Input
                  id="product-negative"
                  name="negativeValue"
                  inputMode="decimal"
                  className="max-w-40"
                  value={draft.negativeValue}
                  disabled={pending || readOnly || !support.negativeValue}
                  onChange={(e) => set("negativeValue", e.target.value)}
                />
                <FieldDescription>{t(($) => $.products.negativeHint)}</FieldDescription>
              </Field>
              <Field orientation="horizontal" data-disabled={!support.saleState}>
                <FieldContent>
                  <FieldLabel id="product-on-label" htmlFor="product-on">
                    {t(($) => $.products.onSale)}
                  </FieldLabel>
                  <FieldDescription>{t(($) => $.products.saleStateHint)}</FieldDescription>
                </FieldContent>
                <Switch
                  id="product-on"
                  name="onSale"
                  aria-labelledby="product-on-label"
                  isSelected={draft.onSale}
                  onChange={(value) => set("onSale", value)}
                  isDisabled={pending || readOnly || !support.saleState}
                />
              </Field>
            </FieldGroup>
            <Alert>
              <LockKeyholeIcon />
              <AlertDescription>{t(($) => $.products.versionHint)}</AlertDescription>
            </Alert>
            {draftLoaded && (
              <Alert>
                <AlertDescription>
                  {t(($) => $.products.draftHint)}
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={!onDeleteDraft || pending}
                    onPress={onDeleteDraft}
                  >
                    {t(($) => $.products.deleteDraft)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {editing && (
              <>
                {history(
                  t(($) => $.products.versions),
                  versions,
                )}
                {history(
                  t(($) => $.products.recentPurchases),
                  sales,
                )}
              </>
            )}
          </>
        ) : (
          <>
            {history(
              t(($) => $.products.changes),
              changes,
            )}
            {history(
              t(($) => $.products.effects),
              effects,
            )}
            <FieldGroup>
              <Field data-disabled={!support.versionNote}>
                <FieldLabel htmlFor="product-version-note">
                  {t(($) => $.products.versionNote)}
                </FieldLabel>
                <Input
                  id="product-version-note"
                  name="versionNote"
                  value={draft.versionNote}
                  disabled={pending || readOnly || !support.versionNote}
                  onChange={(e) => set("versionNote", e.target.value)}
                />
                <FieldDescription>{t(($) => $.products.versionNoteHint)}</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="product-effect"
                  name="effectAccepted"
                  aria-labelledby="product-effect-label"
                  isSelected={accepted}
                  isDisabled={pending || readOnly}
                  onChange={onAccepted}
                />
                <FieldContent>
                  <FieldLabel id="product-effect-label" htmlFor="product-effect">
                    {t(($) => $.products.effectAccepted)}
                  </FieldLabel>
                  <FieldDescription>{t(($) => $.products.effectHint)}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </>
        )}
      </div>
      <SheetFooter className="flex-wrap justify-between">
        {stage === "edit" ? (
          <>
            <Button
              variant="ghost"
              isDisabled={!editing || !onArchive || pending}
              onPress={onArchive}
            >
              <ArchiveIcon data-icon="inline-start" />
              {t(($) => $.products.archive)}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onPress={onClose} isDisabled={pending}>
                {t(($) => $.products.cancel)}
              </Button>
              <Button onPress={() => onStage("review")} isDisabled={pending || readOnly}>
                {t(($) => $.products.review)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" onPress={() => onStage("edit")} isDisabled={pending}>
              {t(($) => $.products.back)}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onPress={onSaveDraft} isDisabled={!onSaveDraft || pending}>
                {t(($) => $.products.saveDraft)}
              </Button>
              <Button onPress={onPublish} isDisabled={!accepted || !onPublish || pending}>
                {t(($) => $.products.publish)}
              </Button>
            </div>
          </>
        )}
      </SheetFooter>
    </Sheet>
  );
}

export function ProductArchiveDialog({
  open,
  name,
  pending = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      isKeyboardDismissDisabled={pending}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.products.archiveTitle)}</AlertDialogTitle>
        <AlertDialogDescription>
          {name}
          <p className="mt-2">{t(($) => $.products.archiveDescription)}</p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <Button variant="outline" onPress={onClose} isDisabled={pending}>
          {t(($) => $.products.cancel)}
        </Button>
        <Button variant="destructive" onPress={onConfirm} isDisabled={!onConfirm || pending}>
          {t(($) => $.products.archive)}
        </Button>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
