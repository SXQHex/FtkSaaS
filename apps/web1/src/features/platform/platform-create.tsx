import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, LinkButton } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { studioSetupName } from "../workspace/studio-setup-request";
import { PlatformActionReview } from "./platform-action-review";
import { platformOrganizationsKey } from "./platform-directory";
import { PlatformReadError } from "./platform-read-error";
import {
  confirmProvision,
  createPlatformOrganization,
  findStudioRequest,
  platformEmail,
  provisionIntent,
  readPlatformPlans,
  readProvisionedOrganization,
  readVerifiedPlatformAccount,
  type ProvisioningIntent,
} from "./platform-provisioning";

export function PlatformCreate({
  accountId,
  requestId,
  onDenied,
}: {
  accountId: string;
  requestId?: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLSelectElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<"name" | "email" | "plan">();
  const [lookup, setLookup] = useState<string>();
  const [review, setReview] = useState<ProvisioningIntent>();
  const [createdId, setCreatedId] = useState<string>();
  const source = useQuery({
    queryKey: ["platform-create-source", accountId, requestId],
    queryFn: async () => ({
      plans: await readPlatformPlans(accountId),
      request: requestId ? await findStudioRequest(accountId, requestId) : undefined,
    }),
    retry: false,
    gcTime: 0,
  });
  const owner = useQuery({
    queryKey: ["platform-create-owner", accountId, lookup],
    queryFn: async () =>
      lookup ? ((await readVerifiedPlatformAccount(accountId, lookup)) ?? null) : null,
    enabled: Boolean(lookup),
    retry: false,
    gcTime: 0,
  });
  const request = source.data?.request;
  const currentName = request?.name ?? name;
  const plan = source.data?.plans.find((item) => item.id === planId);
  const ownerId =
    request?.account_id ??
    (lookup === platformEmail.safeParse(email).data && !owner.isError ? owner.data : undefined);
  const title = t(($) => $.platform.create.title);
  function findOwner() {
    const parsed = platformEmail.safeParse(email);
    if (!parsed.success) {
      setError("email");
      emailRef.current?.focus();
      return;
    }
    setError(undefined);
    if (parsed.data === lookup) void owner.refetch();
    else setLookup(parsed.data);
  }
  function prepare() {
    if (!ownerId || source.isFetching || owner.isFetching) return;
    const parsed = studioSetupName.safeParse(currentName);
    if (!parsed.success) {
      setError("name");
      nameRef.current?.focus();
      return;
    }
    if (!plan) {
      setError("plan");
      planRef.current?.focus();
      return;
    }
    setReview(
      provisionIntent({
        accountId,
        name: parsed.data,
        ownerId,
        planId: plan.id,
        requestId,
        email: request ? undefined : lookup,
      }),
    );
  }
  const planLabel = (item: NonNullable<typeof plan>) =>
    t(($) => $.platform.create.planLabel, {
      name: item.name,
      period: t(($) => $.settings.subscriptionPeriods[item.period]),
      currency: item.currency,
    });
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {createdId ? (
          <LinkButton href={"/platform?organization_id=" + createdId}>
            {t(($) => $.platform.create.openCreated)}
          </LinkButton>
        ) : source.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : source.isError ? (
          <PlatformReadError error={source.error} onRetry={() => void source.refetch()} />
        ) : requestId && !request ? (
          <p>{t(($) => $.platform.create.requestMissing)}</p>
        ) : !source.data?.plans.length ? (
          <p>{t(($) => $.platform.create.noPlans)}</p>
        ) : (
          <form
            method="post"
            noValidate
            aria-label={title}
            className="max-w-xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              prepare();
            }}
          >
            <Field>
              <FieldLabel htmlFor={id + "-name"}>{t(($) => $.platform.create.name)}</FieldLabel>
              <Input
                ref={nameRef}
                id={id + "-name"}
                value={currentName}
                readOnly={Boolean(request)}
                maxLength={200}
                required
                aria-invalid={error === "name"}
                aria-describedby={error === "name" ? id + "-name-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(undefined);
                }}
              />
              {error === "name" && (
                <FieldError id={id + "-name-error"}>{t(($) => $.studioSetup.nameError)}</FieldError>
              )}
            </Field>
            {request ? (
              <p>{t(($) => $.platform.create.requestOwner)}</p>
            ) : (
              <Field>
                <FieldLabel htmlFor={id + "-email"}>
                  {t(($) => $.platform.verifiedEmail)}
                </FieldLabel>
                <Input
                  ref={emailRef}
                  id={id + "-email"}
                  type="email"
                  autoComplete="off"
                  value={email}
                  aria-invalid={error === "email"}
                  aria-describedby={error === "email" ? id + "-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLookup(undefined);
                    setError(undefined);
                  }}
                />
                {error === "email" && (
                  <FieldError id={id + "-email-error"}>
                    {t(($) => $.platform.emailError)}
                  </FieldError>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  isDisabled={owner.isFetching}
                  onPress={findOwner}
                >
                  {t(($) => $.platform.findAccount)}
                </Button>
                {lookup &&
                  (owner.isError ? (
                    <PlatformReadError error={owner.error} onRetry={findOwner} />
                  ) : owner.isSuccess ? (
                    <p role="status">
                      {t(($) => (ownerId ? $.platform.accountFound : $.platform.accountMissing))}
                    </p>
                  ) : null)}
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={id + "-plan"}>{t(($) => $.platform.create.plan)}</FieldLabel>
              <NativeSelect
                ref={planRef}
                id={id + "-plan"}
                required
                value={planId}
                aria-invalid={error === "plan"}
                aria-describedby={error === "plan" ? id + "-plan-error" : undefined}
                onChange={(event) => {
                  setPlanId(event.target.value);
                  setError(undefined);
                }}
              >
                <NativeSelectOption value="">
                  {t(($) => $.platform.create.choosePlan)}
                </NativeSelectOption>
                {source.data.plans.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {planLabel(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {error === "plan" && (
                <FieldError id={id + "-plan-error"}>
                  {t(($) => $.platform.create.choosePlan)}
                </FieldError>
              )}
            </Field>
            <Button type="submit" isDisabled={!ownerId || source.isFetching || owner.isFetching}>
              {t(($) => $.platform.create.review)}
            </Button>
          </form>
        )}
      </CardContent>
      {review && plan && (
        <PlatformActionReview
          intent={review}
          title={title}
          description={t(($) => $.platform.create.effect)}
          rows={[
            { id: "name", title: t(($) => $.platform.create.name), detail: review.name },
            {
              id: "owner",
              title: t(($) => $.platform.owner),
              detail: review.email ?? review.ownerId,
            },
            { id: "plan", title: t(($) => $.platform.create.plan), detail: planLabel(plan) },
          ]}
          beforeWrite={confirmProvision}
          write={createPlatformOrganization}
          read={readProvisionedOrganization}
          onResult={async (orgId) => {
            setCreatedId(orgId);
            await client.invalidateQueries({ queryKey: platformOrganizationsKey(accountId) });
          }}
          onClose={() => {
            setReview(undefined);
            if (!createdId) void source.refetch();
          }}
          onDenied={onDenied}
        />
      )}
    </Card>
  );
}
