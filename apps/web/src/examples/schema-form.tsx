import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button, FieldError, Input, Label, TextField } from "react-aria-components";

// A test-consumed foundation example, not a product route or a backend operation.
export function SchemaForm({ onSubmit }: { onSubmit?: (value: { text: string }) => void } = {}) {
  const { t } = useTranslation("common");
  const [submitted, setSubmitted] = useState(false);
  const schema = z
    .string()
    .min(
      1,
      t(($) => $.formExample.required),
    )
    .refine(
      (value) => value.length === 0 || value.length >= 3,
      t(($) => $.formExample.invalid),
    );
  const form = useForm({
    formId: "schema-example",
    defaultValues: { text: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: ({ value }) => {
      onSubmit?.(value);
      setSubmitted(true);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="text" validators={{ onDynamic: schema }}>
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <TextField
              isRequired
              validationBehavior="aria"
              isInvalid={isInvalid}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
            >
              <Label>{t(($) => $.formExample.label)}</Label>
              <Input name={field.name} />
              <FieldError>
                {field.state.meta.errors.map((error) => error?.message).join(" ")}
              </FieldError>
            </TextField>
          );
        }}
      </form.Field>
      <Button type="submit">{t(($) => $.formExample.submit)}</Button>
      {submitted && <p role="status">{t(($) => $.formExample.success)}</p>}
    </form>
  );
}
