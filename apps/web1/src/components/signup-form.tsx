import { useTranslation } from "react-i18next";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupForm({ className, ...props }: React.ComponentProps<"form">) {
  const { t } = useTranslation();
  return (
    <form className={cn("flex flex-col gap-4", className)} {...props}>
      <FieldGroup className="gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t(($) => $.auth.signupTitle)}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t(($) => $.auth.signupDescription)}
          </p>
        </div>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="name">{t(($) => $.auth.signupName)}</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder={t(($) => $.auth.signupNamePlaceholder)}
            required
            className="bg-background"
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="email">{t(($) => $.auth.email)}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t(($) => $.auth.signupEmailPlaceholder)}
            required
            className="bg-background"
          />
          <FieldDescription>{t(($) => $.auth.signupEmailDescription)}</FieldDescription>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="password">{t(($) => $.auth.password)}</FieldLabel>
          <Input id="password" type="password" required className="bg-background" />
          <FieldDescription>{t(($) => $.auth.signupPasswordRules)}</FieldDescription>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="confirm-password">
            {t(($) => $.auth.signupConfirmPassword)}
          </FieldLabel>
          <Input id="confirm-password" type="password" required className="bg-background" />
          <FieldDescription>{t(($) => $.auth.signupConfirmDescription)}</FieldDescription>
        </Field>
        <Field className="gap-1.5">
          <Button type="submit">{t(($) => $.auth.signupSubmit)}</Button>
        </Field>
        <FieldSeparator>{t(($) => $.auth.signupOr)}</FieldSeparator>
        <Field className="gap-1.5">
          <Button variant="outline" type="button">
            <img src="/google.svg" alt="" className="size-4" />
            {t(($) => $.auth.signupGoogle)}
          </Button>
          <FieldDescription className="px-6 text-center">
            {t(($) => $.auth.signupHaveAccount)} <a href="/login">{t(($) => $.auth.login)}</a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
