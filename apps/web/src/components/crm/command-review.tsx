"use client";
import type { ReactNode } from "react";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { ConfirmWrite } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
export function CommandReview({
  scope,
  slot,
  command,
  onDone,
  onBack,
  children,
}: {
  scope: SetupScope;
  slot: string;
  command: SetupCommand | null;
  onDone: () => void;
  onBack: () => void;
  children: ReactNode;
}) {
  const controller = useSetupCommand(scope, slot, onDone, onBack);
  return (
    <>
      <SetupFeedback command={controller} />
      {command && !controller.pending && (
        <ConfirmWrite
          key={JSON.stringify(command)}
          command={command}
          controller={controller}
          onBack={onBack}
        >
          {children}
        </ConfirmWrite>
      )}
    </>
  );
}
