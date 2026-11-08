"use client";
import { useState } from "react";
import { contextStorageKey, readRememberedContext, type WorkContext } from "../lib/context";
import { useUserPreferences } from "./user-preferences";
export function useContextPreference(actorId?: string) {
  const preferences = useUserPreferences();
  const [remembered, setRemembered] = useState<WorkContext | null>(() => {
    try {
      return actorId && typeof window !== "undefined"
        ? readRememberedContext(localStorage.getItem(contextStorageKey(actorId)))
        : null;
    } catch {
      return null;
    }
  });
  const [failed, setFailed] = useState(false);
  const preferred = preferences?.remember_context
    ? remembered
    : (preferences?.startup_context ?? null);
  function remember(context: WorkContext) {
    if (!actorId || !preferences?.remember_context) return;
    setRemembered(context);
    try {
      localStorage.setItem(contextStorageKey(actorId), JSON.stringify(context));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  return { preferred, remember, failed, requireChoice: preferences?.remember_context === false };
}
