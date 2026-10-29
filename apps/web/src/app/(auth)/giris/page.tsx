import { getTranslations } from "next-intl/server";
import { AuthFields } from "../../../components/auth/auth-fields";
import { publicConfig } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("loginTitle") };
}
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <AuthFields configured={!!publicConfig()} initialError={!!error} />
    </>
  );
}
