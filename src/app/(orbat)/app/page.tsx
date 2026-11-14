import { LayoutDashboard } from 'lucide-react';
import { ButtonLink, Card, EmptyState } from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';

/* Placeholder until the Overview screen (Main.dc.html) is built. */
export default function OverviewPage() {
  return (
    <PageContainer>
      <PageHeader title="Overview" description="Your workspace at a glance." />
      <Card size="lg">
        <EmptyState
          icon={<LayoutDashboard size={22} />}
          title="The new overview is on its way"
          body="This screen is being rebuilt in the new design. Everything still works in the current dashboard."
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Open current dashboard
            </ButtonLink>
          }
        />
      </Card>
    </PageContainer>
  );
}
