import { getTranslations } from "next-intl/server";
import { AuthFields } from "../../../components/auth/auth-fields";
import { publicConfig } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("recoveryTitle") };
}
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <>
      <AuthFields
        mode="recovery"
        configured={!!publicConfig()}
        initialError={!!(await searchParams).error}
      />
    </>
  );
}
