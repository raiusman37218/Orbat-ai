'use client';

import { useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  Clock,
  Gauge,
  Inbox,
  Lock,
  RefreshCw,
  SearchX,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Table,
  Textarea,
  useOrbToast,
  type BadgeTone,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { sendTestNotificationAction } from '@/lib/data/notifications';
import { loadSystemStatesLive, requestWorkspaceAccess } from '@/lib/data/states';
import { useData } from '@/lib/data/use-data';
import { roleCan } from '@/lib/team/permissions';
import { cn } from '@/lib/utils';

type StateCardId =
  | '404'
  | '403'
  | 'maintenance'
  | 'offline'
  | 'ai_unavailable'
  | 'loading'
  | 'empty'
  | 'session_expired'
  | 'rate_limited';

const STATE_TABS: Array<{ id: StateCardId; label: string }> = [
  { id: '404', label: '404 Not found' },
  { id: '403', label: '403 Access denied' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'offline', label: 'Offline' },
  { id: 'ai_unavailable', label: 'AI paused' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty inbox' },
  { id: 'session_expired', label: 'Session expired' },
  { id: 'rate_limited', label: 'Rate limited' },
];

const PROBE_TONE: Record<'operational' | 'degraded' | 'unavailable', BadgeTone> = {
  operational: 'ok',
  degraded: 'warn',
  unavailable: 'bad',
};

export function StatesScreen() {
  const { agent, workspace } = useShellSession();
  const workspaceId = workspace.id;
  const isAdmin = roleCan(agent.role, 'manage_settings');
  const { show } = useOrbToast();
  const { data, error, loading, reload } = useData(
    () => loadSystemStatesLive(workspaceId),
    ['system-states', workspaceId],
  );

  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [selectedState, setSelectedState] = useState<StateCardId>('404');
  const [reqOpen, setReqOpen] = useState(false);
  const [reqArea, setReqArea] = useState('Billing & workspace administration');
  const [reqNote, setReqNote] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);

  async function handleSendTestAlert() {
    setSendingTestAlert(true);
    try {
      await sendTestNotificationAction(workspaceId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orbat:notifications-refresh'));
      }
      show({
        message: 'Test alert sent — check the notification bell in the top bar.',
        tone: 'ok',
      });
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not send test alert.',
        tone: 'bad',
      });
    } finally {
      setSendingTestAlert(false);
    }
  }

  async function handleRequestAccess() {
    setSubmittingReq(true);
    try {
      await requestWorkspaceAccess(workspaceId, reqArea, reqNote);
      show({ message: 'Access request logged for your workspace owner.', tone: 'ok' });
      setReqOpen(false);
      setReqNote('');
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not submit request.',
        tone: 'bad',
      });
    } finally {
      setSubmittingReq(false);
    }
  }

  const accessColumns: Column<{
    id: string;
    requestedArea: string;
    note: string | null;
    status: string;
    createdAt: string;
  }>[] = [
    {
      key: 'area',
      header: 'Requested permission',
      cell: (r) => <span className="font-medium text-o-text">{r.requestedArea}</span>,
    },
    {
      key: 'note',
      header: 'Reason',
      hideBelow: 'md',
      cell: (r) => <span className="text-o-text-2">{r.note || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn'}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Submitted',
      align: 'right',
      cell: (r) => (
        <span className="o-num text-o-text-3">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="System states & platform health"
        description="Live diagnostic checks across your database, realtime API, and AI engine, plus every recoverable application state in light and dark mode."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSendTestAlert()}
                loading={sendingTestAlert}
                leading={<Bell size={15} />}
              >
                Send Test Alert
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={reload}
              loading={loading}
              leading={<RefreshCw size={15} />}
            >
              Re-run health probes
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <Skeleton className="h-[220px] rounded-[24px]" />
      ) : error && !data ? (
        <ErrorState title="Could not load live diagnostics" body={error} onRetry={reload} />
      ) : data ? (
        <Card>
          <CardHeader
            title={`Live diagnostics — ${data.workspaceName}`}
            sub={`Checked at ${new Date(data.checkedAt).toLocaleTimeString()} · ${data.unreadInboxCount} unassigned open conversations`}
            actions={
              <Badge tone={data.maintenanceMode ? 'warn' : 'ok'} dot>
                {data.maintenanceMode ? 'Maintenance window' : 'All core systems active'}
              </Badge>
            }
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.probes.map((probe) => (
              <div
                key={probe.id}
                className="flex flex-col justify-between gap-2 rounded-2xl border border-o-border bg-o-surface-2/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-o-text">
                    <Activity size={15} className="shrink-0 text-o-text-2" aria-hidden="true" />
                    <span>{probe.name}</span>
                  </div>
                  <Badge tone={PROBE_TONE[probe.status]}>{probe.status}</Badge>
                </div>
                <p className="text-[13px] text-o-text-2">{probe.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Application state catalog"
          sub="Inspect how ORBAT handles recoverable errors, offline retries, permission walls, and empty screens in both surface themes."
          actions={
            <Segmented
              label="Preview surface theme"
              value={previewTheme}
              onChange={setPreviewTheme}
              items={[
                { id: 'light', label: 'Light surface' },
                { id: 'dark', label: 'Dark surface' },
              ]}
            />
          }
        />

        <div className="mt-4 flex flex-wrap gap-1.5">
          {STATE_TABS.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={selectedState === tab.id ? 'primary' : 'secondary'}
              onClick={() => setSelectedState(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div
          data-theme={previewTheme}
          className={cn(
            'mt-5 rounded-[22px] border border-o-border p-6 transition-colors sm:p-10',
            previewTheme === 'dark' ? 'bg-[#101614] text-[#f3f6f4]' : 'bg-o-bg text-o-text',
          )}
        >
          {selectedState === '404' && (
            <EmptyState
              icon={<SearchX size={24} />}
              title="404 — We could not find that page"
              body="The conversation, ticket, or help article may have been archived or moved."
              action={
                <>
                  <ButtonLink href="/app" variant="primary" size="sm">
                    Back to overview
                  </ButtonLink>
                  <ButtonLink href="/app/inbox" variant="secondary" size="sm">
                    Open inbox
                  </ButtonLink>
                </>
              }
            />
          )}

          {selectedState === '403' && (
            <EmptyState
              icon={<Lock size={24} />}
              title="403 — Access restricted for your role"
              body="Ask your workspace owner or admin to grant permission for this section."
              action={
                <>
                  <Button variant="primary" size="sm" onClick={() => setReqOpen(true)}>
                    Request access
                  </Button>
                  <ButtonLink href="/app" variant="secondary" size="sm">
                    Return safely
                  </ButtonLink>
                </>
              }
            />
          )}

          {selectedState === 'maintenance' && (
            <EmptyState
              icon={<Wrench size={24} />}
              title="Scheduled maintenance in progress"
              body={
                data?.maintenanceMessage ||
                'Your customer chat widget stays queued while database maintenance completes.'
              }
              action={
                <Button variant="secondary" size="sm" onClick={reload}>
                  Check availability now
                </Button>
              }
            />
          )}

          {selectedState === 'offline' && (
            <EmptyState
              icon={<WifiOff size={24} />}
              title="You are offline — reconnecting"
              body="Draft replies are held in memory. Reconnect your network to resume live SSE updates."
              action={
                <Button variant="primary" size="sm" onClick={reload}>
                  Retry connection
                </Button>
              }
            />
          )}

          {selectedState === 'ai_unavailable' && (
            <EmptyState
              icon={<Bot size={24} />}
              title="AI model provider temporarily paused"
              body="New conversations route automatically to your online human queue until provider credentials resume."
              action={
                <ButtonLink href="/app/inbox" variant="primary" size="sm">
                  Review human queue
                </ButtonLink>
              }
            />
          )}

          {selectedState === 'loading' && (
            <div className="mx-auto max-w-[540px] flex flex-col gap-3">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          )}

          {selectedState === 'empty' && (
            <EmptyState
              icon={<Inbox size={24} />}
              title="You are all caught up"
              body="No open conversations match your current queue filters."
              action={
                <ButtonLink href="/widget" variant="secondary" size="sm">
                  Test live widget
                </ButtonLink>
              }
            />
          )}

          {selectedState === 'session_expired' && (
            <EmptyState
              icon={<Clock size={24} />}
              title="Your session expired"
              body="For workspace security, sign in again to continue managing customer threads."
              action={
                <ButtonLink href="/login" variant="primary" size="sm">
                  Sign in again
                </ButtonLink>
              }
            />
          )}

          {selectedState === 'rate_limited' && (
            <EmptyState
              icon={<Gauge size={24} />}
              title="Too many requests sent briefly"
              body="Rate protection is active on this endpoint. Wait a few seconds before retrying."
              action={
                <Button variant="secondary" size="sm" onClick={reload}>
                  Try again
                </Button>
              }
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Permission & access requests"
          sub="Members without access can submit a real request stored in workspace_access_requests for owner review."
          actions={
            <Button variant="secondary" size="sm" onClick={() => setReqOpen(true)}>
              New access request
            </Button>
          }
        />
        <div className="mt-4">
          {!data || data.recentAccessRequests.length === 0 ? (
            <EmptyState
              title="No access requests yet"
              body="When a team member requests elevated permissions on a 403 wall, it appears here."
            />
          ) : (
            <Table
              caption="Recent workspace access requests"
              columns={accessColumns}
              rows={data.recentAccessRequests}
              rowKey={(r) => r.id}
            />
          )}
        </div>
      </Card>

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request workspace access"
        description="Log a permission request for your workspace owner or admin."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReqOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submittingReq}
              onClick={() => void handleRequestAccess()}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Restricted area or setting">
            <Input
              value={reqArea}
              onChange={(e) => setReqArea(e.target.value)}
              placeholder="e.g. Billing, Compliance policies, Team roles"
            />
          </Field>
          <Field label="Why do you need access?">
            <Textarea
              rows={3}
              value={reqNote}
              onChange={(e) => setReqNote(e.target.value)}
              placeholder="Need access to review invoice receipts and manage team schedules..."
            />
          </Field>
        </div>
      </Modal>
    </PageContainer>
  );
}
