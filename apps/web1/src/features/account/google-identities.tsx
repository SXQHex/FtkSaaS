import { useState } from "react";
import { CheckIcon } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { readIdentities, linkGoogle, unlinkGoogle } from "./identities";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

function GoogleUnlink({
  identity,
  disabled,
  onChanged,
}: {
  identity: UserIdentity;
  disabled: boolean;
  onChanged: (removedId?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function remove() {
    setPending(true);
    setFailed(false);
    let removedId: string | undefined;
    try {
      await unlinkGoogle(identity);
      removedId = identity.identity_id;
      setOpen(false);
    } catch {
      setFailed(true);
    }
    await onChanged(removedId);
    setPending(false);
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
              void remove();
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
  const queries = useQueryClient();
  const [linking, setLinking] = useState(false);
  const [failed, setFailed] = useState(false);
  const identities = useQuery({
    queryKey: ["account-identities", accountId],
    queryFn: readIdentities,
    staleTime: 0,
  });
  const google = identities.data?.filter((identity) => identity.provider === "google") ?? [];
  async function refresh(removedId?: string) {
    if (removedId)
      queries.setQueryData<UserIdentity[]>(["account-identities", accountId], (current) =>
        current?.filter((identity) => identity.identity_id !== removedId),
      );
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
        identities.data && (
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
                    {identities.data.length < 2 && (
                      <ItemDescription>{t(($) => $.googleIdentity.lastMethod)}</ItemDescription>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <GoogleUnlink
                      identity={identity}
                      disabled={disabled || identities.data.length < 2}
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
