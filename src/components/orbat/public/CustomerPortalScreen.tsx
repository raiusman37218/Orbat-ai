'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  Alert,
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
  Select,
  Skeleton,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import {
  loadCustomerPortal,
  markPortalTicketSolved,
  replyToPortalTicket,
  requestPortalVerificationCode,
  signOutCustomerPortal,
  submitPortalCsatRating,
  verifyPortalByTicket,
  verifyPortalOtp,
  type PortalCsatChoice,
} from '@/lib/data/customer-portal';
import { submitHelpCenterTicket } from '@/lib/data/help-center';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

const CSAT_OPTIONS: Array<{ id: PortalCsatChoice; label: string }> = [
  { id: 'bad', label: 'Bad' },
  { id: 'okay', label: 'Okay' },
  { id: 'good', label: 'Good' },
  { id: 'great', label: 'Great' },
];

const STEPS = ['Received', 'In progress', 'Solved'];

export function CustomerPortalScreen({
  initialWorkspaceKey,
}: {
  initialWorkspaceKey?: string | null;
}) {
  const { show } = useOrbToast();
  const [wsKey, setWsKey] = useState(initialWorkspaceKey || '');
  const { data, error, loading, reload } = useData(
    () => loadCustomerPortal(wsKey || undefined),
    ['customer-portal', wsKey],
  );

  // Verification form
  const [verifyMode, setVerifyMode] = useState<'ticket' | 'otp'>('ticket');
  const [email, setEmail] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [smtpNotice, setSmtpNotice] = useState<string | null>(null);

  // Portal workspace
  const [filterBucket, setFilterBucket] = useState<'all' | 'open' | 'solved'>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [solving, setSolving] = useState(false);
  const [csatComment, setCsatComment] = useState('');
  const [savingCsat, setSavingCsat] = useState(false);

  // New request modal
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creatingReq, setCreatingReq] = useState(false);

  const filteredTickets = useMemo(() => {
    const list = data?.tickets || [];
    if (filterBucket === 'all') return list;
    return list.filter((t) => t.portalBucket === filterBucket);
  }, [data?.tickets, filterBucket]);

  const activeTicket =
    filteredTickets.find((t) => t.id === selectedTicketId) ?? filteredTickets[0] ?? null;

  async function handleVerifyByTicket() {
    if (!data?.workspace) return;
    setVerifying(true);
    try {
      const res = await verifyPortalByTicket(data.workspace.id, email, ticketRef);
      if (!res.verified) {
        show({ message: res.error || 'Verification failed.', tone: 'bad' });
      } else {
        show({ message: 'Signed in to My requests.', tone: 'ok' });
        reload();
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleRequestOtp() {
    if (!data?.workspace) return;
    setVerifying(true);
    setSmtpNotice(null);
    try {
      const res = await requestPortalVerificationCode(data.workspace.id, email);
      if (res.sent) {
        setOtpSent(true);
        show({ message: res.message, tone: 'ok' });
      } else {
        setSmtpNotice(res.message);
      }
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not send verification code.',
        tone: 'bad',
      });
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerifyOtp() {
    if (!data?.workspace) return;
    setVerifying(true);
    try {
      const res = await verifyPortalOtp(data.workspace.id, email, otpCode);
      if (!res.verified) {
        show({ message: res.error || 'Invalid code.', tone: 'bad' });
      } else {
        show({ message: 'Email verified.', tone: 'ok' });
        reload();
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleReply() {
    if (!data?.workspace || !activeTicket) return;
    setSendingReply(true);
    try {
      await replyToPortalTicket(data.workspace.id, activeTicket.id, replyBody);
      setReplyBody('');
      show({ message: 'Reply sent to the support team.', tone: 'ok' });
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not send reply.',
        tone: 'bad',
      });
    } finally {
      setSendingReply(false);
    }
  }

  async function handleMarkSolved() {
    if (!data?.workspace || !activeTicket) return;
    setSolving(true);
    try {
      await markPortalTicketSolved(data.workspace.id, activeTicket.id);
      show({ message: 'Marked request as solved.', tone: 'ok' });
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not update request.',
        tone: 'bad',
      });
    } finally {
      setSolving(false);
    }
  }

  async function handleRateCsat(rating: PortalCsatChoice) {
    if (!data?.workspace || !activeTicket) return;
    setSavingCsat(true);
    try {
      await submitPortalCsatRating(data.workspace.id, activeTicket.id, rating, csatComment);
      show({ message: 'Thanks for rating our support.', tone: 'ok' });
      setCsatComment('');
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not save rating.',
        tone: 'bad',
      });
    } finally {
      setSavingCsat(false);
    }
  }

  async function handleCreateRequest() {
    if (!data?.workspace || !data.customerEmail) return;
    setCreatingReq(true);
    try {
      const res = await submitHelpCenterTicket({
        workspaceId: data.workspace.id,
        name: newName || data.customerName || data.customerEmail,
        email: data.customerEmail,
        subject: newSubject,
        message: newMessage,
      });
      show({ message: `Opened request #TCK-${res.ticketNumber}.`, tone: 'ok' });
      setNewOpen(false);
      setNewSubject('');
      setNewMessage('');
      setSelectedTicketId(res.ticketId);
      reload();
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not create request.',
        tone: 'bad',
      });
    } finally {
      setCreatingReq(false);
    }
  }

  async function handleSignOut() {
    await signOutCustomerPortal();
    reload();
  }

  return (
    <div className="min-h-screen bg-o-bg text-o-text">
      <header className="border-b border-o-border bg-o-surface">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-xl font-bold text-white"
              style={{ backgroundColor: data?.workspace?.brandColor || '#224F41' }}
            >
              {(data?.workspace?.name || 'O').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="text-[16px] font-semibold text-o-text">My requests</h1>
              <p className="text-[12.5px] text-o-text-3">
                {data?.workspace?.name || 'Customer request portal'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data && data.availableWorkspaces.length > 1 && (
              <Select
                size="sm"
                aria-label="Workspace portal"
                value={data.workspace?.id || ''}
                onChange={(e) => {
                  setWsKey(e.target.value);
                  setSelectedTicketId(null);
                }}
                options={data.availableWorkspaces.map((w) => ({
                  value: w.id,
                  label: w.name,
                }))}
              />
            )}
            <ButtonLink href="/v2/help" variant="secondary" size="sm">
              Help center
            </ButtonLink>
            {data?.signedIn && (
              <Button
                variant="quiet"
                size="sm"
                leading={<LogOut size={14} />}
                onClick={() => void handleSignOut()}
              >
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
        {loading && !data ? (
          <Skeleton className="h-[420px] rounded-[24px]" />
        ) : error && !data ? (
          <ErrorState title="Could not load customer portal" body={error} onRetry={reload} />
        ) : !data?.workspace ? (
          <EmptyState
            title="No workspace available"
            body="Open onboarding to initialize a workspace and submit your first ticket."
            action={<ButtonLink href="/v2/onboarding">Set up workspace</ButtonLink>}
          />
        ) : !data.signedIn ? (
          <Card size="lg" className="mx-auto max-w-[560px]">
            <div className="flex items-center gap-2.5 text-o-forest">
              <ShieldCheck size={22} />
              <h2 className="text-[20px] font-semibold text-o-text">
                Verify access to your support requests
              </h2>
            </div>
            <p className="mt-1.5 text-[14.5px] text-o-text-2">
              Sessions are scoped to your email address and protected with an HttpOnly signed token.
            </p>

            <div className="mt-5">
              <Segmented
                label="Verification method"
                value={verifyMode}
                onChange={setVerifyMode}
                items={[
                  { id: 'ticket', label: 'Email + Ticket #' },
                  { id: 'otp', label: 'Email 6-digit code' },
                ]}
              />
            </div>

            {verifyMode === 'ticket' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleVerifyByTicket();
                }}
                className="mt-5 flex flex-col gap-4"
              >
                <Field label="Email address">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                <Field label="Ticket number" hint="Find this on your confirmation notice (e.g. TCK-1001 or 1001)">
                  <Input
                    required
                    value={ticketRef}
                    onChange={(e) => setTicketRef(e.target.value)}
                    placeholder="TCK-1001"
                  />
                </Field>
                <Button type="submit" variant="primary" loading={verifying}>
                  View my requests
                </Button>
              </form>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                {!data.smtpConfigured && (
                  <Alert tone="warn">
                    Outbound SMTP is not configured in this workspace yet. Use &ldquo;Email + Ticket #&rdquo; or open a request from Help Center to auto-verify.
                  </Alert>
                )}
                {smtpNotice && <Alert tone="warn">{smtpNotice}</Alert>}
                <Field label="Email address">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                {otpSent ? (
                  <>
                    <Field label="6-digit verification code">
                      <Input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                      />
                    </Field>
                    <Button variant="primary" loading={verifying} onClick={() => void handleVerifyOtp()}>
                      Verify code
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" loading={verifying} onClick={() => void handleRequestOtp()}>
                    Send verification code
                  </Button>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-o-border pt-4 text-[13.5px] text-o-text-2">
              Opening a brand-new issue?{' '}
              <Link href="/v2/help#contact" className="font-semibold text-o-forest">
                Contact support
              </Link>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14px] text-o-text-2">
                  Signed in as <strong className="text-o-text">{data.customerEmail}</strong>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Ticket filter"
                  value={filterBucket}
                  onChange={setFilterBucket}
                  items={[
                    { id: 'all', label: `All (${data.tickets.length})` },
                    {
                      id: 'open',
                      label: `Open (${data.tickets.filter((t) => t.portalBucket === 'open').length})`,
                    },
                    {
                      id: 'solved',
                      label: `Solved (${data.tickets.filter((t) => t.portalBucket === 'solved').length})`,
                    },
                  ]}
                />
                <Button
                  size="sm"
                  variant="primary"
                  leading={<Plus size={15} />}
                  onClick={() => setNewOpen(true)}
                >
                  New request
                </Button>
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <EmptyState
                title="No matching support requests"
                body="Open a new support request or switch status filters."
                action={
                  <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
                    Open new request
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                <Card flush className="h-fit">
                  <ul className="divide-y divide-o-border" aria-label="Your requests list">
                    {filteredTickets.map((t) => {
                      const active = t.id === activeTicket?.id;
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedTicketId(t.id)}
                            className={cn(
                              'flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition',
                              active ? 'bg-o-surface-2' : 'hover:bg-o-surface-2/40',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="o-num text-[12px] font-semibold text-o-text-3">
                                TCK-{t.number}
                              </span>
                              <Badge
                                tone={t.portalBucket === 'solved' ? 'ok' : 'accent'}
                              >
                                {t.portalStepLabel}
                              </Badge>
                            </div>
                            <p className="truncate text-[14.5px] font-semibold text-o-text">
                              {t.subject}
                            </p>
                            {t.lastMessagePreview && (
                              <p className="line-clamp-1 text-[13px] text-o-text-2">
                                {t.lastMessagePreview}
                              </p>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>

                {activeTicket && (
                  <Card size="lg" className="flex flex-col gap-6">
                    <CardHeader
                      title={`#TCK-${activeTicket.number} — ${activeTicket.subject}`}
                      sub={`Updated ${new Date(activeTicket.updatedAt).toLocaleString()}${
                        activeTicket.assigneeName ? ` · Assigned to ${activeTicket.assigneeName}` : ''
                      }`}
                      actions={
                        activeTicket.portalBucket !== 'solved' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={solving}
                            leading={<CheckCircle2 size={15} />}
                            onClick={() => void handleMarkSolved()}
                          >
                            My issue is solved
                          </Button>
                        ) : (
                          <Badge tone="ok" dot>
                            Solved
                          </Badge>
                        )
                      }
                    />

                    {/* 3-step progress bar (Received -> In progress -> Solved) */}
                    <div className="rounded-2xl border border-o-border bg-o-surface-2/50 p-4">
                      <div className="grid grid-cols-3 gap-2">
                        {STEPS.map((label, idx) => {
                          const reached = activeTicket.portalStep >= idx;
                          return (
                            <div key={label} className="flex flex-col gap-1.5">
                              <div
                                className={cn(
                                  'h-2 rounded-full',
                                  reached ? 'bg-o-forest' : 'bg-o-border',
                                )}
                              />
                              <span
                                className={cn(
                                  'text-[12.5px] font-medium',
                                  reached ? 'text-o-text' : 'text-o-text-3',
                                )}
                              >
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Message thread */}
                    <div className="flex flex-col gap-3">
                      {activeTicket.messages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-o-border p-4 text-center text-[13.5px] text-o-text-2">
                          No public messages on this ticket thread yet. Add a reply below.
                        </div>
                      ) : (
                        activeTicket.messages.map((m) => {
                          const isCustomer = m.senderType === 'visitor';
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                'rounded-2xl border p-4',
                                isCustomer
                                  ? 'border-o-forest/20 bg-o-surface-2/60'
                                  : 'border-o-border bg-o-surface',
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 text-[12.5px]">
                                <span className="font-semibold text-o-text">
                                  {m.senderName}
                                </span>
                                <span className="text-o-text-3">
                                  {new Date(m.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1.5 whitespace-pre-line text-[14.5px] text-o-text">
                                {m.content}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Reply box */}
                    {activeTicket.status !== 'closed' && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleReply();
                        }}
                        className="flex flex-col gap-3 border-t border-o-border pt-4"
                      >
                        <Field label="Reply to this request">
                          <Textarea
                            rows={3}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Add an update or question..."
                          />
                        </Field>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            loading={sendingReply}
                            leading={<Send size={14} />}
                          >
                            Send reply
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* 4-button CSAT rating */}
                    <div className="rounded-2xl border border-o-border bg-o-surface-2/40 p-4">
                      <div className="flex items-center gap-2 text-[14.5px] font-semibold text-o-text">
                        <MessageSquare size={16} className="text-o-forest" />
                        <span>How was the help you received?</span>
                      </div>
                      {activeTicket.csatRatedAt ? (
                        <p className="mt-2 text-[13.5px] text-o-text-2">
                          Rated <strong className="capitalize">{activeTicket.csatRating}</strong> on{' '}
                          {new Date(activeTicket.csatRatedAt).toLocaleDateString()}.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            {CSAT_OPTIONS.map((opt) => (
                              <Button
                                key={opt.id}
                                size="sm"
                                variant="secondary"
                                disabled={savingCsat}
                                onClick={() => void handleRateCsat(opt.id)}
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>
                          <Input
                            size="sm"
                            value={csatComment}
                            onChange={(e) => setCsatComment(e.target.value)}
                            placeholder="Optional comment before clicking a rating..."
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Open a new support request"
        description={`Create a tracked ticket under ${data?.customerEmail || 'your account'}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creatingReq}
              onClick={() => void handleCreateRequest()}
            >
              Submit request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Your name">
            <Input
              value={newName || data?.customerName || ''}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
          <Field label="Subject">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Summary of what you need help with"
            />
          </Field>
          <Field label="Details">
            <Textarea
              rows={4}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Include order ID, account email, or screenshots link..."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
