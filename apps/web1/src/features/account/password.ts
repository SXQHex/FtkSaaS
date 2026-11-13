import { getSupabaseClient } from "../../lib/supabase";

export async function changePassword(values: { current: string; password: string; nonce: string }) {
  const { data, error } = await getSupabaseClient().auth.updateUser({
    ...(values.current ? { current_password: values.current } : {}),
    password: values.password,
    ...(values.nonce.trim() ? { nonce: values.nonce.trim() } : {}),
  });
  if (error) throw error;
  if (!data.user) throw new Error("AUTH_REQUIRED");
}
export async function requestPasswordCode() {
  const { error } = await getSupabaseClient().auth.reauthenticate();
  if (error) throw error;
}
