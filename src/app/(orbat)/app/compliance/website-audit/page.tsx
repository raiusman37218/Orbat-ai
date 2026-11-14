import type { Metadata } from 'next';
import { WebsiteAuditScreen } from '@/components/orbat/compliance/WebsiteAuditScreen';

export const metadata: Metadata = {
  title: 'Website Compliance Audit · ORBAT AI',
};

export default function WebsiteAuditPage() {
  return <WebsiteAuditScreen />;
}
