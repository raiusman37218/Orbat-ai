import { PageContainer } from '@/components/orbat/shell/PageContainer';
import { Card, Skeleton, SkeletonRows } from '@/components/orbat/primitives';

export default function AppLoading() {
  return (
    <PageContainer className="gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-40 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="flex flex-col gap-3 p-5">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-3 w-32 rounded" />
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SkeletonRows rows={5} />
      </Card>
    </PageContainer>
  );
}
