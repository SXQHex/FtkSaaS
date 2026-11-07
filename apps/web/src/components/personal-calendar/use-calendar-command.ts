"use client";
import { useEffect, useRef, useState } from "react";
import { ApiFailure } from "../../lib/api";
import {
  calendarStorageKey,
  personalCalendarApi,
  readCalendarPending,
  type CalendarCommand,
} from "../../lib/personal-calendar";
import { flowError } from "../bookings/flow-controls";
export function useCalendarCommand(actorId: string, onSaved: () => void) {
  const [pending, setPending] = useState(() => readCalendarPending(actorId)),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState("");
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = calendarStorageKey(actorId);
  function owns(expected: typeof pending) {
    if (JSON.stringify(readCalendarPending(actorId)) !== JSON.stringify(expected))
      throw Error("storageChanged");
  }
  async function run(command?: CalendarCommand) {
    if (lock.current || pending === "invalid") return;
    const c = pending ?? command;
    if (!c) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setUrl("");
    let sent = false;
    try {
      owns(pending);
      sessionStorage.setItem(key, JSON.stringify(c));
      setPending(c);
      sent = true;
      const result = await personalCalendarApi.write(c, actorId);
      if (!mounted.current) return;
      owns(c);
      sessionStorage.removeItem(key);
      setPending(null);
      setUrl(
        "subscription_url" in result && typeof result.subscription_url === "string"
          ? result.subscription_url
          : "",
      );
      setMessage("saved");
      onSaved();
    } catch (e) {
      if (!mounted.current) return;
      if (
        sent &&
        !pending &&
        e instanceof ApiFailure &&
        !e.failure.error.retryable &&
        ![
          "OPERATION_IN_PROGRESS",
          "OPERATION_RESULT_EXPIRED",
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
        ].includes(e.failure.error.code)
      ) {
        try {
          owns(c);
          sessionStorage.removeItem(key);
          setPending(null);
        } catch {
          setPending("invalid");
        }
      }
      setMessage(flowError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function check() {
    if (lock.current || !pending || pending === "invalid") return;
    lock.current = true;
    setBusy(true);
    try {
      owns(pending);
      const s = await personalCalendarApi.status(pending);
      if (!mounted.current) return;
      owns(pending);
      if (s.operation !== pending.operation || s.key !== pending.input.operation_key)
        throw Error("invalidCalendarLinks");
      if (s.status === "succeeded" && pending.operation !== "calendar_link_revoke_v1") {
        setMessage("credentialAvailable");
      } else if (s.status === "succeeded" || s.status === "failed_final") {
        sessionStorage.removeItem(key);
        setPending(null);
        setMessage(s.status === "succeeded" ? "saved" : "failed");
        onSaved();
      } else setMessage("uncertain");
    } catch (e) {
      if (mounted.current) setMessage(flowError(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { pending, busy, message, url, run, check, clearUrl: () => setUrl("") };
}
