'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Alert,
  Avatar,
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
  Select,
  Skeleton,
  Table,
  TabPanel,
  Tabs,
  Toggle,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import { useData } from '@/lib/data/use-data';
import {
  ROLE_LABELS,
  assignableRoles,
  createTeamGroup,
  deactivateMember,
  deleteTeamGroup,
  getTeamCommandCenter,
  inviteMember,
  reactivateMember,
  reassignTicketQuick,
  resendInvite,
  revokeInvite,
  setTeamGroupMembers,
  updateMemberCapacity,
  updateMemberRole,
  updateTeamGroup,
  useTeamLiveSync,
  type AgentRosterMember,
  type AttentionItem,
  type ReassignMode,
  type Role,
  type TeamCommandBootstrap,
  type TeamGroupSummary,
} from '@/lib/data/team';
import { canManageMember } from '@/lib/team/permissions';
import { cn } from '@/lib/utils';

type TeamTab = 'command' | 'members' | 'teams' | 'roles';

function statusBadgeTone(status: AgentRosterMember['status']): BadgeTone {
  if (status === 'online') return 'ok';
  if (status === 'away') return 'warn';
  return 'neutral';
}

export function TeamScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [tab, setTab] = useState<TeamTab>('command');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Invite Modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('agent');
  const [inviteGroupIds, setInviteGroupIds] = useState<string[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<{ email: string; link: string; emailed: boolean } | null>(null);

  // Member Capacity Modal
  const [capacityTarget, setCapacityTarget] = useState<AgentRosterMember | null>(null);
  const [capacityVal, setCapacityVal] = useState('');

  // Deactivate Modal
  const [deactivateTarget, setDeactivateTarget] = useState<AgentRosterMember | null>(null);
  const [reassignMode, setReassignMode] = useState<ReassignMode>('round_robin');
  const [reassignTo, setReassignTo] = useState('');

  // Quick ticket reassign Modal (from Command Center Attention queue)
  const [reassignTicket, setReassignTicket] = useState<AttentionItem | null>(null);
  const [ticketAssigneeId, setTicketAssigneeId] = useState('');

  // Create / Edit Team Modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupRoundRobin, setGroupRoundRobin] = useState(true);
  const [editGroupMembersTarget, setEditGroupMembersTarget] = useState<TeamGroupSummary | null>(null);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<TeamGroupSummary | null>(null);

  const { data, loading, error, reload } = useData<TeamCommandBootstrap>(
    () => getTeamCommandCenter(workspace!.id),
    [workspace?.id],
    { enabled: Boolean(workspace?.id) },
  );

  useTeamLiveSync(workspace?.id, () => reload(), Boolean(workspace?.id));

  if (!workspace?.id) {
    return (
      <PageContainer>
        <ErrorState title="No workspace selected" body="Select a workspace to manage your team." />
      </PageContainer>
    );
  }

  async function handleInviteSubmit() {
    if (!workspace?.id) return;
    setBusyKey('invite');
    try {
      const res = await inviteMember(workspace.id, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        groupIds: inviteGroupIds,
      });
      setLastInviteLink({ email: res.email, link: res.link, emailed: res.emailed });
      show({
        message: res.emailed
          ? `Invitation emailed to ${res.email}`
          : `Invitation created — share the link below with ${res.email}`,
        tone: res.emailed ? 'ok' : 'info',
      });
      setInviteName('');
      setInviteEmail('');
      setInviteGroupIds([]);
      setInviteOpen(false);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to invite teammate', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleResendInvite(invId: string) {
    if (!workspace?.id) return;
    setBusyKey(`resend-${invId}`);
    try {
      const res = await resendInvite(workspace.id, invId);
      setLastInviteLink({ email: res.email, link: res.link, emailed: res.emailed });
      show({
        message: res.emailed ? `Fresh invite emailed to ${res.email}` : `Generated fresh invite link for ${res.email}`,
        tone: 'ok',
      });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to resend invite', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRevokeInvite(invId: string) {
    if (!workspace?.id) return;
    setBusyKey(`revoke-${invId}`);
    try {
      await revokeInvite(workspace.id, invId);
      show({ message: 'Invitation revoked', tone: 'info' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to revoke invite', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRoleChange(member: AgentRosterMember, role: Role) {
    if (!workspace?.id) return;
    setBusyKey(`role-${member.id}`);
    try {
      await updateMemberRole(workspace.id, member.id, role);
      show({ message: `${member.name} updated to ${ROLE_LABELS[role]}`, tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not update role', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveCapacity() {
    if (!workspace?.id || !capacityTarget) return;
    const raw = capacityVal.trim();
    const parsed = raw === '' ? null : Number(raw);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000)) {
      show({ message: 'Enter a limit between 1 and 1000, or leave blank for unlimited.', tone: 'bad' });
      return;
    }
    setBusyKey('cap');
    try {
      await updateMemberCapacity(workspace.id, capacityTarget.id, parsed);
      show({ message: `Capacity updated for ${capacityTarget.name}`, tone: 'ok' });
      setCapacityTarget(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not save capacity', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeactivate() {
    if (!workspace?.id || !deactivateTarget) return;
    setBusyKey('deactivate');
    try {
      const res = await deactivateMember(workspace.id, deactivateTarget.id, {
        mode: reassignMode,
        to: reassignMode === 'agent' ? reassignTo : null,
      });
      show({
        message: `${deactivateTarget.name} deactivated (${res.moved} ticket${res.moved === 1 ? '' : 's'} updated)`,
        tone: 'info',
      });
      setDeactivateTarget(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to deactivate member', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReactivate(member: AgentRosterMember) {
    if (!workspace?.id) return;
    setBusyKey(`reactivate-${member.id}`);
    try {
      await reactivateMember(workspace.id, member.id);
      show({ message: `${member.name} reactivated`, tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not reactivate', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReassignTicketConfirm() {
    if (!workspace?.id || !reassignTicket) return;
    setBusyKey('reassign-tk');
    try {
      await reassignTicketQuick(workspace.id, reassignTicket.targetId, ticketAssigneeId || null);
      show({ message: 'Ticket assignee updated', tone: 'ok' });
      setReassignTicket(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to reassign ticket', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateGroup() {
    if (!workspace?.id) return;
    if (!groupName.trim()) {
      show({ message: 'Enter a team name.', tone: 'bad' });
      return;
    }
    setBusyKey('create-grp');
    try {
      await createTeamGroup(workspace.id, { name: groupName.trim(), roundRobin: groupRoundRobin });
      show({ message: `Team "${groupName.trim()}" created`, tone: 'ok' });
      setGroupName('');
      setGroupModalOpen(false);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to create team', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveGroupMembers() {
    if (!workspace?.id || !editGroupMembersTarget) return;
    setBusyKey('save-grp-members');
    try {
      await setTeamGroupMembers(workspace.id, editGroupMembersTarget.id, selectedGroupMemberIds);
      show({ message: `Updated members for ${editGroupMembersTarget.name}`, tone: 'ok' });
      setEditGroupMembersTarget(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to update team members', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteGroup() {
    if (!workspace?.id || !deleteGroupTarget) return;
    setBusyKey('delete-grp');
    try {
      await deleteTeamGroup(workspace.id, deleteGroupTarget.id);
      show({ message: `Deleted team "${deleteGroupTarget.name}"`, tone: 'info' });
      setDeleteGroupTarget(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to delete team', tone: 'bad' });
    } finally {
      setBusyKey(null);
    }
  }

  const activeMembers = data?.members.filter((m) => m.isActive) ?? [];
  const roleChoices = data ? assignableRoles(data.me.role) : [];

  const memberColumns: Column<AgentRosterMember>[] = [
    {
      key: 'member',
      header: 'Member',
      cell: (m) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={m.name} src={m.avatarUrl} size={34} presence={m.isActive ? m.status : 'offline'} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-o-text">
              {m.name}
              {!m.isActive ? (
                <Badge tone="neutral" className="ml-2">
                  Deactivated
                </Badge>
              ) : null}
            </div>
            <div className="truncate text-[12px] text-o-text-3">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => {
        const editable = data && m.isActive && canManageMember(data.me, m);
        if (!editable) {
          return <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>{ROLE_LABELS[m.role]}</Badge>;
        }
        const options = Array.from(new Set([m.role, ...roleChoices])).map((r) => ({
          value: r,
          label: ROLE_LABELS[r],
        }));
        return (
          <Select
            size="sm"
            aria-label={`Role for ${m.name}`}
            value={m.role}
            disabled={busyKey === `role-${m.id}`}
            options={options}
            onChange={(e) => handleRoleChange(m, e.target.value as Role)}
          />
        );
      },
    },
    {
      key: 'status',
      header: 'Presence',
      hideBelow: 'sm',
      cell: (m) => (
        <Badge dot tone={m.isActive ? statusBadgeTone(m.status) : 'neutral'}>
          {m.isActive ? m.status : 'inactive'}
        </Badge>
      ),
    },
    {
      key: 'teams',
      header: 'Teams',
      hideBelow: 'md',
      cell: (m) => {
        const names = (data?.groups || []).filter((g) => m.groupIds.includes(g.id)).map((g) => g.name);
        if (!names.length) return <span className="text-[12.5px] text-o-text-3">All general</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((n) => (
              <Badge key={n} tone="neutral">
                {n}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'load',
      header: 'Open / Cap',
      align: 'right',
      cell: (m) => (
        <button
          type="button"
          className="o-num text-[13px] font-medium text-o-text hover:underline disabled:no-underline"
          disabled={!data?.canManageTeam || !m.isActive}
          onClick={() => {
            setCapacityTarget(m);
            setCapacityVal(m.maxCapacity === null ? '' : String(m.maxCapacity));
          }}
          title={data?.canManageTeam ? 'Edit capacity limit' : undefined}
        >
          {m.openTickets} / {m.maxCapacity === null ? '∞' : m.maxCapacity}
        </button>
      ),
    },
    {
      key: 'csat',
      header: 'CSAT',
      align: 'right',
      hideBelow: 'lg',
      cell: (m) =>
        m.csatAvg !== null ? (
          <span className="o-num font-medium text-o-ok">
            {m.csatAvg.toFixed(1)} ★ <span className="text-o-text-3 text-[11.5px]">({m.csatCount})</span>
          </span>
        ) : (
          <span className="text-o-text-3">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => {
        if (!data || !canManageMember(data.me, m)) return null;
        return m.isActive ? (
          <Button
            size="sm"
            variant="ghost"
            leading={<UserMinus size={14} />}
            onClick={() => {
              setDeactivateTarget(m);
              setReassignMode('round_robin');
              setReassignTo(activeMembers.find((a) => a.id !== m.id)?.id || '');
            }}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={busyKey === `reactivate-${m.id}`}
            onClick={() => handleReactivate(m)}
          >
            Reactivate
          </Button>
        );
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Team & Command Center"
        description={
          data
            ? `${data.kpis.totalActiveAgents} active seat${data.kpis.totalActiveAgents === 1 ? '' : 's'} · ${data.kpis.availableAgents} online right now`
            : 'Coordinate live workload, shifts, roles, and specialist teams'
        }
        actions={
          <>
            <ButtonLink href="/app/team/schedule" variant="secondary" leading={<CalendarClock size={15} />}>
              Office hours &amp; schedule
            </ButtonLink>
            <ButtonLink href="/app/handoff" variant="secondary" leading={<UserCheck size={15} />}>
              Handoff queue
            </ButtonLink>
            {data?.canManageTeam ? (
              <Button variant="primary" leading={<UserPlus size={15} />} onClick={() => setInviteOpen(true)}>
                Invite teammate
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <ErrorState title="Could not load team" body={error} onRetry={reload} /> : null}

      {lastInviteLink ? (
        <Alert tone={lastInviteLink.emailed ? 'ok' : 'warn'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <strong>{lastInviteLink.email}</strong>:{' '}
              {lastInviteLink.emailed ? 'Invitation email sent.' : 'SMTP not configured — copy invite link to share:'}{' '}
              <code className="break-all text-[12px]">{lastInviteLink.link}</code>
            </div>
            <Button
              size="sm"
              variant="secondary"
              leading={<Copy size={14} />}
              onClick={async () => {
                await navigator.clipboard?.writeText(lastInviteLink.link);
                show({ message: 'Invite link copied to clipboard', tone: 'ok' });
              }}
            >
              Copy link
            </Button>
          </div>
        </Alert>
      ) : null}

      <Tabs<TeamTab>
        idBase="team"
        label="Team sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'command', label: 'Command center', count: data?.attention.length },
          { id: 'members', label: 'Members', count: data?.members.length },
          { id: 'teams', label: 'Teams', count: data?.groups.length },
          { id: 'roles', label: 'Roles & permissions' },
        ]}
      />

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {data && tab === 'command' ? (
        <TabPanel idBase="team" id="command" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="p-4">
              <div className="text-[12.5px] font-medium text-o-text-3">Available agents</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="o-num text-[26px] font-bold text-o-text">{fmtInt(data.kpis.availableAgents)}</span>
                <span className="text-[12.5px] text-o-text-3">of {fmtInt(data.kpis.totalActiveAgents)}</span>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[12.5px] font-medium text-o-text-3">Waiting handoffs</div>
              <div className="mt-1 text-[26px] font-bold o-num text-o-text">{fmtInt(data.kpis.waitingChats)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[12.5px] font-medium text-o-text-3">SLAs at risk</div>
              <div
                className={cn(
                  'mt-1 text-[26px] font-bold o-num',
                  data.kpis.atRiskSlas > 0 ? 'text-o-bad' : 'text-o-text',
                )}
              >
                {fmtInt(data.kpis.atRiskSlas)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[12.5px] font-medium text-o-text-3">AI needs review</div>
              <div className="mt-1 text-[26px] font-bold o-num text-o-ai">{fmtInt(data.kpis.aiNeedsReview)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[12.5px] font-medium text-o-text-3">At / over capacity</div>
              <div
                className={cn(
                  'mt-1 text-[26px] font-bold o-num',
                  data.kpis.overloadedAgents > 0 ? 'text-o-warn' : 'text-o-text',
                )}
              >
                {fmtInt(data.kpis.overloadedAgents)}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Needs attention"
                sub="Breached SLAs, queued handoffs, unverified AI drafts, and overloaded seats"
                actions={
                  <Button size="sm" variant="ghost" leading={<RefreshCw size={14} />} onClick={() => reload()}>
                    Refresh
                  </Button>
                }
              />
              {data.attention.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 size={22} />}
                  title="Queue is clear"
                  body="No SLA warnings, waiting handoffs, or unreviewed AI items need attention right now."
                />
              ) : (
                <div className="mt-4 divide-y divide-o-border">
                  {data.attention.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={item.severity === 'high' ? 'bad' : 'warn'}>
                            {item.kind === 'sla_risk'
                              ? 'SLA'
                              : item.kind === 'waiting_handoff'
                                ? 'Handoff'
                                : item.kind === 'ai_review'
                                  ? 'AI review'
                                  : 'Capacity'}
                          </Badge>
                          <span className="truncate text-[13.5px] font-semibold text-o-text">{item.title}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] text-o-text-2">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.targetType === 'ticket' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReassignTicket(item);
                              setTicketAssigneeId(item.assigneeId || '');
                            }}
                          >
                            Reassign
                          </Button>
                        ) : null}
                        <ButtonLink size="sm" variant="ghost" href={item.actionHref}>
                          Open
                        </ButtonLink>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Live workload"
                sub="AI throughput alongside each active team member's ticket capacity"
              />
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-o-ai/25 bg-o-ai-soft/60 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-o-ai text-white">
                    <Bot size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-o-text">
                        {data.aiWorkload.primaryAgentName || 'AI Assistant'}
                      </span>
                      <Badge tone="ai">Autopilot</Badge>
                    </div>
                    <div className="text-[12px] text-o-text-2">
                      {fmtInt(data.aiWorkload.activeConversations)} active AI chats ·{' '}
                      {fmtInt(data.aiWorkload.repliesToday)} AI replies today
                    </div>
                  </div>
                  <ButtonLink size="sm" variant="ghost" href="/app/agents">
                    Configure
                  </ButtonLink>
                </div>

                {activeMembers.length === 0 ? (
                  <EmptyState
                    icon={<Users size={22} />}
                    title="No active members"
                    body="Invite teammates so they appear in the live capacity tracker."
                  />
                ) : (
                  <div className="divide-y divide-o-border">
                    {activeMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-2.5">
                        <Avatar name={m.name} src={m.avatarUrl} size={32} presence={m.status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-o-text">{m.name}</div>
                          <div className="text-[12px] text-o-text-3">
                            {ROLE_LABELS[m.role]} · {m.openTickets} tickets / {m.activeChats} chats
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5" aria-label={`Capacity load ${m.loadPct}%`}>
                            {Array.from({ length: 8 }).map((_, idx) => (
                              <span
                                key={idx}
                                className={cn(
                                  'h-3 w-1.5 rounded-sm',
                                  idx < m.loadSlots
                                    ? m.isOverloaded
                                      ? 'bg-o-bad'
                                      : m.loadSlots >= 6
                                        ? 'bg-o-warn'
                                        : 'bg-o-ok'
                                    : 'bg-o-surface-3',
                                )}
                              />
                            ))}
                          </div>
                          <span className="o-num w-12 text-right text-[12px] font-medium text-o-text-2">
                            {m.openTickets}/{m.maxCapacity ?? '∞'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabPanel>
      ) : null}

      {data && tab === 'members' ? (
        <TabPanel idBase="team" id="members" className="flex flex-col gap-6">
          <Card flush>
            <div className="border-b border-o-border p-4 sm:px-6">
              <CardHeader
                title="Workspace roster"
                sub="Roles control workspace permissions; click Open / Cap to adjust ticket capacity limits."
              />
            </div>
            {data.members.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No teammates yet"
                  body="Invite your support specialists and admins to collaborate."
                />
              </div>
            ) : (
              <Table<AgentRosterMember>
                rows={data.members}
                rowKey={(m) => m.id}
                caption="Workspace team roster"
                columns={memberColumns}
              />
            )}
          </Card>

          {data.invitations.length > 0 ? (
            <Card>
              <CardHeader
                title={`Pending invitations (${data.invitations.length})`}
                sub="Invitations expire after 7 days. Resend generates a fresh secure token."
              />
              <div className="mt-4 divide-y divide-o-border">
                {data.invitations.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-o-text-3" />
                        <span className="font-medium text-o-text">{inv.name || inv.email}</span>
                        <Badge tone="neutral">{ROLE_LABELS[inv.role]}</Badge>
                      </div>
                      <div className="mt-0.5 text-[12px] text-o-text-3">
                        {inv.email} · Sent {inv.lastSentAt ? timeAgo(inv.lastSentAt) : 'pending link share'}
                        {inv.sendError ? <span className="ml-2 text-o-warn">· {inv.sendError}</span> : null}
                      </div>
                    </div>
                    {data.canManageTeam ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyKey === `resend-${inv.id}`}
                          onClick={() => handleResendInvite(inv.id)}
                        >
                          Resend / New link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busyKey === `revoke-${inv.id}`}
                          onClick={() => handleRevokeInvite(inv.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </TabPanel>
      ) : null}

      {data && tab === 'teams' ? (
        <TabPanel idBase="team" id="teams" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13.5px] text-o-text-2">
              Group teammates by specialty (Billing, VIP, Technical) for round-robin ticket routing.
            </div>
            {data.canManageGroups ? (
              <Button variant="primary" size="sm" leading={<Plus size={15} />} onClick={() => setGroupModalOpen(true)}>
                New team
              </Button>
            ) : null}
          </div>

          {data.groups.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="No teams created yet"
              body="Create specialist groups to enable round-robin ticket assignment and filtered queues."
              action={
                data.canManageGroups ? (
                  <Button variant="primary" onClick={() => setGroupModalOpen(true)}>
                    Create first team
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.groups.map((grp) => {
                const groupMembers = data.members.filter((m) => grp.memberIds.includes(m.id));
                return (
                  <Card key={grp.id} className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[15.5px] font-semibold text-o-text">{grp.name}</h3>
                        <div className="mt-0.5 text-[12.5px] text-o-text-3">
                          {grp.memberIds.length} member{grp.memberIds.length === 1 ? '' : 's'} ·{' '}
                          {fmtInt(grp.openTicketsCount)} open tickets
                        </div>
                      </div>
                      <Badge tone={grp.roundRobin ? 'ok' : 'neutral'}>
                        {grp.roundRobin ? 'Round-robin on' : 'Manual assign'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {groupMembers.length === 0 ? (
                        <span className="text-[12.5px] text-o-text-3">No members assigned yet</span>
                      ) : (
                        groupMembers.slice(0, 6).map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-o-surface-2 px-2.5 py-1 text-[12px] text-o-text"
                          >
                            <Avatar name={m.name} src={m.avatarUrl} size={18} />
                            {m.name}
                          </span>
                        ))
                      )}
                    </div>

                    {data.canManageGroups ? (
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-o-border pt-3">
                        <Toggle
                          checked={grp.roundRobin}
                          label="Round-robin"
                          onChange={async (next) => {
                            try {
                              await updateTeamGroup(workspace.id, grp.id, { roundRobin: next });
                              await reload();
                            } catch (err) {
                              show({
                                message: err instanceof Error ? err.message : 'Update failed',
                                tone: 'bad',
                              });
                            }
                          }}
                        />
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditGroupMembersTarget(grp);
                              setSelectedGroupMemberIds(grp.memberIds);
                            }}
                          >
                            Members
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon
                            aria-label={`Delete ${grp.name}`}
                            onClick={() => setDeleteGroupTarget(grp)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </TabPanel>
      ) : null}

      {data && tab === 'roles' ? (
        <TabPanel idBase="team" id="roles" className="flex flex-col gap-5">
          <Alert tone="ok">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <span>
                Permissions below are enforced in PostgreSQL Row Level Security via{' '}
                <code>fn_workspace_role</code> and <code>fn_role_has</code>. Custom per-capability overrides are tracked in{' '}
                <Link href="/app/compliance" className="underline">
                  Compliance &amp; Audit
                </Link>
                .
              </span>
            </div>
          </Alert>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.roleMatrix.roles.map((r) => (
              <Card key={r.role} className="p-4">
                <div className="font-semibold text-o-text">{r.label}</div>
                <p className="mt-1 text-[12.5px] text-o-text-2">{r.description}</p>
              </Card>
            ))}
          </div>

          <Card flush>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-o-border bg-o-surface-2/60">
                    <th className="px-4 py-3 font-semibold text-o-text-2">Capability</th>
                    {data.roleMatrix.roles.map((r) => (
                      <th key={r.role} className="px-4 py-3 text-center font-semibold text-o-text-2">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-o-border">
                  {data.roleMatrix.capabilities.map((cap) => (
                    <tr key={cap.key}>
                      <td className="px-4 py-3 text-o-text">
                        <div className="font-medium">{cap.label}</div>
                        <code className="text-[11.5px] text-o-text-3">{cap.key}</code>
                      </td>
                      {data.roleMatrix.roles.map((r) => {
                        const allowed = cap.allowedRoles.includes(r.role);
                        return (
                          <td key={r.role} className="px-4 py-3 text-center">
                            {allowed ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-o-ok-soft text-o-ok font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="text-o-text-3">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabPanel>
      ) : null}

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite teammate"
        description="They will receive a secure one-time sign-in and onboarding link."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'invite'} onClick={handleInviteSubmit}>
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Full name">
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Ayesha Khan"
            />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ayesha@company.com"
            />
          </Field>
          <Field label="Workspace role">
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              options={(roleChoices.length ? roleChoices : (['agent', 'light_agent'] as Role[])).map((r) => ({
                value: r,
                label: ROLE_LABELS[r],
              }))}
            />
          </Field>
          {data?.groups.length && inviteRole !== 'light_agent' ? (
            <div>
              <div className="mb-1.5 text-[12.5px] font-medium text-o-text-2">Assign to teams (optional)</div>
              <div className="flex flex-wrap gap-2">
                {data.groups.map((g) => {
                  const checked = inviteGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        setInviteGroupIds((prev) =>
                          prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                        )
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-[12.5px] font-medium transition',
                        checked
                          ? 'border-o-accent bg-o-accent-soft text-o-accent-text'
                          : 'border-o-border bg-o-surface text-o-text-2',
                      )}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Capacity Modal */}
      <Modal
        open={Boolean(capacityTarget)}
        onClose={() => setCapacityTarget(null)}
        title={`Capacity limit · ${capacityTarget?.name || ''}`}
        description="Maximum open tickets before the agent is flagged at capacity. Leave empty for unlimited."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCapacityTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'cap'} onClick={handleSaveCapacity}>
              Save limit
            </Button>
          </>
        }
      >
        <Field label="Max open tickets" hint="Currently has unlimited if left blank">
          <Input
            type="number"
            min={1}
            max={1000}
            value={capacityVal}
            onChange={(e) => setCapacityVal(e.target.value)}
            placeholder="e.g. 12"
          />
        </Field>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.name || 'member'}`}
        description="Choose what should happen to their currently assigned open tickets."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busyKey === 'deactivate'} onClick={handleDeactivate}>
              Deactivate member
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Open ticket reassignment">
            <Select
              value={reassignMode}
              onChange={(e) => setReassignMode(e.target.value as ReassignMode)}
              options={[
                { value: 'round_robin', label: 'Distribute across active teammates (round-robin)' },
                { value: 'agent', label: 'Assign all to a specific teammate' },
                { value: 'unassign', label: 'Leave tickets unassigned in team queue' },
              ]}
            />
          </Field>
          {reassignMode === 'agent' ? (
            <Field label="Target teammate">
              <Select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                options={activeMembers
                  .filter((m) => m.id !== deactivateTarget?.id && m.role !== 'light_agent')
                  .map((m) => ({ value: m.id, label: m.name }))}
              />
            </Field>
          ) : null}
        </div>
      </Modal>

      {/* Quick Ticket Reassign Modal */}
      <Modal
        open={Boolean(reassignTicket)}
        onClose={() => setReassignTicket(null)}
        title="Reassign ticket"
        description={reassignTicket?.title || ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassignTicket(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'reassign-tk'} onClick={handleReassignTicketConfirm}>
              Update assignee
            </Button>
          </>
        }
      >
        <Field label="Assign to teammate">
          <Select
            value={ticketAssigneeId}
            onChange={(e) => setTicketAssigneeId(e.target.value)}
            options={[
              { value: '', label: 'Unassigned (team queue)' },
              ...activeMembers
                .filter((m) => m.role !== 'light_agent')
                .map((m) => ({ value: m.id, label: `${m.name} (${m.openTickets} open)` })),
            ]}
          />
        </Field>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title="Create team"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'create-grp'} onClick={handleCreateGroup}>
              Create team
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Team name">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. VIP & Billing" />
          </Field>
          <Toggle
            checked={groupRoundRobin}
            onChange={setGroupRoundRobin}
            label="Enable round-robin assignment"
            description="Automatically balance new group tickets evenly across active team members."
          />
        </div>
      </Modal>

      {/* Edit Team Members Modal */}
      <Modal
        open={Boolean(editGroupMembersTarget)}
        onClose={() => setEditGroupMembersTarget(null)}
        title={`Members · ${editGroupMembersTarget?.name || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditGroupMembersTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busyKey === 'save-grp-members'} onClick={handleSaveGroupMembers}>
              Save members
            </Button>
          </>
        }
      >
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {activeMembers
            .filter((m) => m.role !== 'light_agent')
            .map((m) => {
              const on = selectedGroupMemberIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setSelectedGroupMemberIds((prev) =>
                      prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                    )
                  }
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2 text-left transition',
                    on ? 'border-o-accent bg-o-accent-soft' : 'border-o-border bg-o-surface',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} src={m.avatarUrl} size={28} />
                    <div>
                      <div className="text-[13.5px] font-medium text-o-text">{m.name}</div>
                      <div className="text-[12px] text-o-text-3">{ROLE_LABELS[m.role]}</div>
                    </div>
                  </div>
                  <Badge tone={on ? 'ok' : 'neutral'}>{on ? 'Included' : 'Add'}</Badge>
                </button>
              );
            })}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteGroupTarget)}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={handleDeleteGroup}
        busy={busyKey === 'delete-grp'}
        variant="danger"
        title={`Delete team “${deleteGroupTarget?.name}”?`}
        body="Existing tickets remain untouched, but their group tag will be cleared."
        confirmLabel="Delete team"
      />
    </PageContainer>
  );
}
