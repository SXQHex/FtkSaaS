import { notFound } from "next/navigation";
import { validate } from "uuid";
import { PublicSchedule } from "../../../components/public/public-schedule";
export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ center?: string | string[] }>;
}) {
  const { slug } = await params;
  const { center } = await searchParams;
  if (center !== undefined && (typeof center !== "string" || !validate(center))) notFound();
  return (
    <PublicSchedule
      slug={slug}
      centerId={center}
      siteKey={process.env.FTK_PUBLIC_TURNSTILE_SITE_KEY}
    />
  );
}
