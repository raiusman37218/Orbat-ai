import React from 'react';
import { UsersView } from '@/components/admin/UsersView';

export const metadata = {
  title: 'Platform Users — Orbat AI Super Admin',
  description: 'Manage users across all workspaces and control account active status.',
};

export default function AdminUsersPage() {
  return <UsersView />;
}
