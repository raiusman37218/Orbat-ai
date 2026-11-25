'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Building2,
  Check,
  Copy,
  CreditCard,
  LayoutDashboard,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Table,
  Toggle,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { fmtInt } from '@/components/orbat/overview/format';
import {
  changePlatformStaffRole,
  invitePlatformStaff,
  loadSuperAdminConsole,
  reviewTrialExtension,
  revokePlatformStaff,
  saveAiConfigAndTiers,
  savePlanQuick,
  savePlatformGovernance,
  switchIntoWorkspace,
  testAiProviderKey,
  toggleWorkspaceSuspended,
  type PlatformStaffRole,
  type ProviderId,
  type SuperAdminConsoleBundle,
  type SuperAdminWorkspaceRow,
} from '@/lib/data/super-admin';
import { signOut } from '@/lib/data/auth';
import { useTheme } from '@/components/orbat/shell/theme';
import { clearDataCache, useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

export type AdminNavId =
  | 'overview'
  | 'workspaces'
  | 'plans'
  | 'ai'
  | 'staff'
  | 'settings';

const NAV_ITEMS: Array<{
  id: AdminNavId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workspaces', label: 'Workspaces', icon: Building2 },
  { id: 'plans', label: 'Plans & limits', icon: CreditCard },
  { id: 'ai', label: 'AI models & keys', icon: Bot },
  { id: 'staff', label: 'Staff access', icon: Users },
  { id: 'settings', label: 'Platform settings', icon: Settings },
];

export function SuperAdminScreen({ initialTab = 'overview' }: { initialTab?: AdminNavId }) {
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const { data, error, loading, reload } = useData(
    () => loadSuperAdminConsole(),
    ['super-admin-console'],
    { staleTimeMs: 0 },
  );

  const handleSwitchToAdminLogin = async () => {
    setSwitchingAccount(true);
    try {
      clearDataCache();
      await signOut();
    } finally {
      window.location.assign('/login?redirect=/admin');
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-o-bg p-6 sm:p-10">
        <div className="mx-auto max-w-[1360px] flex flex-col gap-6">
          <Skeleton className="h-14 w-64 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-[22px]" />
            <Skeleton className="h-28 rounded-[22px]" />
            <Skeleton className="h-28 rounded-[22px]" />
            <Skeleton className="h-28 rounded-[22px]" />
          </div>
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-o-bg p-6">
        <div className="w-full max-w-[560px]">
          <ErrorState
            title="Could not open platform admin console"
            body={error}
            onRetry={reload}
          />
        </div>
      </div>
    );
  }

  if (!data || data.authorized === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-o-bg p-6">
        <Card className="w-full max-w-[540px]" size="lg">
          <EmptyState
            icon={<Lock size={24} />}
            title={
              data?.authenticated
                ? '403 — Platform super admin access required'
                : 'Sign in required'
            }
            body={
              data?.reason ||
              'This control plane is restricted to verified platform owners and super administrators in platform_access.'
            }
            action={
              <>
                {!data?.authenticated ? (
                  <ButtonLink href="/login?redirect=/admin" variant="primary">
                    Sign in to ORBAT
                  </ButtonLink>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      loading={switchingAccount}
                      onClick={handleSwitchToAdminLogin}
                    >
                      Sign in as Super Admin
                    </Button>
                    <ButtonLink href="/app" variant="secondary">
                      Open my workspace
                    </ButtonLink>
                  </>
                )}
                <ButtonLink href="/" variant="secondary">
                  Home
                </ButtonLink>
              </>
            }
          />
          {data?.authenticated && data.email ? (
            <p className="mt-4 text-center text-[13px] text-o-text-3">
              Signed in as <span className="font-medium text-o-text-2">{data.email}</span>
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  return <SuperAdminConsoleLoaded key={data.callerEmail} bundle={data} initialTab={initialTab} onReload={reload} />;
}

function SuperAdminConsoleLoaded({
  bundle,
  initialTab,
  onReload,
}: {
  bundle: SuperAdminConsoleBundle;
  initialTab: AdminNavId;
  onReload: () => void;
}) {
  const router = useRouter();
  const { show } = useOrbToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const [section, setSection] = useState<AdminNavId>(initialTab);

  function selectSection(next: AdminNavId) {
    setSection(next);
    if (typeof window !== 'undefined') {
      const nextUrl = next === 'overview' ? '/admin' : `/admin?tab=${next}`;
      window.history.replaceState(null, '', nextUrl);
    }
  }
  const [prevInitialTab, setPrevInitialTab] = useState<AdminNavId>(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setSection(initialTab);
  }

  // Workspaces filters & suspend confirm
  const [wsSearch, setWsSearch] = useState('');
  const [wsStatus, setWsStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [suspendTarget, setSuspendTarget] = useState<SuperAdminWorkspaceRow | null>(null);
  const [suspendBusy, setSuspendBusy] = useState(false);

  // Plans & PAYG editors
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState({
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxAgents: '',
    maxAiReplies: '',
    maxChannels: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);

  const initialRates = bundle.platformSettings.paygRates || {};
  const [paygRates, setPaygRates] = useState<Record<string, number>>({
    conversationBaseUsd: Number(initialRates.conversationBaseUsd ?? 0.1),
    aiLightUsd: Number(initialRates.aiLightUsd ?? 0.01),
    aiStandardUsd: Number(initialRates.aiStandardUsd ?? 0.03),
    aiAdvancedUsd: Number(initialRates.aiAdvancedUsd ?? 0.08),
    voiceMinuteUsd: Number(initialRates.voiceMinuteUsd ?? 0.08),
    websiteAuditUsd: Number(initialRates.websiteAuditUsd ?? 4.0),
  });
  const [savingPayg, setSavingPayg] = useState(false);

  // AI settings
  const [aiProvider, setAiProvider] = useState<ProviderId>(bundle.aiSettings.provider);
  const [aiModel, setAiModel] = useState(bundle.aiSettings.model || 'claude-3-5-sonnet-latest');
  const [aiKey, setAiKey] = useState('');
  const [aiEnabled, setAiEnabled] = useState(bundle.aiSettings.is_enabled);
  const [routerTiers, setRouterTiers] = useState(bundle.routerTierModels);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  // Staff access
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitingStaff, setInvitingStaff] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; email: string } | null>(null);
  const [revokingStaff, setRevokingStaff] = useState(false);

  // Governance settings
  const [signupMode, setSignupMode] = useState<'open' | 'invite_only'>(
    bundle.platformSettings.signup_mode === 'invite_only' ? 'invite_only' : 'open',
  );
  const [defaultPlanSlug, setDefaultPlanSlug] = useState(
    bundle.platformSettings.default_plan_slug || 'starter',
  );
  const [defaultTrialDays, setDefaultTrialDays] = useState(
    Number(bundle.platformSettings.default_trial_days ?? 14),
  );
  const [defaultRetentionDays, setDefaultRetentionDays] = useState(
    Number(bundle.platformSettings.default_data_retention_days ?? 365),
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    Boolean(bundle.platformSettings.is_maintenance_mode),
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    bundle.platformSettings.maintenance_message || '',
  );
  const [defaultRequire2fa, setDefaultRequire2fa] = useState(
    Boolean(bundle.platformSettings.default_require_2fa),
  );
  const [savingGov, setSavingGov] = useState(false);

  const filteredWorkspaces = useMemo(() => {
    const q = wsSearch.trim().toLowerCase();
    return bundle.workspaces.filter((w) => {
      if (wsStatus === 'active' && w.is_suspended) return false;
      if (wsStatus === 'suspended' && !w.is_suspended) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        (w.owner_email || '').toLowerCase().includes(q) ||
        w.plan.toLowerCase().includes(q)
      );
    });
  }, [bundle.workspaces, wsSearch, wsStatus]);

  async function handleConfirmSuspend() {
    if (!suspendTarget) return;
    setSuspendBusy(true);
    try {
      await toggleWorkspaceSuspended(suspendTarget.id, !suspendTarget.is_suspended);
      show({
        message: suspendTarget.is_suspended
          ? `${suspendTarget.name} reactivated.`
          : `${suspendTarget.name} suspended.`,
        tone: 'ok',
      });
      setSuspendTarget(null);
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Action failed.',
        tone: 'bad',
      });
    } finally {
      setSuspendBusy(false);
    }
  }

  async function handleOpenWorkspace(wsId: string) {
    try {
      await switchIntoWorkspace(wsId);
      router.push('/app');
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not open workspace.',
        tone: 'bad',
      });
    }
  }

  async function handleReviewExtension(reqId: string, decision: 'approved' | 'rejected') {
    try {
      await reviewTrialExtension(reqId, decision);
      show({
        message: `Trial extension ${decision}.`,
        tone: decision === 'approved' ? 'ok' : 'info',
      });
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not update extension.',
        tone: 'bad',
      });
    }
  }

  async function handleSavePlan() {
    if (!editingPlanId) return;
    setSavingPlan(true);
    try {
      await savePlanQuick({
        id: editingPlanId,
        monthly_price: Number(planDraft.monthlyPrice) || 0,
        yearly_price: Number(planDraft.yearlyPrice) || 0,
        max_agents: planDraft.maxAgents.trim() ? Number(planDraft.maxAgents) : null,
        max_ai_bot_replies_per_month: planDraft.maxAiReplies.trim()
          ? Number(planDraft.maxAiReplies)
          : null,
        max_channels_connected: planDraft.maxChannels.trim() ? Number(planDraft.maxChannels) : null,
      });
      show({ message: 'Plan pricing and limits saved.', tone: 'ok' });
      setEditingPlanId(null);
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not save plan.',
        tone: 'bad',
      });
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSaveGovernance(includePayg = false) {
    if (includePayg) setSavingPayg(true);
    else setSavingGov(true);
    try {
      await savePlatformGovernance({
        signupMode,
        defaultPlanSlug,
        defaultTrialDays: Number(defaultTrialDays) || 14,
        defaultDataRetentionDays: Number(defaultRetentionDays) || 365,
        isMaintenanceMode: maintenanceMode,
        maintenanceMessage,
        defaultRequire2fa,
        paygRates: includePayg ? paygRates : undefined,
      });
      show({
        message: includePayg ? 'PAYG metering rates saved.' : 'Platform settings updated.',
        tone: 'ok',
      });
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not save settings.',
        tone: 'bad',
      });
    } finally {
      setSavingPayg(false);
      setSavingGov(false);
    }
  }

  async function handleSaveAi() {
    setSavingAi(true);
    try {
      await saveAiConfigAndTiers({
        provider: aiProvider,
        model: aiModel,
        apiKey: aiKey.trim() || undefined,
        isEnabled: aiEnabled,
        routerTiers,
      });
      setAiKey('');
      show({ message: 'AI model configuration & routing tiers saved.', tone: 'ok' });
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not save AI settings.',
        tone: 'bad',
      });
    } finally {
      setSavingAi(false);
    }
  }

  async function handleTestAi() {
    setTestingAi(true);
    try {
      const res = await testAiProviderKey();
      const passed = 'success' in res ? Boolean(res.success) : Boolean(res.ok);
      const msg =
        'message' in res
          ? res.message
          : res.error ||
            (passed
              ? `AI connection verified${res.model ? ` (${res.model})` : ''}.`
              : 'Connection check failed.');
      show({
        message: msg,
        tone: passed ? 'ok' : 'bad',
      });
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Test connection failed.',
        tone: 'bad',
      });
    } finally {
      setTestingAi(false);
    }
  }

  async function handleInviteStaff() {
    setInvitingStaff(true);
    try {
      const res = await invitePlatformStaff(inviteEmail, inviteName);
      if (res.token && typeof window !== 'undefined' && navigator.clipboard) {
        const inviteUrl = `${window.location.origin}/admin/invite?token=${res.token}`;
        await navigator.clipboard.writeText(inviteUrl).catch(() => {});
        show({
          message: `Invite created for ${inviteEmail} — link copied to clipboard.`,
          tone: 'ok',
        });
      } else {
        show({ message: `Platform staff invite recorded for ${inviteEmail}.`, tone: 'ok' });
      }
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not invite staff member.',
        tone: 'bad',
      });
    } finally {
      setInvitingStaff(false);
    }
  }

  async function handleRoleChange(agentId: string, role: PlatformStaffRole) {
    try {
      const res = await changePlatformStaffRole(agentId, role);
      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        throw new Error((res as { error?: string }).error || 'Could not update role.');
      }
      show({ message: 'Staff role updated.', tone: 'ok' });
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not update staff role.',
        tone: 'bad',
      });
    }
  }

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    setRevokingStaff(true);
    try {
      await revokePlatformStaff(revokeTarget.id);
      show({ message: `Removed platform access for ${revokeTarget.email}.`, tone: 'ok' });
      setRevokeTarget(null);
      onReload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not revoke access.',
        tone: 'bad',
      });
    } finally {
      setRevokingStaff(false);
    }
  }

  const workspaceColumns: Column<SuperAdminWorkspaceRow>[] = [
    {
      key: 'name',
      header: 'Workspace',
      cell: (w) => (
        <div className="min-w-0">
          <Link
            href={`/admin/workspaces/${w.id}`}
            className="block truncate font-semibold text-o-text no-underline hover:underline"
          >
            {w.name}
          </Link>
          <p className="truncate text-[12.5px] text-o-text-3">
            {w.owner_email || 'No owner email'} {w.industry ? `· ${w.industry}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (w) => <Badge tone="neutral">{w.plan}</Badge>,
    },
    {
      key: 'usage',
      header: 'AI replies (30d)',
      align: 'right',
      hideBelow: 'sm',
      cell: (w) => <span className="o-num text-o-text">{fmtInt(w.aiConversations30d)}</span>,
    },
    {
      key: 'economics',
      header: 'Cost / MRR',
      align: 'right',
      hideBelow: 'md',
      cell: (w) => (
        <span className="o-num text-o-text-2">
          ${w.estimatedModelCostUsd.toFixed(2)} / ${w.monthlyRevenueUsd}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (w) => (
        <Badge tone={w.is_suspended ? 'bad' : 'ok'} dot>
          {w.is_suspended ? 'Suspended' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (w) => (
        <div className="flex justify-end gap-1.5">
          <ButtonLink
            size="sm"
            variant="ghost"
            href={`/admin/workspaces/${w.id}`}
            leading={<SlidersHorizontal size={13} />}
          >
            Manage
          </ButtonLink>
          <Button size="sm" variant="secondary" onClick={() => void handleOpenWorkspace(w.id)}>
            Open
          </Button>
          <Button
            size="sm"
            variant={w.is_suspended ? 'primary' : 'quiet'}
            onClick={() => setSuspendTarget(w)}
          >
            {w.is_suspended ? 'Activate' : 'Suspend'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-o-bg text-o-text lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* Dark platform rail (SuperAdmin.dc.html) */}
      <aside className="flex flex-col justify-between bg-[#162721] px-4 py-5 text-[#edf2ef] lg:min-h-screen">
        <div>
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#d2f178] text-[#162721] font-bold">
                O
              </span>
              <div>
                <p className="text-[14.5px] font-semibold tracking-tight text-white">ORBAT</p>
                <p className="text-[11.5px] text-[#9eb5ab]">Super Admin</p>
              </div>
            </div>
            <Badge tone="accent">{bundle.callerIsOwner ? 'Owner' : 'Staff'}</Badge>
          </div>

          <nav aria-label="Super admin sections" className="mt-6 flex flex-wrap gap-1 lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition',
                    active
                      ? 'bg-[#264237] text-[#d2f178]'
                      : 'text-[#c2d2cb] hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 hidden flex-col gap-3 border-t border-white/10 pt-4 lg:flex">
          <div className="px-2">
            <p className="truncate text-[13px] font-medium text-white">{bundle.callerEmail}</p>
            <p className="text-[11.5px] text-[#9eb5ab]">Verified platform operator</p>
          </div>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-medium text-[#d2f178] no-underline hover:bg-white/5"
          >
            <ArrowLeft size={15} />
            Back to workspace app
          </Link>
        </div>
      </aside>

      {/* Main console surface */}
      <main className="mx-auto flex w-full max-w-[1220px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="o-page-title">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </h1>
            <p className="mt-0.5 text-[14px] text-o-text-2">
              Platform-wide multi-tenant governance, AI provider routing, plans, and operator access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              leading={theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onReload}
              leading={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
            <ButtonLink size="sm" variant="ghost" href="/app">
              Workspace app
            </ButtonLink>
          </div>
        </div>

        {section === 'overview' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <p className="text-[13px] text-o-text-3">Workspaces</p>
                <p className="o-num mt-1 text-[28px] font-semibold text-o-text">
                  {fmtInt(bundle.kpis.totalWorkspaces)}
                </p>
                <p className="mt-1 text-[12.5px] text-o-text-2">
                  {fmtInt(bundle.kpis.activeWorkspaces)} active · {fmtInt(bundle.kpis.payingWorkspaces)} paying
                </p>
              </Card>
              <Card>
                <p className="text-[13px] text-o-text-3">AI conversations (30d)</p>
                <p className="o-num mt-1 text-[28px] font-semibold text-o-text">
                  {fmtInt(bundle.kpis.aiConversations30d)}
                </p>
                <p className="mt-1 text-[12.5px] text-o-text-2">Across all workspaces</p>
              </Card>
              <Card>
                <p className="text-[13px] text-o-text-3">Est. model cost vs MRR</p>
                <p className="o-num mt-1 text-[28px] font-semibold text-o-text">
                  ${bundle.kpis.estimatedModelCost30dUsd.toFixed(0)} / $
                  {bundle.kpis.estimatedMonthlyRevenueUsd}
                </p>
                <p className="mt-1 text-[12.5px] text-o-text-2">30-day token estimate</p>
              </Card>
              <Card>
                <p className="text-[13px] text-o-text-3">Estimated gross margin</p>
                <p className="o-num mt-1 text-[28px] font-semibold text-o-text">
                  {bundle.kpis.grossMarginPct === null ? '—' : `${bundle.kpis.grossMarginPct}%`}
                </p>
                <p className="mt-1 text-[12.5px] text-o-text-2">Subscription MRR less model cost</p>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Workspaces by plan" sub="Tenant distribution across billing tiers" />
                <div className="mt-4 flex flex-col gap-3">
                  {bundle.workspacesByPlan.length === 0 ? (
                    <p className="text-[14px] text-o-text-2">No workspaces created yet.</p>
                  ) : (
                    bundle.workspacesByPlan.map((row) => (
                      <div key={row.label} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[13.5px]">
                          <span className="font-medium text-o-text">{row.label}</span>
                          <span className="o-num text-o-text-2">{fmtInt(row.count)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-o-surface-2">
                          <div
                            className="h-full rounded-full bg-o-forest"
                            style={{ width: `${Math.max(4, row.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader title="System health checks" sub="Live infrastructure status" />
                <div className="mt-4 flex flex-col gap-2.5">
                  {bundle.healthChecks.map((hc) => (
                    <div
                      key={hc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-o-border bg-o-surface-2/40 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-o-text">{hc.label}</p>
                        <p className="truncate text-[12.5px] text-o-text-2">{hc.detail}</p>
                      </div>
                      <Badge tone={hc.tone} dot>
                        {hc.tone === 'ok' ? 'Healthy' : hc.tone === 'warn' ? 'Attention' : 'Down'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {bundle.trialExtensionRequests.length > 0 && (
              <Card>
                <CardHeader
                  title="Trial extension queue"
                  sub="Approve or decline extra evaluation days requested by workspace admins"
                />
                <div className="mt-4 flex flex-col gap-2.5">
                  {bundle.trialExtensionRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-o-border p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-o-text">{req.workspaceName}</p>
                          <Badge tone="neutral">+{req.requestedDays} days</Badge>
                          <Badge
                            tone={
                              req.status === 'approved'
                                ? 'ok'
                                : req.status === 'rejected'
                                  ? 'bad'
                                  : 'warn'
                            }
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[13px] text-o-text-2">
                          {req.requesterEmail || 'Admin'} {req.reason ? `· "${req.reason}"` : ''}
                        </p>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            leading={<Check size={14} />}
                            onClick={() => void handleReviewExtension(req.id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            leading={<X size={14} />}
                            onClick={() => void handleReviewExtension(req.id, 'rejected')}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {section === 'workspaces' && (
          <Card>
            <CardHeader
              title="All workspaces"
              sub="Inspect usage economics, jump directly into any workspace, or suspend abusive tenants."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
                    />
                    <Input
                      value={wsSearch}
                      onChange={(e) => setWsSearch(e.target.value)}
                      placeholder="Filter name or owner email"
                      className="pl-8"
                      size="sm"
                    />
                  </div>
                  <Segmented
                    label="Workspace status"
                    value={wsStatus}
                    onChange={setWsStatus}
                    items={[
                      { id: 'all', label: 'All' },
                      { id: 'active', label: 'Active' },
                      { id: 'suspended', label: 'Suspended' },
                    ]}
                  />
                </div>
              }
            />
            <div className="mt-4">
              {filteredWorkspaces.length === 0 ? (
                <EmptyState
                  title="No workspaces match that filter"
                  body="Try clearing the search query or switching status filter."
                />
              ) : (
                <Table
                  caption="Platform tenant workspaces"
                  columns={workspaceColumns}
                  rows={filteredWorkspaces}
                  rowKey={(w) => w.id}
                />
              )}
            </div>
          </Card>
        )}

        {section === 'plans' && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader
                title="Subscription plan catalog"
                sub="Edit monthly/yearly pricing and hard usage caps enforced across every workspace."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {bundle.plans.map((p) => {
                  const isEditing = editingPlanId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col justify-between rounded-2xl border border-o-border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[16px] font-semibold text-o-text">{p.name}</h3>
                            <Badge tone="neutral">{p.slug}</Badge>
                          </div>
                          <p className="mt-0.5 text-[13px] text-o-text-2">{p.description}</p>
                        </div>
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingPlanId(p.id);
                              setPlanDraft({
                                monthlyPrice: Number(p.monthly_price || 0),
                                yearlyPrice: Number(p.yearly_price || 0),
                                maxAgents: p.max_agents === null ? '' : String(p.max_agents),
                                maxAiReplies:
                                  p.max_ai_bot_replies_per_month === null
                                    ? ''
                                    : String(p.max_ai_bot_replies_per_month),
                                maxChannels:
                                  p.max_channels_connected === null
                                    ? ''
                                    : String(p.max_channels_connected),
                              });
                            }}
                          >
                            Edit caps
                          </Button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Field label="Monthly USD">
                            <Input
                              type="number"
                              value={planDraft.monthlyPrice}
                              onChange={(e) =>
                                setPlanDraft((prev) => ({
                                  ...prev,
                                  monthlyPrice: Number(e.target.value),
                                }))
                              }
                            />
                          </Field>
                          <Field label="Yearly USD">
                            <Input
                              type="number"
                              value={planDraft.yearlyPrice}
                              onChange={(e) =>
                                setPlanDraft((prev) => ({
                                  ...prev,
                                  yearlyPrice: Number(e.target.value),
                                }))
                              }
                            />
                          </Field>
                          <Field label="Max agents (blank = unlimited)">
                            <Input
                              type="number"
                              value={planDraft.maxAgents}
                              onChange={(e) =>
                                setPlanDraft((prev) => ({ ...prev, maxAgents: e.target.value }))
                              }
                            />
                          </Field>
                          <Field label="AI replies / mo">
                            <Input
                              type="number"
                              value={planDraft.maxAiReplies}
                              onChange={(e) =>
                                setPlanDraft((prev) => ({
                                  ...prev,
                                  maxAiReplies: e.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field label="Max channels">
                            <Input
                              type="number"
                              value={planDraft.maxChannels}
                              onChange={(e) =>
                                setPlanDraft((prev) => ({ ...prev, maxChannels: e.target.value }))
                              }
                            />
                          </Field>
                          <div className="flex items-end gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              loading={savingPlan}
                              onClick={() => void handleSavePlan()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="quiet"
                              onClick={() => setEditingPlanId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px] text-o-text-2">
                          <div>
                            <span className="text-o-text-3">Price:</span>{' '}
                            <strong className="o-num text-o-text">${p.monthly_price}/mo</strong>
                          </div>
                          <div>
                            <span className="text-o-text-3">Seats:</span>{' '}
                            <strong className="o-num text-o-text">
                              {p.max_agents === null ? 'Unlimited' : p.max_agents}
                            </strong>
                          </div>
                          <div>
                            <span className="text-o-text-3">AI/mo:</span>{' '}
                            <strong className="o-num text-o-text">
                              {p.max_ai_bot_replies_per_month === null
                                ? 'Unlimited'
                                : fmtInt(p.max_ai_bot_replies_per_month)}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Pay-as-you-go (PAYG) rates"
                sub="Metered unit prices shown on the public /pricing page and applied to PAYG usage."
                actions={
                  <Button
                    size="sm"
                    variant="primary"
                    loading={savingPayg}
                    onClick={() => void handleSaveGovernance(true)}
                  >
                    Save PAYG rates
                  </Button>
                }
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Base conversation ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={paygRates.conversationBaseUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({
                        ...prev,
                        conversationBaseUsd: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="AI light tier ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={paygRates.aiLightUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({ ...prev, aiLightUsd: Number(e.target.value) }))
                    }
                  />
                </Field>
                <Field label="AI standard tier ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={paygRates.aiStandardUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({
                        ...prev,
                        aiStandardUsd: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="AI advanced tier ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={paygRates.aiAdvancedUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({
                        ...prev,
                        aiAdvancedUsd: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Voice minute ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={paygRates.voiceMinuteUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({
                        ...prev,
                        voiceMinuteUsd: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Website compliance audit ($)">
                  <Input
                    type="number"
                    step="0.25"
                    value={paygRates.websiteAuditUsd}
                    onChange={(e) =>
                      setPaygRates((prev) => ({
                        ...prev,
                        websiteAuditUsd: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {section === 'ai' && (
          <Card>
            <CardHeader
              title="AI provider credentials & model router"
              sub="Configure the active LLM gateway key and map light, standard, and complex traffic tiers."
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={testingAi}
                    onClick={() => void handleTestAi()}
                    leading={<Sparkles size={14} />}
                  >
                    Test live connection
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={savingAi}
                    onClick={() => void handleSaveAi()}
                  >
                    Save AI settings
                  </Button>
                </div>
              }
            />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Active AI provider">
                <Select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as ProviderId)}
                  options={[
                    { value: 'anthropic', label: 'Anthropic (Claude)' },
                    { value: 'openai', label: 'OpenAI (GPT)' },
                    { value: 'google', label: 'Google Gemini' },
                    { value: 'deepseek', label: 'DeepSeek' },
                    { value: 'compatible', label: 'OpenAI-compatible endpoint' },
                  ]}
                />
              </Field>
              <Field label="Primary model identifier">
                <Input value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
              </Field>
              <Field
                label="Platform API key"
                hint={
                  bundle.aiSettings.has_key
                    ? `Key stored ending in ••••${bundle.aiSettings.key_last4 || '****'}`
                    : 'No API key saved yet'
                }
              >
                <Input
                  type="password"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder={
                    bundle.aiSettings.has_key
                      ? 'Leave blank to keep existing key'
                      : 'Paste provider secret key...'
                  }
                />
              </Field>
              <div className="flex items-center">
                <Toggle
                  checked={aiEnabled}
                  onChange={setAiEnabled}
                  label="Platform AI gateway active"
                  description="When disabled, workspaces fall back cleanly to manual queues."
                />
              </div>
            </div>

            <div className="mt-6 border-t border-o-border pt-5">
              <h3 className="text-[15px] font-semibold text-o-text">
                Multi-tier intent router models
              </h3>
              <p className="mt-0.5 text-[13px] text-o-text-2">
                Route greetings and FAQs to low-cost models while escalating policy/refund edge cases to advanced models.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Light tier">
                  <Input
                    value={routerTiers.light}
                    onChange={(e) =>
                      setRouterTiers((prev) => ({ ...prev, light: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Standard tier">
                  <Input
                    value={routerTiers.standard}
                    onChange={(e) =>
                      setRouterTiers((prev) => ({ ...prev, standard: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Advanced tier">
                  <Input
                    value={routerTiers.advanced}
                    onChange={(e) =>
                      setRouterTiers((prev) => ({ ...prev, advanced: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>
        )}

        {section === 'staff' && (
          <Card>
            <CardHeader
              title="Platform staff access"
              sub="Operators granted platform_access roles (Owner, Support, Finance)."
              actions={
                bundle.callerIsOwner ? (
                  <Button
                    size="sm"
                    variant="primary"
                    leading={<Plus size={15} />}
                    onClick={() => setInviteOpen(true)}
                  >
                    Invite staff
                  </Button>
                ) : null
              }
            />
            <div className="mt-4 flex flex-col gap-3">
              {bundle.staff.length === 0 ? (
                <EmptyState
                  title="No staff entries found"
                  body="Add platform operators from the owner account."
                />
              ) : (
                bundle.staff.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-o-border p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Shield size={15} className="text-o-forest" aria-hidden="true" />
                        <p className="font-semibold text-o-text">{m.name || m.email}</p>
                        {m.is_platform_owner && <Badge tone="accent">Owner</Badge>}
                      </div>
                      <p className="text-[13px] text-o-text-2">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        size="sm"
                        aria-label={`Role for ${m.email}`}
                        disabled={!bundle.callerIsOwner || m.is_platform_owner}
                        value={m.role}
                        onChange={(e) =>
                          void handleRoleChange(m.id, e.target.value as PlatformStaffRole)
                        }
                        options={[
                          { value: 'owner', label: 'Owner' },
                          { value: 'support', label: 'Support' },
                          { value: 'finance', label: 'Finance' },
                        ]}
                      />
                      {bundle.callerIsOwner && !m.is_platform_owner && (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setRevokeTarget({ id: m.id, email: m.email })}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {bundle.pendingStaffInvites.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[13px] font-semibold text-o-text-2">
                    Pending operator invitations
                  </p>
                  <div className="flex flex-col gap-2">
                    {bundle.pendingStaffInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-o-border bg-o-surface-2/40 px-3.5 py-2.5 text-[13.5px]"
                      >
                        <span>
                          <strong>{inv.name || inv.email}</strong> ({inv.email})
                        </span>
                        <div className="flex items-center gap-2">
                          {inv.token ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              leading={<Copy size={13} />}
                              onClick={() => {
                                if (typeof window !== 'undefined' && navigator.clipboard) {
                                  const url = `${window.location.origin}/admin/invite?token=${inv.token}`;
                                  void navigator.clipboard.writeText(url);
                                  show({
                                    message: 'Invite link copied to clipboard.',
                                    tone: 'ok',
                                  });
                                }
                              }}
                            >
                              Copy invite link
                            </Button>
                          ) : null}
                          <Badge tone="warn">{inv.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {section === 'settings' && (
          <Card>
            <CardHeader
              title="Platform governance defaults"
              sub="Control new signups, default trial length, compliance retention, and emergency maintenance banners."
              actions={
                <Button
                  size="sm"
                  variant="primary"
                  loading={savingGov}
                  onClick={() => void handleSaveGovernance(false)}
                >
                  Save governance
                </Button>
              }
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="New workspace signup mode">
                <Select
                  value={signupMode}
                  onChange={(e) =>
                    setSignupMode(e.target.value === 'invite_only' ? 'invite_only' : 'open')
                  }
                  options={[
                    { value: 'open', label: 'Open self-serve registration' },
                    { value: 'invite_only', label: 'Invite-only onboarding' },
                  ]}
                />
              </Field>
              <Field label="Default trial plan slug">
                <Input
                  value={defaultPlanSlug}
                  onChange={(e) => setDefaultPlanSlug(e.target.value)}
                />
              </Field>
              <Field label="Default free trial days">
                <Input
                  type="number"
                  value={defaultTrialDays}
                  onChange={(e) => setDefaultTrialDays(Number(e.target.value))}
                />
              </Field>
              <Field label="Default data retention (days)">
                <Input
                  type="number"
                  value={defaultRetentionDays}
                  onChange={(e) => setDefaultRetentionDays(Number(e.target.value))}
                />
              </Field>
              <div className="sm:col-span-2 flex flex-col gap-4 border-t border-o-border pt-4">
                <Toggle
                  checked={defaultRequire2fa}
                  onChange={setDefaultRequire2fa}
                  label="Require 2FA for new workspace admins"
                  description="Enforce two-factor verification on newly provisioned tenant workspaces."
                />
                <Toggle
                  checked={maintenanceMode}
                  onChange={setMaintenanceMode}
                  label="Platform maintenance window banner"
                  description="Displays scheduled maintenance notice on System States diagnostics."
                />
                {maintenanceMode && (
                  <Field label="Maintenance notice copy">
                    <Input
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="Scheduled database maintenance window..."
                    />
                  </Field>
                )}
              </div>
            </div>
            <Alert tone="ai" className="mt-5">
              Note: Real-time host memory/CPU metrics and cross-tenant Stripe reconciliation webhooks remain tracked in BACKEND_GAPS.md.
            </Alert>
          </Card>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => void handleConfirmSuspend()}
        busy={suspendBusy}
        variant={suspendTarget?.is_suspended ? 'primary' : 'danger'}
        title={
          suspendTarget?.is_suspended
            ? `Reactivate ${suspendTarget?.name}?`
            : `Suspend ${suspendTarget?.name}?`
        }
        body={
          suspendTarget?.is_suspended
            ? 'Agents and public widgets will be restored immediately.'
            : 'All chat widgets, help center endpoints, and agent sessions for this workspace will pause.'
        }
        confirmLabel={suspendTarget?.is_suspended ? 'Reactivate' : 'Suspend workspace'}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void handleConfirmRevoke()}
        busy={revokingStaff}
        variant="danger"
        title={`Remove super admin access for ${revokeTarget?.email}?`}
        body="They will lose immediate access to /admin while keeping normal workspace memberships."
        confirmLabel="Revoke access"
      />

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite platform operator"
        description="Record an operator invitation for Super Admin console access."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={invitingStaff}
              onClick={() => void handleInviteStaff()}
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Operator name">
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Sarah Connor"
            />
          </Field>
          <Field label="Operator email">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="sarah@orbat.ai"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
