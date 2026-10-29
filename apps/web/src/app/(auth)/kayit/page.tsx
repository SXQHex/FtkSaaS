import { getTranslations } from "next-intl/server";
import { AuthFields } from "../../../components/auth/auth-fields";
import { publicConfig } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("signupTitle") };
}
export default function SignupPage() {
  return <AuthFields mode="signup" configured={!!publicConfig()} />;
}
