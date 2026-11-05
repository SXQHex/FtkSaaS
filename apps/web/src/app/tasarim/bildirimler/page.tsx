import { getTranslations } from "next-intl/server";
import { InboxPreview } from "../../../components/admin/inbox-preview";
export async function generateMetadata() {
  return {
    title: (await getTranslations("inbox"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function InboxDesignPage() {
  return <InboxPreview />;
}
