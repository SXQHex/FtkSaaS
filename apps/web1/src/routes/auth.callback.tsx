import { createFileRoute, redirect } from "@tanstack/react-router";
import { completeCallback, capturedCallback } from "../features/auth/callback";
import { CallbackPage } from "../features/auth/callback-page";

export const Route = createFileRoute("/auth/callback")({
  staleTime: Infinity,
  loader: async () => {
    let destination: string;
    try {
      destination = await completeCallback(capturedCallback());
    } catch {
      return null;
    }
    throw redirect({ href: destination, replace: true });
  },
  component: CallbackPage,
  errorComponent: CallbackPage,
});
