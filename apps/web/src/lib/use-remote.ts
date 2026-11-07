"use client";
import { useEffect, useState } from "react";
import { flowError } from "../components/bookings/flow-controls";
export function useRemote<T>(load: () => Promise<T>, key: string) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    const life = new AbortController();
    void load()
      .then((data) => {
        if (!life.signal.aborted) setResult({ key, data });
      })
      .catch((e) => {
        if (!life.signal.aborted) setResult({ key, error: flowError(e) });
      });
    return () => life.abort();
  }, [load, key]);
  return result?.key === key ? result : undefined;
}
