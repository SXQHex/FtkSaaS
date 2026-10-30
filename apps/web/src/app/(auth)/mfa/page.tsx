import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthFields } from "../../../components/auth/auth-fields";
import { serverClient } from "../../../lib/supabase/server";
import { safeReturnPath } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("mfaTitle") };
}
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error)
    redirect(`/login?error=session&next=${encodeURIComponent(returnTo)}`);
  return (
    <>
      <AuthFields mode="mfa" returnTo={returnTo} />
    </>
  );
}
