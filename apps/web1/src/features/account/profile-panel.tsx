import { CheckIcon } from "lucide-react";
import { useRef, useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { readProfile, saveProfile, profileChange, type ProfileSnapshot } from "./profile";
import { EmailChange } from "./email-change";
import { ProfilePhotoRow } from "./profile-photo-row";
import type { PhotoDraft } from "./profile-photo";
import { BackendError } from "../../lib/backend";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

export function ProfilePanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useQuery({
    queryKey: ["account-profile", accountId],
    queryFn: () => readProfile(accountId),
  });
  async function refresh() {
    const result = await profile.refetch({ throwOnError: true });
    if (!result.data) throw new Error("PROFILE_UNAVAILABLE");
    await router.invalidate();
    return result.data;
  }
  if (profile.isPending) return <Skeleton className="h-80 w-full" />;
  if (!profile.data)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t(($) => $.profile.readError)}{" "}
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              void profile.refetch();
            }}
          >
            {t(($) => $.auth.retry)}
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (
    <ProfileForm
      key={accountId}
      latest={profile.data}
      backgroundError={profile.isError}
      onRefresh={refresh}
    />
  );
}

type Notice = "clean" | "saved" | "unknown" | "conflict" | "saved-unread";
export function ProfileForm({
  latest,
  onRefresh,
  backgroundError = false,
}: {
  latest: ProfileSnapshot;
  backgroundError?: boolean;
  onRefresh: () => Promise<ProfileSnapshot>;
}) {
  const { t } = useTranslation();
  const [base, setBase] = useState(latest);
  const [notice, setNotice] = useState<Notice>("clean");
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft>(undefined);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [writeKnown, setWriteKnown] = useState(false);
  const intent = useRef<{ signature: string; key: string } | undefined>(undefined);
  async function refresh(reset: boolean) {
    setReading(true);
    setReadFailed(false);
    try {
      const next = await onRefresh();
      if (reset) {
        setBase(next);
        form.reset(next.values);
        setPhotoDraft(undefined);
        intent.current = undefined;
        setWriteKnown(false);
      }
      return next;
    } catch {
      setReadFailed(true);
      return undefined;
    } finally {
      setReading(false);
    }
  }
  const form = useForm({
    defaultValues: base.values,
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      if (writeKnown || preparingPhoto) return;
      const photo = photoDraft === null ? null : photoDraft?.upload;
      setNotice("clean");
      const signature = JSON.stringify({
        version: base.version,
        change: profileChange(value),
        photo,
      });
      if (intent.current?.signature !== signature) intent.current = { signature, key: uuidv7() };
      try {
        await saveProfile(value, base.version, intent.current.key, photo);
        setWriteKnown(true);
      } catch (error) {
        setNotice(
          error instanceof BackendError && error.code === "VERSION_CONFLICT"
            ? "conflict"
            : "unknown",
        );
        await refresh(false);
        return;
      }
      setNotice((await refresh(true)) ? "saved" : "saved-unread");
    },
  });
  const optionalName = z.string().refine(
    (value) => Array.from(value.trim()).length <= 100,
    t(($) => $.profile.nameLength),
  );
  const fields = [
    {
      name: "givenName",
      label: t(($) => $.profile.givenName),
      autocomplete: "given-name",
      validator: optionalName,
    },
    {
      name: "familyName",
      label: t(($) => $.profile.familyName),
      autocomplete: "family-name",
      validator: optionalName,
    },
    {
      name: "displayName",
      label: t(($) => $.auth.displayName),
      autocomplete: "nickname",
      validator: z
        .string()
        .trim()
        .min(
          1,
          t(($) => $.profile.displayRequired),
        ),
    },
    {
      name: "phone",
      label: t(($) => $.profile.contactPhone),
      autocomplete: "tel",
      validator: z
        .string()
        .trim()
        .refine(
          (value) => !value || /^\+[1-9][0-9]{7,14}$/.test(value),
          t(($) => $.profile.phoneInvalid),
        ),
    },
  ] as const;
  const stale = latest.version > base.version;
  const identity = (latest.version >= base.version ? latest : base).account.identity;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.security.profile)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.profile.description)}</CardDescription>
        </CardHeader>
        <CardContent className="pb-0.5">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <>
                <ProfilePhotoRow
                  accountId={base.account.id}
                  asset={base.photo}
                  name={base.values.displayName}
                  draft={photoDraft}
                  onChange={(draft) => {
                    setPhotoDraft(draft);
                    if (notice === "saved") setNotice("clean");
                  }}
                  disabled={submitting || reading || writeKnown || preparingPhoto}
                  onBusy={setPreparingPhoto}
                />
                <FieldGroup className="grid gap-x-4 gap-y-3 min-[901px]:grid-cols-3">
                  {fields.map((descriptor) => (
                    <form.Field
                      key={descriptor.name}
                      name={descriptor.name}
                      validators={{ onDynamic: descriptor.validator }}
                    >
                      {(field) => (
                        <Field
                          className="gap-1 pb-1"
                          data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        >
                          <FieldLabel
                            className="w-full flex-wrap items-center"
                            htmlFor={`profile-${descriptor.name}`}
                          >
                            {descriptor.label}
                            {descriptor.name === "phone" && (
                              <Badge variant="hint" className="ml-auto">
                                {t(($) => $.profile.unverified)}
                              </Badge>
                            )}
                          </FieldLabel>
                          <Input
                            id={`profile-${descriptor.name}`}
                            name={descriptor.name}
                            type={descriptor.name === "phone" ? "tel" : "text"}
                            autoComplete={descriptor.autocomplete}
                            value={field.state.value}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                              if (notice === "saved") setNotice("clean");
                            }}
                            onBlur={field.handleBlur}
                            disabled={submitting || reading || writeKnown || preparingPhoto}
                            aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                            aria-describedby={
                              field.state.meta.errors.length
                                ? `profile-${descriptor.name}-error`
                                : undefined
                            }
                          />
                          <FieldError
                            id={`profile-${descriptor.name}-error`}
                            errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                          />
                        </Field>
                      )}
                    </form.Field>
                  ))}
                  {identity && (
                    <Field className="gap-1 pb-1 min-[901px]:col-span-2">
                      <FieldLabel className="w-full flex-wrap items-center" htmlFor="profile-email">
                        {t(($) => $.auth.email)}
                        {identity.email && identity.email_verified_at && (
                          <Badge variant="success" className="ml-auto">
                            <CheckIcon data-icon="inline-start" />
                            {t(($) => $.profile.verified)}
                          </Badge>
                        )}
                      </FieldLabel>
                      <Input
                        id="profile-email"
                        type="email"
                        readOnly
                        value={identity.email ?? ""}
                      />
                      <EmailChange
                        disabled={submitting || reading || writeKnown || preparingPhoto}
                        onRefresh={async () => (await refresh(false))?.account.identity}
                      />
                      {identity.pending_email && (
                        <FieldDescription>
                          {t(($) => $.profile.pendingEmail, { value: identity.pending_email })}
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                  {identity && (identity.phone || identity.pending_phone) && (
                    <Field className="gap-1">
                      <FieldLabel
                        className="w-full flex-wrap items-center"
                        htmlFor="profile-native-phone"
                      >
                        {t(($) => $.profile.accountPhone)}
                      </FieldLabel>
                      <Input
                        id="profile-native-phone"
                        type="tel"
                        readOnly
                        value={identity.phone ?? ""}
                      />
                      {identity.pending_phone && (
                        <FieldDescription>
                          {t(($) => $.profile.pendingPhone, { value: identity.pending_phone })}
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                </FieldGroup>
              </>
            )}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <>
                {(stale || notice === "conflict") && (
                  <Alert>
                    <AlertDescription>
                      {t(($) => $.profile.conflict)}{" "}
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={reading || preparingPhoto || submitting}
                        onPress={() => {
                          void refresh(true).then((ok) => {
                            if (ok) setNotice("clean");
                          });
                        }}
                      >
                        {t(($) => $.profile.loadCurrent)}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {notice === "unknown" && (
                  <Alert variant="destructive">
                    <AlertDescription>{t(($) => $.profile.writeUnknown)}</AlertDescription>
                  </Alert>
                )}
                {(readFailed || backgroundError || notice === "saved-unread") && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {writeKnown
                        ? t(($) => $.profile.savedReadError)
                        : t(($) => $.profile.readError)}{" "}
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={reading || preparingPhoto || submitting}
                        onPress={() => {
                          const reset = writeKnown;
                          void refresh(reset).then((ok) => {
                            if (ok && reset) setNotice("saved");
                          });
                        }}
                      >
                        {t(($) => $.auth.retry)}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </form.Subscribe>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-x-3 gap-y-2 pt-3!">
          <form.Subscribe
            selector={(state) => ({ dirty: state.isDirty, pending: state.isSubmitting })}
          >
            {({ dirty: textDirty, pending }) => {
              const dirty = textDirty || photoDraft !== undefined;
              return (
                <>
                  <span role="status" className="text-[13px] text-muted-foreground">
                    {notice === "saved"
                      ? t(($) => $.profile.saved)
                      : notice === "clean"
                        ? dirty
                          ? t(($) => $.profile.unsaved)
                          : t(($) => $.profile.unchanged)
                        : ""}
                  </span>
                  <div className="flex max-w-full flex-wrap gap-2">
                    <Button
                      variant="outline"
                      isDisabled={pending || reading || writeKnown || preparingPhoto || !dirty}
                      onPress={() => {
                        form.reset(base.values);
                        setPhotoDraft(undefined);
                        if (notice !== "conflict") setNotice("clean");
                      }}
                    >
                      {t(($) => $.security.cancel)}
                    </Button>
                    <Button
                      type="submit"
                      isDisabled={
                        pending ||
                        preparingPhoto ||
                        reading ||
                        writeKnown ||
                        !dirty ||
                        notice === "conflict" ||
                        (stale && notice !== "unknown")
                      }
                    >
                      {t(($) => $.profile.save)}
                    </Button>
                  </div>
                </>
              );
            }}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
}
