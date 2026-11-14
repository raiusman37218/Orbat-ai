'use client';

import { useEffect } from 'react';
import { Card, ErrorState } from '@/components/orbat/primitives';
import { PageContainer } from '@/components/orbat/shell/PageContainer';
import { errorMessage } from '@/lib/errors/user-error';

/* Any screen that throws while rendering lands here, inside the shell. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[App Screen Error]:', error);
  }, [error]);

  return (
    <PageContainer>
      <Card size="lg">
        <ErrorState
          title="This screen couldn’t load"
          body={errorMessage(error) || 'Please try again in a moment.'}
          onRetry={reset}
        />
      </Card>
    </PageContainer>
  );
}
