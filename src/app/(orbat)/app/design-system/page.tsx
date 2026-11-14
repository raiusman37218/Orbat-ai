import { notFound } from 'next/navigation';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { DesignSystemGallery } from './DesignSystemGallery';

/* Living reference for the shared components (DesignSystem.dc.html).
   Development only: hidden from the nav and a 404 in production. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <PageContainer>
      <PageHeader
        title="ORBAT foundations"
        description="Forest green for structure, bright green for action, violet only for AI, so people always know who is speaking and what to do next."
      />
      <DesignSystemGallery />
    </PageContainer>
  );
}
