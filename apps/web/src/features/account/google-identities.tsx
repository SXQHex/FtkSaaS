import { useState } from "react";
import { CheckIcon } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { capturePrivateReadback } from "../../lib/cache-invalidation";
import { readIdentities, linkGoogle, unlinkGoogle } from "./identities";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@ftksaas/ui/components/dialog";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Skeleton } from "@ftksaas/ui/components/skeleton";

function GoogleUnlink({
  identity,
  disabled,
  onChanged,
}: {
  identity: UserIdentity;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function remove() {
    setPending(true);
    setFailed(false);
    const assertCurrent = capturePrivateReadback(queries);
    try {
      try {
        await unlinkGoogle(identity);
        assertCurrent();
        setOpen(false);
      } catch {
        assertCurrent();
        setFailed(true);
      }
      await onChanged();
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        isDisabled={disabled || pending}
        onPress={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        {t(($) => $.googleIdentity.unlink)}
      </Button>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        isDismissable={!pending}
        isKeyboardDismissDisabled={pending}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.googleIdentity.unlinkTitle)}</DialogTitle>
          <DialogDescription>
            {typeof identity.identity_data?.email === "string"
              ? t(($) => $.googleIdentity.unlinkNamedDescription, {
                  email: identity.identity_data.email,
                })
              : t(($) => $.googleIdentity.unlinkDescription)}
          </DialogDescription>
        </DialogHeader>
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.googleIdentity.unlinkError)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" isDisabled={pending} onPress={() => setOpen(false)}>
            {t(($) => $.security.cancel)}
          </Button>
          <Button
            variant="destructive"
            isDisabled={pending || disabled}
            onPress={() => {
              void remove().catch(() => {});
            }}
          >
            {t(($) => $.googleIdentity.confirm)}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
export function GoogleIdentities({
  accountId,
  onChanged,
}: {
  accountId: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);
  const [failed, setFailed] = useState(false);
  const identities = useQuery({
    queryKey: ["account-identities", accountId],
    queryFn: readIdentities,
    staleTime: 0,
  });
  const current = identities.isError ? undefined : identities.data;
  const google = current?.filter((identity) => identity.provider === "google") ?? [];
  async function refresh() {
    await Promise.all([identities.refetch(), onChanged()]);
  }
  async function link() {
    setLinking(true);
    setFailed(false);
    try {
      await linkGoogle();
    } catch {
      setFailed(true);
    } finally {
      setLinking(false);
    }
  }
  const disabled = identities.isError || identities.isFetching || linking;
  return (
    <>
      {identities.isPending ? (
        <Skeleton role="listitem" className="h-16 w-full" />
      ) : (
        current && (
          <>
            {google.length ? (
              google.map((identity) => (
                <Item role="listitem" className="px-0 py-3" key={identity.identity_id}>
                  <ItemContent className="min-w-0 basis-full sm:basis-auto">
                    <ItemTitle>
                      {t(($) => $.googleIdentity.title)}{" "}
                      <Badge variant="success">
                        <CheckIcon data-icon="inline-start" />
                        {t(($) => $.googleIdentity.linked)}
                      </Badge>
                    </ItemTitle>
                    <ItemDescription>{t(($) => $.googleIdentity.description)}</ItemDescription>
                    {typeof identity.identity_data?.email === "string" && (
                      <ItemDescription>{identity.identity_data.email}</ItemDescription>
                    )}
                    {current.length < 2 && (
                      <ItemDescription>{t(($) => $.googleIdentity.lastMethod)}</ItemDescription>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <GoogleUnlink
                      identity={identity}
                      disabled={disabled || current.length < 2}
                      onChanged={refresh}
                    />
                  </ItemActions>
                </Item>
              ))
            ) : (
              <Item role="listitem" className="px-0 py-3">
                <ItemContent className="min-w-0 basis-full sm:basis-auto">
                  <ItemTitle>
                    {t(($) => $.googleIdentity.title)}{" "}
                    <Badge variant="secondary">{t(($) => $.googleIdentity.unlinked)}</Badge>
                  </ItemTitle>
                  <ItemDescription>{t(($) => $.googleIdentity.description)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={disabled}
                    onPress={() => {
                      void link();
                    }}
                  >
                    {t(($) => $.googleIdentity.link)}
                  </Button>
                </ItemActions>
              </Item>
            )}
          </>
        )
      )}
      {(identities.isError || failed) && (
        <Item role="listitem" className="px-0 py-3">
          <Alert variant="destructive">
            <AlertDescription>
              {identities.isError
                ? t(($) => $.googleIdentity.readError)
                : t(($) => $.googleIdentity.linkError)}{" "}
              {identities.isError && identities.data && (
                <Button variant="outline" size="sm" isDisabled>
                  {t(($) => $.googleIdentity.link)}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                isDisabled={identities.isFetching || linking}
                onPress={() => {
                  if (identities.isError) void identities.refetch();
                  else void link();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        </Item>
      )}
    </>
  );
}
