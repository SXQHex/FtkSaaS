import { useEffect, useRef } from "react";
import { useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { StateView } from "./state-view";
import { routeErrorState } from "./route-state";
export function RouteNotFoundPage() {
  const { t } = useTranslation(),
    main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);
  return (
    <main
      ref={main}
      className="mx-auto flex min-h-[50dvh] w-full max-w-2xl items-center p-4 [&_h1]:outline-none [&_h1]:focus-visible:underline"
    >
      <StateView
        kind="notFound"
        headingLevel={1}
        actions={
          <>
            <LinkButton href="/account">{t(($) => $.states.home)}</LinkButton>
            <LinkButton href="/help" variant="outline">
              {t(($) => $.states.help)}
            </LinkButton>
          </>
        }
      />
    </main>
  );
}
export function RouteErrorPage({
  error,
  inPanel = false,
}: ErrorComponentProps & { inPanel?: boolean }) {
  const Container = inPanel ? "div" : "main";
  const { t } = useTranslation(),
    router = useRouter(),
    main = useRef<HTMLElement>(null);
  const loading = useRouterState({ select: (state) => state.isLoading });
  const { reset: resetQueryError } = useQueryErrorResetBoundary();
  const state = routeErrorState(error);
  useEffect(() => {
    resetQueryError();
    main.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [error, resetQueryError]);
  async function reload() {
    const errorPage = main.current;
    const locationKey = router.state.location.state.__TSR_key;
    resetQueryError();
    await router.invalidate();
    if (
      errorPage?.isConnected ||
      router.state.location.state.__TSR_key !== locationKey ||
      document.activeElement !== document.body
    )
      return;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }
  return (
    <Container
      ref={(element) => {
        main.current = element;
      }}
      className="mx-auto flex min-h-[50dvh] w-full max-w-2xl items-center p-4 [&_h1]:outline-none [&_h1]:focus-visible:underline"
    >
      <StateView
        kind={state.kind}
        headingLevel={1}
        traceId={state.traceId}
        actions={
          <>
            {(state.retryable || state.kind === "conflict" || state.kind === "expired") && (
              <Button
                isDisabled={loading}
                onPress={() => {
                  void reload();
                }}
              >
                {state.retryable ? t(($) => $.states.retry) : t(($) => $.states.reload)}
              </Button>
            )}
            <LinkButton href="/account" variant="outline">
              {t(($) => $.states.home)}
            </LinkButton>
            <LinkButton href="/help" variant="outline">
              {t(($) => $.states.help)}
            </LinkButton>
          </>
        }
      />
    </Container>
  );
}
export function RoutePendingPage() {
  return (
    <main className="mx-auto mt-10 w-full max-w-2xl p-4">
      <StateView kind="loading" headingLevel={1} />
    </main>
  );
}

export function PanelError(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} inPanel />;
}

export function PanelPending() {
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl p-4">
      <StateView kind="loading" headingLevel={1} />
    </div>
  );
}
