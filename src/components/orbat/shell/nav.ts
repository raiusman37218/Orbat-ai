import {
  BookOpen,
  ChartLine,
  CreditCard,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Phone,
  Plug,
  Settings,
  ShieldCheck,
  SlidersVertical,
  Sparkles,
  Star,
  Ticket,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { roleCan, type Capability, type Role } from '@/lib/team/permissions';

/* One list drives the sidebar, the breadcrumb and the command palette's
   "Go to" group, so they can never disagree. Order and grouping follow
   docs/design/design/Sidebar.dc.html; routes follow docs/design/HANDOFF.md. */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from roles without this capability. */
  needs?: Capability;
  /** Only shown outside production (reference pages). */
  devOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', href: '/app', icon: LayoutDashboard },
      { id: 'inbox', label: 'Inbox', href: '/app/inbox', icon: Inbox },
      { id: 'calls', label: 'Calls', href: '/app/calls', icon: Phone },
      { id: 'tickets', label: 'Tickets', href: '/app/tickets', icon: Ticket },
      { id: 'customers', label: 'Customers', href: '/app/customers', icon: Users },
    ],
  },
  {
    label: 'AI & Knowledge',
    items: [
      { id: 'agents', label: 'AI Agents', href: '/app/agents', icon: Sparkles },
      { id: 'templates', label: 'Agent templates', href: '/app/agents/templates', icon: LayoutGrid },
      { id: 'builder', label: 'Agent builder', href: '/app/agents/new', icon: SlidersVertical, needs: 'manage_settings' },
      { id: 'quality', label: 'AI quality', href: '/app/ai-quality', icon: Star },
      { id: 'languages', label: 'Languages', href: '/app/languages', icon: Globe },
      { id: 'knowledge', label: 'Knowledge base', href: '/app/knowledge', icon: BookOpen },
      { id: 'automation', label: 'Automation', href: '/app/automation', icon: Workflow, needs: 'manage_settings' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { id: 'engagement', label: 'Engagement', href: '/app/engagement', icon: Megaphone },
      { id: 'analytics', label: 'Analytics', href: '/app/analytics', icon: ChartLine },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'team', label: 'Team', href: '/app/team', icon: UsersRound },
      { id: 'compliance', label: 'Compliance', href: '/app/compliance', icon: ShieldCheck, needs: 'manage_settings' },
      { id: 'channels', label: 'Channels & apps', href: '/app/channels', icon: Plug, needs: 'manage_settings' },
      { id: 'billing', label: 'Billing & usage', href: '/app/billing', icon: CreditCard, needs: 'manage_settings' },
      { id: 'settings', label: 'Settings', href: '/app/settings', icon: Settings },
      { id: 'design', label: 'Design system', href: '/app/design-system', icon: Layers, devOnly: true },
    ],
  },
];

/* Pages that live under a nav item but are not in the sidebar themselves. */
const EXTRA_PAGES: { href: string; label: string; group: string }[] = [
  { href: '/app/getting-started', label: 'Getting started', group: 'Workspace' },
  { href: '/app/handoff', label: 'Handoff', group: 'Workspace' },
  { href: '/app/automation/journeys', label: 'Journeys', group: 'AI & Knowledge' },
  { href: '/app/team/schedule', label: 'Schedule', group: 'Admin' },
  { href: '/app/compliance/policies', label: 'Policies', group: 'Admin' },
  { href: '/app/compliance/website-audit', label: 'Website audit', group: 'Admin' },
  { href: '/app/channels/connect', label: 'Connect a CRM', group: 'Admin' },
  { href: '/app/settings/emails', label: 'Email templates', group: 'Admin' },
  { href: '/app/profile', label: 'My profile', group: 'Account' },
];

export function visibleNav(role: Role, isDev: boolean): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.devOnly || isDev) && (!i.needs || roleCan(role, i.needs))),
  })).filter((g) => g.items.length > 0);
}

function matches(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* The sidebar item to highlight: the longest matching href wins, so
   /app/agents/templates highlights "Agent templates", not "AI Agents". */
export function activeNavId(pathname: string): string | null {
  if (pathname.startsWith('/app/agents/') && pathname !== '/app/agents/templates') return 'builder';
  let best: NavItem | null = null;
  for (const g of NAV) {
    for (const item of g.items) {
      if (matches(pathname, item.href) && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  return best?.id ?? null;
}

export function breadcrumbFor(pathname: string): { section: string; page: string } {
  if (pathname.startsWith('/app/agents/') && pathname !== '/app/agents/templates') return { section: 'AI & Knowledge', page: 'Agent builder' };
  let best: { href: string; label: string; group: string } | null = null;
  const candidates = [
    ...NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label }))),
    ...EXTRA_PAGES,
  ];
  for (const c of candidates) {
    if (matches(pathname, c.href) && (!best || c.href.length > best.href.length)) best = c;
  }
  return best ? { section: best.group, page: best.label } : { section: 'Workspace', page: 'Overview' };
}

/* The inbox uses the compact 64px sidebar (HANDOFF.md, "Inbox"). */
export function usesCompactSidebar(pathname: string): boolean {
  return matches(pathname, '/app/inbox');
}
