import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

interface WorkspaceEntryOption {
  id: string;
  name: string;
  disabled?: boolean;
}

export function WorkspaceEntry({
  step,
  options,
  onChoose,
  onBack,
  onAccount,
}: {
  step: "organization" | "center";
  options: WorkspaceEntryOption[];
  onChoose: (id: string) => void;
  onBack?: () => void;
  onAccount: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [choice, setChoice] = useState("");
  const valid = options.some((option) => option.id === choice && !option.disabled);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2 id={id} ref={heading} tabIndex={-1}>
            {step === "organization"
              ? t(($) => $.workspace.entry.organization)
              : t(($) => $.workspace.entry.center)}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby={id}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onChoose(choice);
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">
              {t(($) => $.workspace.entry.instructions)}
            </legend>
            {options.map((option) => (
              <label
                key={option.id}
                className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 has-disabled:text-muted-foreground"
              >
                <input
                  type="radio"
                  name={id}
                  value={option.id}
                  checked={choice === option.id}
                  disabled={option.disabled}
                  onChange={() => setChoice(option.id)}
                />
                <span>{option.name}</span>
                {option.disabled && (
                  <span className="text-sm">{t(($) => $.workspace.entry.closed)}</span>
                )}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            {onBack && (
              <Button type="button" variant="outline" onPress={onBack}>
                {t(($) => $.workspace.entry.back)}
              </Button>
            )}
            <Button type="submit" isDisabled={!valid}>
              {step === "organization"
                ? t(($) => $.workspace.entry.continue)
                : t(($) => $.workspace.entry.openCenter)}
            </Button>
            <Button type="button" variant="ghost" onPress={onAccount}>
              {t(($) => $.workspace.entry.account)}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
