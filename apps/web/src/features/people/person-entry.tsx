import { useEffect, useRef, useState } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { JobRef, JobStatusView, PersonView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { PeopleEntrySheet } from "./people-view";
import {
  readPeoplePage,
  createPerson,
  readPerson,
  personCreateIntent,
  personEntrySchema,
  personInvitationIntent,
  sendPersonInvitation,
  readPersonInvitationJob,
  type PeopleScope,
  type PersonCreateIntent,
  type PersonInvitationIntent,
} from "./people";

type Notice =
  | "ready"
  | "creating"
  | "create-unknown"
  | "created-unread"
  | "created"
  | "rejected"
  | "inviting"
  | "invite-unknown"
  | "job-unread"
  | "job";
const definiteRejection = (error: unknown) =>
  error instanceof BackendError && error.code !== "TRANSPORT_ERROR" && !error.retryable;

export function PersonEntry({
  scope,
  open,
  onClose,
  onLockChange,
  onCreated,
  onInvitationReadback,
}: {
  scope: PeopleScope;
  open: boolean;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onCreated: (person: PersonView) => Promise<void>;
  onInvitationReadback?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>("ready");
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState<PersonView>();
  const [job, setJob] = useState<JobRef>();
  const [jobStatus, setJobStatus] = useState<JobStatusView>();
  const createIntent = useRef<PersonCreateIntent | undefined>(undefined);
  const inviteIntent = useRef<PersonInvitationIntent | undefined>(undefined);
  const createdId = useRef<string | undefined>(undefined);
  const jobRef = useRef<JobRef | undefined>(undefined);
  const lock = useRef(false);
  const terminalIdentity = useRef(false);
  const mounted = useRef(true);
  const formElement = useRef<HTMLFormElement>(null);
  const locked = busy || ["create-unknown", "created-unread", "invite-unknown"].includes(notice);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useBlocker({
    shouldBlockFn: () =>
      !terminalIdentity.current &&
      (lock.current || ["create-unknown", "created-unread", "invite-unknown"].includes(notice)),
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  useEffect(() => {
    if (busy || notice === "ready") return;
    const target = notice === "created" ? "people-send-invitation" : "people-entry-notice";
    document.getElementById(target)?.focus();
  }, [busy, notice]);
  const form = useForm({
    formId: "people-entry",
    defaultValues: { name: "", email: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: personEntrySchema({
        name: t(($) => $.studio.nameRequired),
        email: t(($) => $.studio.instructorEmailInvalid),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async ({ value }) => {
      if (locked || person || createdId.current) return;
      createIntent.current = personCreateIntent(scope, value);
      await runCreate();
    },
  });
  function identityLost(error: unknown) {
    const code =
      error instanceof BackendError
        ? error.code
        : error instanceof Error
          ? error.message
          : undefined;
    if (code && ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code)) {
      terminalIdentity.current = true;
      createIntent.current = undefined;
      inviteIntent.current = undefined;
      setNotice("rejected");
      void router.invalidate();
      return true;
    }
    return false;
  }
  async function rereadCreated() {
    const id = createdId.current;
    if (!id) throw new Error("PERSON_ACK_UNAVAILABLE");
    const result = await readPerson(scope, id);
    if (!mounted.current) return;
    const emails = result.contacts?.filter((contact) => contact.kind === "email") ?? [];
    if (emails.length !== 1 || !emails[0]) throw new Error("PERSON_READ_UNAVAILABLE");
    form.setFieldValue("name", result.display_name);
    form.setFieldValue("email", emails[0].value);
    setPerson(result);
    await onCreated(result);
    if (mounted.current) setNotice("created");
  }
  async function runCreate() {
    if (lock.current || !createIntent.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!createdId.current) {
        setNotice("creating");
        createdId.current = await createPerson(createIntent.current);
      }
      if (!mounted.current) return;
      setNotice("created-unread");
      await rereadCreated();
    } catch (error) {
      if (!mounted.current || identityLost(error)) return;
      if (createdId.current) setNotice("created-unread");
      else if (definiteRejection(error)) {
        createIntent.current = undefined;
        setNotice("rejected");
      } else setNotice("create-unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function readJob() {
    const current = jobRef.current;
    if (!current) throw new Error("INVITATION_ACK_UNAVAILABLE");
    const result = await readPersonInvitationJob(scope, current);
    if (result.id !== current.job_id) throw new Error("INVITATION_READ_UNAVAILABLE");
    if (!mounted.current) return;
    // The host refreshes or invalidates its scoped access directories only
    // after the job identity has been verified.
    await onInvitationReadback?.();
    if (mounted.current) {
      setJobStatus(result);
      setNotice("job");
    }
  }
  async function runInvite() {
    if (lock.current || !person || jobRef.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("inviting");
    try {
      if (!inviteIntent.current) inviteIntent.current = personInvitationIntent(scope, person);
      const receipt = await sendPersonInvitation(inviteIntent.current);
      jobRef.current = receipt;
      if (!mounted.current) return;
      setJob(receipt);
      setNotice("job-unread");
      await readJob();
    } catch (error) {
      if (!mounted.current || identityLost(error)) return;
      if (jobRef.current) setNotice("job-unread");
      else if (
        definiteRejection(error) ||
        (error instanceof Error && error.message === "PERSON_EMAIL_UNAVAILABLE")
      ) {
        inviteIntent.current = undefined;
        setNotice("rejected");
      } else setNotice("invite-unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function refresh() {
    if (lock.current) return;
    if (notice === "created-unread") {
      await runCreate();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (jobRef.current) await readJob();
      else if (person) {
        const latest = await readPerson(scope, person.id);
        if (mounted.current) {
          setPerson(latest);
          setNotice("created");
        }
      } else {
        await readPeoplePage(scope, "");
        if (mounted.current) setNotice("ready");
      }
    } catch (error) {
      if (mounted.current && !identityLost(error))
        setNotice(jobRef.current ? "job-unread" : "rejected");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const message =
    notice === "ready"
      ? undefined
      : notice === "creating"
        ? t(($) => $.people.creating)
        : notice === "created"
          ? undefined
          : notice === "create-unknown" || notice === "invite-unknown"
            ? t(($) => $.studio.resourceUnknown)
            : notice === "created-unread"
              ? t(($) => $.people.createdUnread)
              : notice === "rejected"
                ? t(($) => $.people.writeRejected)
                : notice === "inviting"
                  ? t(($) => $.people.inviting)
                  : notice === "job-unread"
                    ? t(($) => $.people.jobUnread)
                    : job
                      ? [
                          t(($) => $.studio.invitationJobStates[jobStatus?.state ?? job.state]),
                          jobStatus?.email_delivery
                            ? t(
                                ($) =>
                                  $.studio.invitationDeliveryStates[
                                    jobStatus.email_delivery!.state
                                  ],
                              )
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : undefined;
  const recovery = [
    "create-unknown",
    "invite-unknown",
    "created-unread",
    "job-unread",
    "job",
    "rejected",
  ].includes(notice) ? (
    <div className="flex flex-wrap gap-2">
      {(notice === "create-unknown" || notice === "invite-unknown") && (
        <Button
          variant="outline"
          isDisabled={busy}
          onPress={() => {
            void (notice === "create-unknown" ? runCreate() : runInvite());
          }}
        >
          {t(($) => $.studio.retrySameRequest)}
        </Button>
      )}
      {["created-unread", "job-unread", "job", "rejected"].includes(notice) && (
        <Button
          variant="outline"
          isDisabled={busy}
          onPress={() => {
            void refresh();
          }}
        >
          {t(($) => $.people.refresh)}
        </Button>
      )}
    </div>
  ) : undefined;
  return (
    <form.Field name="name">
      {(nameField) => (
        <form.Field name="email">
          {(emailField) => (
            <form.Subscribe selector={(state) => state}>
              {(state) => (
                <PeopleEntrySheet
                  open={open}
                  onClose={onClose}
                  name={state.values.name}
                  email={state.values.email}
                  onName={nameField.handleChange}
                  onEmail={emailField.handleChange}
                  onNameBlur={nameField.handleBlur}
                  onEmailBlur={emailField.handleBlur}
                  nameError={
                    nameField.state.meta.isTouched
                      ? nameField.state.meta.errors[0]?.message
                      : undefined
                  }
                  emailError={
                    emailField.state.meta.isTouched
                      ? emailField.state.meta.errors[0]?.message
                      : undefined
                  }
                  formRef={formElement}
                  onSubmit={
                    notice === "ready"
                      ? () => {
                          void form.handleSubmit();
                        }
                      : undefined
                  }
                  personCreated={Boolean(person)}
                  onSendInvitation={
                    person && !job && notice === "created"
                      ? () => {
                          void runInvite();
                        }
                      : undefined
                  }
                  busy={busy}
                  locked={locked}
                  invitationNotice={message}
                  recoveryActions={recovery}
                />
              )}
            </form.Subscribe>
          )}
        </form.Field>
      )}
    </form.Field>
  );
}
