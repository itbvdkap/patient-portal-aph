import { LoadingSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton />
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  );
}
