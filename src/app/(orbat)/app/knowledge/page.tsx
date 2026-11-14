import type { Metadata } from 'next';
import { KnowledgeScreen } from '@/components/orbat/knowledge/KnowledgeScreen';

export const metadata: Metadata = {
  title: 'Knowledge Base · ORBAT AI',
};

export default function KnowledgePage() {
  return <KnowledgeScreen />;
}
