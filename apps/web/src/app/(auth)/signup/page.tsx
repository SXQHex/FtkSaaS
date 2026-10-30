import { getTranslations } from "next-intl/server";
import { AuthFields } from "../../../components/auth/auth-fields";
import { publicConfig, safeReturnPath } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("signupTitle") };
}
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthFields
      mode="signup"
      configured={!!publicConfig()}
      returnTo={safeReturnPath((await searchParams).next)}
    />
  );
}
