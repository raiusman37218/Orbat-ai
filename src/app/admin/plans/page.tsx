import React from 'react';
import { PlansManagementView } from '@/components/admin/PlansManagementView';

export const metadata = {
  title: 'Plans, Pricing & Billing — Zentry Super Admin',
  description: 'Manage platform subscription tiers, pricing, Lemon Squeezy payment gateway, resource limits, features, and coupons.',
};

export default function AdminPlansPage() {
  return <PlansManagementView />;
}
