import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container py-10 space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-64" />
      <div className="grid sm:grid-cols-3 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
