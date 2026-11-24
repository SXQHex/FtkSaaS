import { readTurnstileSiteKey } from "../../lib/public-config";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "compact";
      theme: "auto";
      language: string;
      "response-field": false;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
      "unsupported-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let scriptReady: Promise<Turnstile> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptReady) {
    scriptReady = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement("script");
      const failed = () => {
        clearTimeout(timeout);
        script.remove();
        scriptReady = undefined;
        reject(new Error("TURNSTILE_UNAVAILABLE"));
      };
      const timeout = window.setTimeout(failed, 20_000);
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onerror = failed;
      script.onload = () => {
        if (!window.turnstile) {
          failed();
          return;
        }
        clearTimeout(timeout);
        resolve(window.turnstile);
      };
      document.head.append(script);
    });
  }
  return scriptReady;
}

/** Mounts the provider's real widget; it never generates or validates a proof locally. */
export function PublicTurnstile({ onProof }: { onProof: (proof: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  useEffect(() => {
    const element = container.current;
    const key = readTurnstileSiteKey();
    if (!element || !key) return;
    let active = true;
    let widget: string | undefined;
    let provider: Turnstile | undefined;
    const fail = () => {
      if (active) {
        onProof("");
        setFailed(true);
      }
    };
    void loadTurnstile()
      .then((api) => {
        if (!active) return;
        provider = api;
        widget = api.render(element, {
          sitekey: key,
          action: "public_application",
          size: "compact",
          theme: "auto",
          language: "tr",
          "response-field": false,
          callback: (token) => {
            if (active) {
              onProof(token);
              setFailed(false);
            }
          },
          "expired-callback": fail,
          "error-callback": fail,
          "timeout-callback": fail,
          "unsupported-callback": fail,
        });
      })
      .catch(fail);
    return () => {
      active = false;
      if (widget !== undefined) provider?.remove(widget);
    };
  }, [onProof, retry]);
  return (
    <div className="space-y-2">
      <div ref={container} />
      {failed && (
        <p role="status" className="text-sm">
          {t(($) => $.publicApplication.botError)}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onPress={() => {
          onProof("");
          setFailed(false);
          setRetry((value) => value + 1);
        }}
      >
        {t(($) => $.publicApplication.retryBot)}
      </Button>
    </div>
  );
}
