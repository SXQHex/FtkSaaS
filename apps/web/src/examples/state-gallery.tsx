import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import { StateGalleryView } from "../features/states/state-gallery-view";
import { StateView, StateBanner, type StateKind } from "../features/states/state-view";
export default function StateGallery() {
  const { t } = useTranslation();
  const [motionPaused, setMotionPaused] = useState(false);
  const [conflict, setConflict] = useState(false),
    [banner, setBanner] = useState<"offline" | "readOnly">(),
    [selected, setSelected] = useState<StateKind>(),
    [feedback, setFeedback] = useState<Partial<Record<StateKind, string>>>({});
  const labels = {
    loading: "reload",
    empty: "create",
    noResults: "clear",
    error: "retry",
    offline: "showBanner",
    conflict: "openConflict",
    limit: "inspectLimit",
    forbidden: "openExample",
    readOnly: "showBanner",
    notFound: "openExample",
    expired: "refreshPreview",
    received: "checkResult",
  } as const;
  const confirm = (kind: StateKind) =>
    setFeedback((value) => ({ ...value, [kind]: t(($) => $.states.exampleFeedback) }));
  const actions = Object.fromEntries(
    stateKinds.map((kind) => [
      kind,
      <Button
        key={kind}
        variant="outline"
        size="sm"
        onPress={() => {
          if (kind === "conflict") setConflict(true);
          else if (kind === "offline" || kind === "readOnly") setBanner(kind);
          else if (kind === "forbidden" || kind === "notFound") setSelected(kind);
          else confirm(kind);
        }}
      >
        {t(($) => $.states[labels[kind]])}
      </Button>,
    ]),
  );
  return (
    <main>
      {banner && <StateBanner kind={banner} />}{" "}
      {selected ? (
        <div className="p-4">
          <p className="text-center text-sm text-muted-foreground">
            {t(($) => $.states.exampleOnly)}
          </p>
          <StateView
            kind={selected}
            headingLevel={1}
            actions={
              <Button onPress={() => setSelected(undefined)}>
                {t(($) => $.states.closeExample)}
              </Button>
            }
          />
        </div>
      ) : (
        <StateGalleryView
          motionPaused={motionPaused}
          onMotionPaused={setMotionPaused}
          actions={actions}
          feedback={feedback}
          conflict={conflict}
          onCloseConflict={() => setConflict(false)}
          onReload={() => {
            setConflict(false);
            confirm("conflict");
          }}
        />
      )}
    </main>
  );
}

import { stateKinds } from "../features/states/state-kinds";
