import { useTranslation } from "react-i18next";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import type { AttendanceResult } from "@ftksaas/api-contracts";
import type { EventChoice } from "./event-terms-fields";

export function EventCorrectionFields({
  rows,
  selected,
  onSelect,
  result,
  onResult,
  allowIneligible,
  recordIneligible,
  onRecordIneligible,
  disabled = false,
}: {
  rows: EventChoice[];
  selected: string;
  onSelect: (id: string) => void;
  result: AttendanceResult;
  onResult: (value: AttendanceResult) => void;
  allowIneligible: boolean;
  recordIneligible: boolean;
  onRecordIneligible: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field>
        <FieldLabel htmlFor="event-correction-person">
          {t(($) => $.eventDetail.correctionPerson)}
        </FieldLabel>
        <NativeSelect
          id="event-correction-person"
          name="registration_id"
          value={selected}
          disabled={disabled}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
          {rows.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>{t(($) => $.eventDetail.correctionHint)}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t(($) => $.eventDetail.correctedResult)}</FieldLabel>
        <ToggleGroup
          selectionMode="single"
          disallowEmptySelection
          aria-label={t(($) => $.eventDetail.correctedResult)}
          variant="segmented"
          selectedKeys={[result]}
          onSelectionChange={(keys) => {
            const value = [...keys][0];
            if (["unmarked", "attended", "no_show", "blocked"].includes(String(value)))
              onResult(value as AttendanceResult);
          }}
          className="max-w-full flex-wrap"
        >
          {(["unmarked", "attended", "no_show", "blocked"] as const).map((value) => (
            <ToggleGroupItem key={value} id={value} isDisabled={disabled}>
              {t(($) => $.eventDetail.results[value])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {allowIneligible && result === "attended" && (
        <Field orientation="horizontal">
          <Checkbox
            id="event-record-ineligible"
            name="record_ineligible_attendance"
            isSelected={recordIneligible}
            isDisabled={disabled}
            onChange={onRecordIneligible}
          />
          <FieldLabel htmlFor="event-record-ineligible">
            {t(($) => $.eventDetail.ineligibleAcknowledgement)}
          </FieldLabel>
        </Field>
      )}
    </>
  );
}

export function EventDutyVerificationFields({
  value,
  onChange,
  disabled = false,
}: {
  value?: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel>{t(($) => $.eventDetail.dutyOutcome)}</FieldLabel>
      <ToggleGroup
        selectionMode="single"
        disallowEmptySelection
        aria-label={t(($) => $.eventDetail.dutyOutcome)}
        selectedKeys={value === undefined ? [] : [String(value)]}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (key === "true" || key === "false") onChange(key === "true");
        }}
        variant="segmented"
        className="max-w-full flex-wrap"
      >
        <ToggleGroupItem id="true" isDisabled={disabled}>
          {t(($) => $.eventDetail.dutyPerformed)}
        </ToggleGroupItem>
        <ToggleGroupItem id="false" isDisabled={disabled}>
          {t(($) => $.eventDetail.dutyNotPerformed)}
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

export function EventActualOffsetField({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: EventChoice[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel htmlFor="event-actual-offset">{t(($) => $.eventDetail.actualOffset)}</FieldLabel>
      <NativeSelect
        id="event-actual-offset"
        name="actual_offset"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      >
        <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
        {choices.map((choice) => (
          <NativeSelectOption key={choice.id} value={choice.id}>
            {choice.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
