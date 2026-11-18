import { Skeleton } from "../../components/ui/skeleton";

export function MemberReadSkeleton({ label }: { label: string }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton aria-hidden="true" className="h-12 w-full" />
    </>
  );
}
