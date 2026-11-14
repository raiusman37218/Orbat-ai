import { Hammer } from 'lucide-react';
import { ButtonLink, Card, EmptyState } from '@/components/orbat/primitives';
import { PageContainer } from '@/components/orbat/shell/PageContainer';

/* TEMPORARY: catches every /app/* screen that is not built yet, so the
   sidebar never leads to a 404 while the new UI is being built. A real route
   folder always wins over this catch-all. Delete at the cut-over. */
export default function NotBuiltYet() {
  return (
    <PageContainer>
      <Card size="lg">
        <EmptyState
          icon={<Hammer size={22} />}
          title="This screen is being rebuilt"
          body="It is part of the new design and is not ready yet. You can still use it in the current dashboard."
          action={
            <>
              <ButtonLink href="/dashboard" variant="secondary">
                Open current dashboard
              </ButtonLink>
              <ButtonLink href="/app" variant="quiet">
                Back to overview
              </ButtonLink>
            </>
          }
        />
      </Card>
    </PageContainer>
  );
}
