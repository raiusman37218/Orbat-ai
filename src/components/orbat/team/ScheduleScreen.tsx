'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, Plus, Save, Trash2 } from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import {
  assignOnCallShift,
  deleteHoliday,
  getSchedule,
  saveHoliday,
  saveSchedule,
  useScheduleLiveSync,
  type AfterHoursRules,
  type AvailabilityThresholds,
  type ScheduleBootstrap,
  type WeeklyDaySlot,
} from '@/lib/data/schedule';
import { computeBarPercent } from '@/lib/schedule/hours';
import { useData } from '@/lib/data/use-data';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function buildHalfHourOptions() {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ['00', '30']) {
      const v = `${String(h).padStart(2, '0')}:${m}`;
      out.push({ value: v, label: v });
    }
  }
  out.push({ value: '23:59', label: '23:59' });
  return out;
}

const TIME_OPTIONS = buildHalfHourOptions();

interface ScheduleDraft {
  enabled: boolean;
  timezone: string;
  weekly: WeeklyDaySlot[];
  afterHoursRules: AfterHoursRules;
  availability: AvailabilityThresholds;
}

export function ScheduleScreen() {
  const { workspace } = useShellSession();
  const { show } = useOrbToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Holiday modal
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holName, setHolName] = useState('');
  const [holStart, setHolStart] = useState('');
  const [holEnd, setHolEnd] = useState('');
  const [holYearly, setHolYearly] = useState(true);
  const [holBusy, setHolBusy] = useState(false);

  // On-call modal
  const [onCallDate, setOnCallDate] = useState<string | null>(null);
  const [onCallAgentId, setOnCallAgentId] = useState<string>('');
  const [onCallNotes, setOnCallNotes] = useState('');
  const [onCallBusy, setOnCallBusy] = useState(false);

  const { data, loading, error, reload } = useData<ScheduleBootstrap>(
    () => getSchedule(workspace!.id, weekOffset),
    [workspace?.id, weekOffset],
    { enabled: Boolean(workspace?.id) },
  );

  useScheduleLiveSync(workspace?.id, () => reload(), Boolean(workspace?.id));

  if (!workspace?.id) {
    return (
      <PageContainer>
        <ErrorState title="No workspace selected" body="Select a workspace to manage office hours." />
      </PageContainer>
    );
  }

  const effective: ScheduleDraft | null = draft
    ? draft
    : data
      ? {
          enabled: data.enabled,
          timezone: data.timezone,
          weekly: data.weekly,
          afterHoursRules: data.afterHoursRules,
          availability: data.availability,
        }
      : null;

  function patchDraft(updater: (prev: ScheduleDraft) => ScheduleDraft) {
    if (!effective) return;
    setDraft(updater(effective));
  }

  async function handleSave() {
    if (!workspace?.id || !effective) return;
    setSaving(true);
    try {
      await saveSchedule(workspace.id, effective);
      setDraft(null);
      show({ message: 'Office hours & SLA timers updated', tone: 'ok' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to save schedule', tone: 'bad' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHoliday() {
    if (!workspace?.id) return;
    setHolBusy(true);
    try {
      const res = await saveHoliday(workspace.id, {
        name: holName.trim(),
        starts_on: holStart,
        ends_on: holEnd || holStart,
        repeats_yearly: holYearly,
      });
      if (!res.success) throw new Error(res.error);
      show({ message: `Added holiday “${holName.trim()}”`, tone: 'ok' });
      setHolidayModalOpen(false);
      setHolName('');
      setHolStart('');
      setHolEnd('');
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not save holiday', tone: 'bad' });
    } finally {
      setHolBusy(false);
    }
  }

  async function handleRemoveHoliday(id: string) {
    if (!workspace?.id) return;
    try {
      const res = await deleteHoliday(workspace.id, id);
      if (!res.success) throw new Error(res.error);
      show({ message: 'Holiday removed', tone: 'info' });
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Could not remove holiday', tone: 'bad' });
    }
  }

  async function handleSaveOnCall() {
    if (!workspace?.id || !onCallDate) return;
    setOnCallBusy(true);
    try {
      await assignOnCallShift(workspace.id, {
        shiftDate: onCallDate,
        slot: 'all_day',
        agentId: onCallAgentId || null,
        notes: onCallNotes,
      });
      show({ message: `On-call shift updated for ${onCallDate}`, tone: 'ok' });
      setOnCallDate(null);
      await reload();
    } catch (err) {
      show({ message: err instanceof Error ? err.message : 'Failed to assign on-call shift', tone: 'bad' });
    } finally {
      setOnCallBusy(false);
    }
  }

  const openBadge = data?.openStatus;
  const tzOptions = Array.from(
    new Set([effective?.timezone || 'UTC', ...TIMEZONES]),
  ).map((tz) => ({ value: tz, label: tz }));

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Link href="/app/team" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-o-accent-text hover:underline">
          <ArrowLeft size={14} /> Team &amp; Command Center
        </Link>
        <PageHeader
          title="Office hours & schedule"
          description="Synchronizes live widget availability, SLA business-hour clocks, and off-hours routing."
          actions={
            <>
              {openBadge ? (
                <Badge dot tone={openBadge.isOpen ? 'ok' : 'warn'}>
                  {openBadge.reason === 'holiday'
                    ? `Closed · ${openBadge.holidayName}`
                    : openBadge.reason === 'disabled_24_7'
                      ? `Open 24/7 · ${openBadge.localTimeLabel}`
                      : openBadge.isOpen
                        ? `Open now · ${openBadge.localTimeLabel}`
                        : `Outside hours · ${openBadge.localTimeLabel}`}
                </Badge>
              ) : null}
              {data?.canManage ? (
                <Button variant="primary" loading={saving} leading={<Save size={15} />} onClick={handleSave}>
                  {draft ? 'Save changes*' : 'Save changes'}
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      {error ? <ErrorState title="Could not load schedule" body={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : null}

      {data && effective ? (
        <div className="flex flex-col gap-6">
          {/* Weekly Office Hours + Holidays */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 flex flex-col gap-4">
              <CardHeader
                title="Weekly office hours"
                sub="Used by the chat widget, SLA business-hour timers, and handoff queueing."
                actions={
                  <Select
                    size="sm"
                    aria-label="Workspace timezone"
                    value={effective.timezone}
                    disabled={!data.canManage}
                    options={tzOptions}
                    onChange={(e) => patchDraft((d) => ({ ...d, timezone: e.target.value }))}
                  />
                }
              />

              <Toggle
                checked={effective.enabled}
                disabled={!data.canManage}
                onChange={(next) => patchDraft((d) => ({ ...d, enabled: next }))}
                label="Enforce scheduled office hours"
                description="Turn off to keep support available 24/7 (excluding workspace holidays)."
              />

              <div className="divide-y divide-o-border rounded-xl border border-o-border">
                {effective.weekly.map((daySlot, idx) => {
                  const bar = computeBarPercent(daySlot.open, daySlot.close);
                  return (
                    <div
                      key={daySlot.day}
                      className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-[13.5px]"
                    >
                      <div className="w-28 shrink-0">
                        <Toggle
                          checked={daySlot.enabled}
                          disabled={!data.canManage || !effective.enabled}
                          label={daySlot.short}
                          onChange={(next) =>
                            patchDraft((d) => ({
                              ...d,
                              weekly: d.weekly.map((w, i) => (i === idx ? { ...w, enabled: next } : w)),
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          size="sm"
                          aria-label={`${daySlot.label} opening time`}
                          value={daySlot.open}
                          disabled={!data.canManage || !effective.enabled || !daySlot.enabled}
                          options={TIME_OPTIONS}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              weekly: d.weekly.map((w, i) => (i === idx ? { ...w, open: e.target.value } : w)),
                            }))
                          }
                        />
                        <span className="text-o-text-3">to</span>
                        <Select
                          size="sm"
                          aria-label={`${daySlot.label} closing time`}
                          value={daySlot.close}
                          disabled={!data.canManage || !effective.enabled || !daySlot.enabled}
                          options={TIME_OPTIONS}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              weekly: d.weekly.map((w, i) => (i === idx ? { ...w, close: e.target.value } : w)),
                            }))
                          }
                        />
                      </div>
                      <div className="relative hidden h-2.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-o-surface-2 sm:block">
                        {effective.enabled && daySlot.enabled && bar.widthPct > 0 ? (
                          <div
                            className="absolute top-0 bottom-0 rounded-full bg-o-ok/80"
                            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="flex flex-col gap-4">
              <CardHeader
                title={`Holidays (${data.holidays.length})`}
                sub="Workspace closes all day on holidays."
                actions={
                  data.canManage ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      leading={<Plus size={14} />}
                      onClick={() => setHolidayModalOpen(true)}
                    >
                      Add date
                    </Button>
                  ) : null
                }
              />

              {data.holidays.length === 0 ? (
                <EmptyState
                  icon={<Calendar size={20} />}
                  title="No holidays configured"
                  body="Add public holidays or company offsites so SLA clocks pause automatically."
                />
              ) : (
                <div className="divide-y divide-o-border">
                  {data.holidays.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-o-text">{h.name}</div>
                        <div className="text-[12px] text-o-text-3">
                          {h.starts_on === h.ends_on ? h.starts_on : `${h.starts_on} → ${h.ends_on}`}
                          {h.repeats_yearly ? ' · Yearly' : ''}
                        </div>
                      </div>
                      {data.canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon
                          aria-label={`Remove ${h.name}`}
                          onClick={() => handleRemoveHoliday(h.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Weekly On-Call Rotation */}
          <Card className="flex flex-col gap-4">
            <CardHeader
              title="On-call rotation"
              sub="Click any day to assign the on-call teammate responsible for urgent escalations."
              actions={
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon
                    aria-label="Previous week"
                    onClick={() => setWeekOffset((w) => w - 1)}
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setWeekOffset(0)}>
                    This week
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon
                    aria-label="Next week"
                    onClick={() => setWeekOffset((w) => w + 1)}
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>
              }
            />

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {data.weekDates.map((cell) => {
                const assigned = data.onCallShifts.find((s) => s.shiftDate === cell.isoDate);
                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    disabled={!data.canManage}
                    onClick={() => {
                      setOnCallDate(cell.isoDate);
                      setOnCallAgentId(assigned?.agentId || '');
                      setOnCallNotes(assigned?.notes || '');
                    }}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-3 text-left transition hover:border-o-border-strong',
                      cell.isToday ? 'border-o-accent bg-o-accent-soft/40' : 'border-o-border bg-o-surface',
                    )}
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-o-text">{cell.dayShort}</span>
                      <span className="o-num text-o-text-3">{cell.dateLabel}</span>
                    </div>
                    {assigned ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={assigned.agentName} size={24} />
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-medium text-o-text">{assigned.agentName}</div>
                          {assigned.notes ? (
                            <div className="truncate text-[11px] text-o-text-3">{assigned.notes}</div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] text-o-text-3">Unassigned · Click to set</span>
                    )}
                  </button>
                );
              })}
            </div>

            <Alert tone="warn">
              On-call assignments route urgent after-hours inbox pings and email alerts to the active assignee. Real-time phone/SMS PSTN paging requires connecting a voice/SMS gateway (<code>TODO(backend)</code>).
            </Alert>
          </Card>

          {/* Outside Office Hours & Availability Thresholds */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-4">
              <CardHeader
                title="Outside office hours behavior"
                sub="Controls AI behavior and customer messaging when no office-hour window is open."
              />
              <Toggle
                checked={effective.afterHoursRules.aiHandlesEverything}
                disabled={!data.canManage}
                onChange={(next) =>
                  patchDraft((d) => ({
                    ...d,
                    afterHoursRules: { ...d.afterHoursRules, aiHandlesEverything: next },
                  }))
                }
                label="Keep AI assistant active after hours"
                description="Let published AI agents answer customer questions 24/7 before queuing handoffs."
              />
              <Toggle
                checked={effective.afterHoursRules.collectEmailForNextMorning}
                disabled={!data.canManage}
                onChange={(next) =>
                  patchDraft((d) => ({
                    ...d,
                    afterHoursRules: { ...d.afterHoursRules, collectEmailForNextMorning: next },
                  }))
                }
                label="Queue email follow-ups for opening hour"
                description="Ask visitors to confirm their email when offline-queued."
              />
              <Toggle
                checked={effective.afterHoursRules.wakeOnCallForUrgent}
                disabled={!data.canManage}
                onChange={(next) =>
                  patchDraft((d) => ({
                    ...d,
                    afterHoursRules: { ...d.afterHoursRules, wakeOnCallForUrgent: next },
                  }))
                }
                label="Alert on-call assignee for urgent priority"
              />
              <Field label="Offline queue reply message">
                <Textarea
                  rows={2}
                  disabled={!data.canManage}
                  value={effective.afterHoursRules.offlineMessage}
                  onChange={(e) =>
                    patchDraft((d) => ({
                      ...d,
                      afterHoursRules: { ...d.afterHoursRules, offlineMessage: e.target.value },
                    }))
                  }
                />
              </Field>
            </Card>

            <Card className="flex flex-col gap-4">
              <CardHeader
                title="Agent availability & ring thresholds"
                sub="Synchronized with live handoff routing and heartbeat checks."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Auto-away idle (minutes)" hint="Marks idle agents Away">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    disabled={!data.canManage}
                    value={effective.availability.autoAwayMinutes}
                    onChange={(e) =>
                      patchDraft((d) => ({
                        ...d,
                        availability: { ...d.availability, autoAwayMinutes: Number(e.target.value || 15) },
                      }))
                    }
                  />
                </Field>
                <Field label="Heartbeat grace (seconds)" hint="Dashboard presence window">
                  <Input
                    type="number"
                    min={15}
                    max={600}
                    disabled={!data.canManage}
                    value={effective.availability.heartbeatGraceSeconds}
                    onChange={(e) =>
                      patchDraft((d) => ({
                        ...d,
                        availability: { ...d.availability, heartbeatGraceSeconds: Number(e.target.value || 90) },
                      }))
                    }
                  />
                </Field>
                <Field label="Default max chats / agent" hint="Concurrent handoff chats">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    disabled={!data.canManage}
                    value={effective.availability.defaultMaxConcurrentChats}
                    onChange={(e) =>
                      patchDraft((d) => ({
                        ...d,
                        availability: {
                          ...d.availability,
                          defaultMaxConcurrentChats: Number(e.target.value || 4),
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="Handoff ring timeout (seconds)" hint="Before rotating or broadcasting">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    disabled={!data.canManage}
                    value={effective.availability.ringTimeoutSeconds}
                    onChange={(e) =>
                      patchDraft((d) => ({
                        ...d,
                        availability: { ...d.availability, ringTimeoutSeconds: Number(e.target.value || 45) },
                      }))
                    }
                  />
                </Field>
              </div>
              <div className="mt-auto flex items-center gap-2 rounded-xl bg-o-surface-2 px-3 py-2 text-[12.5px] text-o-text-2">
                <Clock size={14} />
                Changes sync immediately with <code className="mx-1">workspaces.handoff_settings</code> and open ticket SLAs.
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Add Holiday Modal */}
      <Modal
        open={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        title="Add workspace holiday"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHolidayModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={holBusy} onClick={handleAddHoliday}>
              Save holiday
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Holiday name">
            <Input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="e.g. Eid al-Fitr" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <Input type="date" value={holStart} onChange={(e) => setHolStart(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={holEnd || holStart} onChange={(e) => setHolEnd(e.target.value)} />
            </Field>
          </div>
          <Toggle
            checked={holYearly}
            onChange={setHolYearly}
            label="Repeats every year"
          />
        </div>
      </Modal>

      {/* Assign On-Call Modal */}
      <Modal
        open={Boolean(onCallDate)}
        onClose={() => setOnCallDate(null)}
        title={`On-call assignment · ${onCallDate || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOnCallDate(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={onCallBusy} onClick={handleSaveOnCall}>
              Save shift
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Assigned responder">
            <Select
              value={onCallAgentId}
              onChange={(e) => setOnCallAgentId(e.target.value)}
              options={[
                { value: '', label: 'Unassigned (clear shift)' },
                ...(data?.agents || []).map((a) => ({ value: a.id, label: `${a.name} (${a.email})` })),
              ]}
            />
          </Field>
          <Field label="Shift notes (optional)">
            <Input
              value={onCallNotes}
              onChange={(e) => setOnCallNotes(e.target.value)}
              placeholder="e.g. Primary urgent escalation responder"
            />
          </Field>
        </div>
      </Modal>
    </PageContainer>
  );
}
