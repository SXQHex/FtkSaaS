"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ContactInput } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import {
  personCreateStorageKey,
  recoverPersonCreate,
  studentError,
  uncertainStudentChange,
  type PendingPersonCreate,
  type StudentActions,
  type StudentScope,
} from "../../lib/students";

const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function PersonCreate({
  scope,
  actions,
  onCreated,
}: {
  scope: StudentScope;
  actions: StudentActions;
  onCreated: (personId: string) => boolean;
}) {
  const t = useTranslations("students");
  const [pending] = useState(() => recoverPersonCreate(scope));
  const [open, setOpen] = useState(pending !== null);
  const [phase, setPhase] = useState<
    "edit" | "saving" | "checking" | "uncertain" | "storageInvalid"
  >(pending === "invalid" ? "storageInvalid" : pending ? "uncertain" : "edit");
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<ContactInput[]>([]);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const storageKey = personCreateStorageKey(scope);
  const command = pending && pending !== "invalid" ? pending.command : null;
  const blocked = pending !== null && (pending === "invalid" || pending.blocked);
  const message = (code: string) =>
    t(t.has(`errors.${code}`) ? `errors.${code}` : "errors.unknown");
  function persist(value: PendingPersonCreate["command"], expired = false) {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ command: value, ...(expired ? { blocked: true } : {}) }),
      );
      return true;
    } catch {
      setPhase("storageInvalid");
      return false;
    }
  }
  function complete(personId: string) {
    if (!onCreated(personId)) {
      setPhase("storageInvalid");
      setError("storageInvalid");
      return false;
    }
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A retained command is safe to resolve by its original key. */
    }
    setOpen(false);
    return true;
  }
  async function send(value: PendingPersonCreate["command"], recovering = false, expired = false) {
    if (locked.current || expired || !persist(value, expired)) return;
    locked.current = true;
    setError("");
    setPhase("saving");
    try {
      const result = await actions.create(value.input);
      if (!mounted.current) return;
      complete(result.primary_id);
    } catch (cause) {
      if (!mounted.current) return;
      const code = studentError(cause);
      if (recovering || uncertainStudentChange(cause)) {
        persist(value, ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code));
        setError(code);
        setPhase("uncertain");
      } else {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Retaining a resolved command is safe. */
        }
        setError(code);
        setPhase("edit");
      }
    } finally {
      locked.current = false;
    }
  }
  async function check(value: PendingPersonCreate["command"]) {
    if (locked.current) return;
    locked.current = true;
    setPhase("checking");
    setError("");
    try {
      const result = await actions.operationResult(
        scope.orgId,
        value.operation,
        value.input.operation_key,
      );
      if (!mounted.current) return;
      if (result.operation !== value.operation || result.key !== value.input.operation_key)
        throw new Error("Unexpected operation status");
      if (result.status === "succeeded" && result.result_reference?.type === "people")
        complete(result.result_reference.id);
      else if (result.status === "failed_final") {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* safe to retain */
        }
        setPhase("edit");
        setError("failedFinal");
      } else {
        const expired = result.status === "result_expired";
        persist(value, expired);
        setError(result.status);
        setPhase("uncertain");
      }
    } catch (cause) {
      if (mounted.current) {
        persist(value);
        setError(studentError(cause));
        setPhase("uncertain");
      }
    } finally {
      locked.current = false;
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (locked.current || phase !== "edit" || !name.trim()) return;
    const value: PendingPersonCreate["command"] = {
      operation: "person_create_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: v7(),
        display_name: name.trim(),
        contacts: contacts
          .filter((contact) => contact.value.trim())
          .map((contact) => ({ ...contact, value: contact.value.trim() })),
      },
    };
    void send(value);
  }
  return (
    <>
      <Button className={buttonClass} onClick={() => setOpen(true)}>
        {t("addPerson")}
      </Button>
      {open && (
        <Sheet
          open
          onOpenChange={(value) => {
            if (!value && phase !== "saving" && phase !== "checking") setOpen(false);
          }}
        >
          <SheetContent className="w-full min-w-0 overflow-y-auto sm:max-w-lg wrap-anywhere">
            <SheetHeader className="pr-12">
              <SheetTitle>{t("addPerson")}</SheetTitle>
              <SheetDescription>{t("createHint")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-5 pb-8">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 p-4 text-sm leading-6"
                >
                  {message(error)}
                </p>
              )}
              {phase === "edit" && (
                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-person-name">{t("name")}</Label>
                    <Input
                      id="new-person-name"
                      required
                      autoComplete="name"
                      maxLength={200}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-medium">{t("contacts")}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={buttonClass}
                          onClick={() =>
                            setContacts((list) => [...list, { kind: "email", value: "" }])
                          }
                        >
                          {t("addEmail")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={buttonClass}
                          onClick={() =>
                            setContacts((list) => [...list, { kind: "phone", value: "" }])
                          }
                        >
                          {t("addPhone")}
                        </Button>
                      </div>
                    </div>
                    {contacts.map((contact, index) => (
                      <div
                        key={`${contact.kind}-${index}`}
                        className="space-y-2 rounded-lg border p-3"
                      >
                        <Label htmlFor={`new-contact-${index}`}>{t(contact.kind)}</Label>
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <Input
                            id={`new-contact-${index}`}
                            type={contact.kind === "email" ? "email" : "tel"}
                            autoComplete={contact.kind === "email" ? "email" : "tel"}
                            required
                            maxLength={320}
                            value={contact.value}
                            onChange={(event) =>
                              setContacts((list) =>
                                list.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, value: event.target.value }
                                    : item,
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
                              setContacts((list) =>
                                list.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                          >
                            {t("removeContact")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{t("createdNotActive")}</p>
                  <Button type="submit" className={buttonClass}>
                    {t("createRecord")}
                  </Button>
                </form>
              )}
              {(phase === "saving" || phase === "checking") && (
                <output className="block text-sm" aria-live="polite">
                  {t(phase)}
                </output>
              )}
              {phase === "uncertain" && command && (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">{t("uncertainHint")}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={buttonClass} onClick={() => void check(command)}>
                      {t("check")}
                    </Button>
                    {!blocked && (
                      <Button
                        variant="outline"
                        className={buttonClass}
                        onClick={() => void send(command, true)}
                      >
                        {t("retrySame")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {phase === "storageInvalid" && (
                <p role="alert" className="text-sm leading-6">
                  {t("storageInvalid")}
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
