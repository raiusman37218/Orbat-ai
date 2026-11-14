import type { Metadata } from 'next';
import { AiQualityScreen } from '@/components/orbat/ai-quality/AiQualityScreen';

export const metadata: Metadata = {
  title: 'AI Quality & Trust · ORBAT AI',
};

export default function AiQualityPage() {
  return <AiQualityScreen />;
}
