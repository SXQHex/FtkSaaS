import { v7 as uuidv7 } from "uuid";
import { getBackend } from "../../lib/backend";
import type { SettingsImageUpload } from "../../lib/api-contracts/generated";
import { readAccount } from "../../lib/account";

export interface ProfileValues {
  displayName: string;
  givenName: string;
  familyName: string;
  phone: string;
}

export async function readProfile(accountId: string) {
  const [account, page] = await Promise.all([
    readAccount(),
    getBackend().call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      operation: "account_profile_update_v1",
      selector: { operation: "account_profile_update_v1", key: {} },
    }),
  ]);
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

export function profileChange(values: ProfileValues) {
  return {
    display_name: values.displayName.trim(),
    given_name: values.givenName.trim() || null,
    family_name: values.familyName.trim() || null,
    unverified_phone: values.phone.trim() || null,
  };
}

export function saveProfile(
  values: ProfileValues,
  version: number,
  operationKey: string,
  photo?: SettingsImageUpload | null,
) {
  return getBackend().call("account_profile_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    operation_key: operationKey,
    expected_version: version,
    ...profileChange(values),
    ...(photo !== undefined ? { photo } : {}),
  });
}
export type ProfileSnapshot = Awaited<ReturnType<typeof readProfile>>;
