"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ContactInput, PersonView } from "@ftksaas/api-contracts";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  personUpdateStorageKey,
  recoverPersonUpdate,
  studentError,
  uncertainStudentChange,
  type PendingPersonUpdate,
  type StudentActions,
  type StudentScope,
} from "../../lib/students";

type Stage = "idle" | "edit" | "saving" | "checking" | "uncertain" | "success" | "storageInvalid";
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";

export function PersonEdit({
  scope,
  personId,
  person,
  actions,
  onSaved,
}: {
  scope: StudentScope;
  personId: string;
  person: PersonView | undefined;
  actions: StudentActions;
  onSaved: () => void;
}) {
  const t = useTranslations("students");
  const [stage, setStage] = useState<Stage>(() => {
    const pending = recoverPersonUpdate(scope, personId);
    return pending === "invalid" ? "storageInvalid" : pending ? "uncertain" : "idle";
  });
  const [error, setError] = useState("");
  const [name, setName] = useState(person?.display_name ?? "");
  const [contacts, setContacts] = useState<ContactInput[]>(
    () => person?.contacts?.map(({ kind, value }) => ({ kind, value })) ?? [],
  );
  const locked = useRef(false);
  const mounted = useRef(true);
  const storageKey = personUpdateStorageKey(scope, personId);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const recovered = recoverPersonUpdate(scope, personId);
  const pending = recovered && recovered !== "invalid" ? recovered : null;
  const message = (code: string) =>
    t(t.has(`errors.${code}`) ? `errors.${code}` : "errors.unknown");
  function persist(command: PendingPersonUpdate["command"], blocked?: boolean) {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ command, ...(blocked ? { blocked: true } : {}) }),
      );
      return true;
    } catch {
      setStage("storageInvalid");
      return false;
    }
  }
  function unresolved(command: PendingPersonUpdate["command"], code: string, blocked?: boolean) {
    if (persist(command, blocked)) {
      setError(code);
      setStage("uncertain");
    }
  }
  function clear() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A retained receipt remains safe to check. */
    }
  }
  async function send(
    command: PendingPersonUpdate["command"],
    recovering = false,
    blocked?: boolean,
  ) {
    if (locked.current || blocked || !persist(command)) return;
    locked.current = true;
    setError("");
    setStage("saving");
    try {
      await actions.update(command.input);
      if (!mounted.current) return;
      clear();
      setStage("success");
      onSaved();
    } catch (cause) {
      if (!mounted.current) return;
      const code = studentError(cause);
      if (recovering || uncertainStudentChange(cause))
        unresolved(
          command,
          code,
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code),
        );
      else {
        clear();
        setError(code);
        setStage("edit");
      }
    } finally {
      locked.current = false;
    }
  }
  async function check(command: PendingPersonUpdate["command"]) {
    if (locked.current) return;
    locked.current = true;
    setStage("checking");
    setError("");
    try {
      const result = await actions.operationStatus(
        scope.orgId,
        command.operation,
        command.input.operation_key,
      );
      if (!mounted.current) return;
      if (result.operation !== command.operation || result.key !== command.input.operation_key)
        throw new Error("Unexpected operation status");
      if (
        result.status === "succeeded" &&
        result.result_reference?.type === "people" &&
        result.result_reference.id === command.input.person_id
      ) {
        clear();
        setStage("success");
        onSaved();
      } else if (result.status === "failed_final") {
        clear();
        setError("failedFinal");
        setStage("edit");
      } else unresolved(command, result.status, result.status === "result_expired");
    } catch (cause) {
      if (mounted.current) unresolved(command, studentError(cause));
    } finally {
      locked.current = false;
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!person || locked.current || stage !== "edit") return;
    const patch: { display_name?: string; contacts?: ContactInput[] } = {};
    if (name.trim() !== person.display_name) patch.display_name = name.trim();
    const originalContacts = person.contacts?.map(({ kind, value }) => ({ kind, value }));
    const contactSort = (items: ContactInput[]) =>
      [...items].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
    if (
      originalContacts &&
      JSON.stringify(contactSort(contacts)) !== JSON.stringify(contactSort(originalContacts))
    )
      patch.contacts = contacts;
    if (!Object.keys(patch).length) {
      setError("noChanges");
      return;
    }
    const command: PendingPersonUpdate["command"] = {
      operation: "person_update_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: person.id,
        expected_version: person.version,
        operation_key: v7(),
        patch,
      },
    };
    void send(command);
  }
  if (stage === "idle" && !person) return null;
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-6 wrap-anywhere"
      aria-label={t("editProfile")}
    >
      <h3 className="font-semibold">{t("editProfile")}</h3>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm leading-6">
          {message(error)}
        </p>
      )}
      {stage === "idle" && person && (
        <Button variant="outline" className={buttonClass} onClick={() => setStage("edit")}>
          {t("editProfile")}
        </Button>
      )}
      {stage === "edit" && person && (
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="person-edit-name">{t("name")}</Label>
            <Input
              id="person-edit-name"
              autoComplete="name"
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {person.contacts !== undefined ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-medium">{t("contacts")}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={buttonClass}
                    onClick={() => setContacts((list) => [...list, { kind: "email", value: "" }])}
                  >
                    {t("addEmail")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={buttonClass}
                    onClick={() => setContacts((list) => [...list, { kind: "phone", value: "" }])}
                  >
                    {t("addPhone")}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{t("contactEditHint")}</p>
              {contacts.map((contact, index) => (
                <div key={`${contact.kind}-${index}`} className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor={`person-contact-${index}`}>{t(contact.kind)}</Label>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Input
                      id={`person-contact-${index}`}
                      type={contact.kind === "email" ? "email" : "tel"}
                      autoComplete={contact.kind === "email" ? "email" : "tel"}
                      required
                      maxLength={320}
                      value={contact.value}
                      onChange={(event) =>
                        setContacts((list) =>
                          list.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, value: event.target.value } : item,
                          ),
                        )
                      }
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className={buttonClass}
                      onClick={() =>
                        setContacts((list) => list.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      {t("removeContact")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">{t("contactsNotShared")}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" className={buttonClass}>
              {t("saveProfile")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={buttonClass}
              onClick={() => {
                setName(person.display_name);
                setContacts(person.contacts?.map(({ kind, value }) => ({ kind, value })) ?? []);
                setError("");
                setStage("idle");
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {(stage === "saving" || stage === "checking") && (
        <output className="block text-sm" aria-live="polite">
          {t(stage)}
        </output>
      )}
      {stage === "uncertain" && pending && (
        <div className="space-y-4">
          <p className="font-medium">{t("uncertain")}</p>
          <p className="text-sm leading-6 text-muted-foreground">{t("uncertainHint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button className={buttonClass} onClick={() => void check(pending.command)}>
              {t("check")}
            </Button>
            {!pending.blocked && (
              <Button
                variant="outline"
                className={buttonClass}
                onClick={() => void send(pending.command, true)}
              >
                {t("retrySame")}
              </Button>
            )}
          </div>
        </div>
      )}
      {stage === "success" && (
        <div className="space-y-4">
          <output className="block font-medium" aria-live="polite">
            {t("profileSaved")}
          </output>
          <Button className={buttonClass} onClick={onSaved}>
            {t("refreshProfile")}
          </Button>
        </div>
      )}
      {stage === "storageInvalid" && (
        <p role="alert" className="text-sm leading-6">
          {t("storageInvalid")}
        </p>
      )}
    </section>
  );
}
