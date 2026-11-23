import { v7 as uuidv7 } from "uuid";
import { getBackend, queryBackendRead } from "../../lib/backend";
import type { RequestAccountProfileUpdate, SettingsImageUpload } from "@ftksaas/api-contracts";
import { readAccount } from "../../lib/account";
import { scopedBackend } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import { sameNativeSession } from "../auth/native-session-id";

export interface ProfileValues {
  displayName: string;
  givenName: string;
  familyName: string;
  phone: string;
}

export async function readProfile(
  accountId: string,
  readVerifiedAccount: (bearer: string) => ReturnType<typeof readAccount> = (bearer) =>
    readAccount(false, bearer),
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const auth = getSupabaseClient().auth;
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const session = data.session;
  async function confirmSession() {
    signal?.throwIfAborted();
    const latest = await auth.getSession();
    if (latest.error) throw latest.error;
    if (!latest.data.session || !sameNativeSession(session, latest.data.session))
      throw new Error("ACCOUNT_CHANGED");
    signal?.throwIfAborted();
  }
  const [account, page] = await Promise.all([
    readVerifiedAccount(session.access_token),
    queryBackendRead(
      getBackend(session.access_token),
      "management_state_get_v1",
      {
        client_api_version: 1,
        request_id: uuidv7(),
        operation: "account_profile_update_v1",
        selector: { operation: "account_profile_update_v1", key: {} },
      },
      signal,
    ),
  ]).catch(async (failure: unknown) => {
    await confirmSession();
    throw failure;
  });
  await confirmSession();
  const matches = page.items.filter(
    (item) => item.entity?.type === "accounts" && item.entity.id === accountId,
  );
  const item = matches[0];
  if (
    account.id !== accountId ||
    matches.length !== 1 ||
    !item.exists ||
    item.current?.operation !== "account_profile_update_v1"
  )
    throw new Error("PROFILE_UNAVAILABLE");
  const versions = item.versions.filter(
    (version) => version.entity.type === "accounts" && version.entity.id === accountId,
  );
  const version = versions[0]?.version;
  const values = item.current.values;
  if (
    versions.length !== 1 ||
    !Number.isSafeInteger(version) ||
    !version ||
    version < 1 ||
    typeof values.display_name !== "string" ||
    values.given_name === undefined ||
    values.family_name === undefined ||
    values.unverified_phone === undefined ||
    values.photo === undefined
  )
    throw new Error("PROFILE_UNAVAILABLE");
  return {
    account,
    photo: values.photo,
    version,
    values: {
      displayName: values.display_name,
      givenName: values.given_name ?? "",
      familyName: values.family_name ?? "",
      phone: values.unverified_phone ?? "",
    },
  };
}

type ProfileChange = Pick<
  RequestAccountProfileUpdate,
  "display_name" | "given_name" | "family_name" | "unverified_phone" | "photo"
>;

export function profileChange(
  values: ProfileValues,
  variant: "account" | "member",
  photo?: SettingsImageUpload | null,
): ProfileChange {
  return {
    display_name: values.displayName.trim(),
    unverified_phone: values.phone.trim() || null,
    ...(variant === "account" && {
      given_name: values.givenName.trim() || null,
      family_name: values.familyName.trim() || null,
      ...(photo !== undefined ? { photo } : {}),
    }),
  };
}

export async function saveProfile(
  accountId: string,
  change: ProfileChange,
  version: number,
  operationKey: string,
) {
  const backend = await scopedBackend({ accountId });
  return backend.call("account_profile_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    operation_key: operationKey,
    expected_version: version,
    ...change,
  });
}
export type ProfileSnapshot = Awaited<ReturnType<typeof readProfile>>;
