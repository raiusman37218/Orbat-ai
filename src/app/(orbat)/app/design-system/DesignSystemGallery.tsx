'use client';

import { Check, Sparkles, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
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
  SkeletonRows,
  Table,
  TabPanel,
  Tabs,
  Textarea,
  Toggle,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';

const SWATCHES: [string, string, string][] = [
  ['Background', '--bg', 'App canvas'],
  ['Surface', '--surface', 'Cards, panels'],
  ['Surface 2', '--surface-2', 'Hover, wells'],
  ['Border', '--border', 'Dividers'],
  ['Text', '--text', 'Primary text'],
  ['Text 2', '--text-2', 'Secondary text'],
  ['Text 3', '--text-3', 'Metadata'],
  ['Lime', '--lime', 'Primary action'],
  ['Forest', '--forest', 'Structure'],
  ['Mint', '--accent-soft', 'Selection'],
  ['AI violet', '--ai', 'AI only'],
  ['AI soft', '--ai-soft', 'AI surfaces'],
  ['Success', '--ok', 'Resolved, live'],
  ['Warning', '--warn', 'At risk'],
  ['Error', '--bad', 'Breach, failure'],
];

interface DemoRow {
  id: string;
  name: string;
  status: 'Open' | 'Resolved' | 'Waiting';
  channel: string;
  replies: number;
}

/* Illustrative rows for the table demo only (this page is dev-only). */
const DEMO_ROWS: DemoRow[] = [
  { id: '1', name: 'Example customer A', status: 'Open', channel: 'Website chat', replies: 4 },
  { id: '2', name: 'Example customer B', status: 'Waiting', channel: 'Email', replies: 1 },
  { id: '3', name: 'Example customer C', status: 'Resolved', channel: 'WhatsApp', replies: 7 },
];

const STATUS_TONE = { Open: 'accent', Resolved: 'ok', Waiting: 'neutral' } as const;

export function DesignSystemGallery() {
  const toast = useOrbToast();
  const tabsId = useId();
  const [tab, setTab] = useState<'overview' | 'evaluation' | 'history'>('overview');
  const [range, setRange] = useState<'7' | '30' | '90'>('7');
  const [on, setOn] = useState(true);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>('1');

  const columns: Column<DemoRow>[] = [
    { key: 'name', header: 'Customer', cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: 'status', header: 'Status', cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: 'channel', header: 'Channel', cell: (r) => r.channel, hideBelow: 'sm' },
    { key: 'replies', header: 'Replies', cell: (r) => r.replies, align: 'right' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="ds-colors">
        <h3 id="ds-colors" className="o-cap">
          Colour tokens · switch theme in the top bar
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-2.5">
          {SWATCHES.map(([name, token, use]) => (
            <div key={token} className="overflow-hidden rounded-2xl border border-o-border bg-o-surface">
              <div className="h-14 border-b border-o-border" style={{ background: `var(${token})` }} />
              <div className="px-3 py-2">
                <div className="text-[13px] font-semibold">{name}</div>
                <div className="o-mono text-[11px] text-o-text-3">{token}</div>
                <div className="text-[12px] text-o-text-2">{use}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card size="lg">
        <CardHeader title="Buttons" sub="Pills. Lime is the primary action; violet only for AI." />
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button>Send</Button>
          <Button variant="secondary">Assign</Button>
          <Button variant="ghost">Snooze</Button>
          <Button variant="quiet">Cancel</Button>
          <Button variant="ai" leading={<Sparkles size={15} aria-hidden="true" />}>
            AI assist
          </Button>
          <Button variant="danger" leading={<Trash2 size={15} aria-hidden="true" />}>
            Delete
          </Button>
          <Button disabled>Disabled</Button>
          <Button loading>Working</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg">Large</Button>
          <Button variant="secondary" icon aria-label="Confirm">
            <Check size={18} aria-hidden="true" />
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card size="lg" className="flex flex-col gap-4">
          <CardHeader title="Inputs" sub="12px radius, mint focus ring." />
          <Field label="Customer email" hint="We’ll send the receipt here.">
            <Input type="email" placeholder="name@company.com" />
          </Field>
          <Field label="Email with an error" error="Enter a full email address, like name@company.com">
            <Input type="email" defaultValue="sarah@" />
          </Field>
          <Field label="Disabled">
            <Input disabled defaultValue="Synced from your store" />
          </Field>
          <Field label="Priority">
            <Select
              defaultValue=""
              placeholder="Choose a priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
              ]}
            />
          </Field>
          <Field label="Internal note">
            <Textarea placeholder="Only your team can see this" />
          </Field>
        </Card>

        <Card size="lg" className="flex flex-col gap-5">
          <CardHeader title="Badges, avatars, tabs, toggle" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Open</Badge>
            <Badge tone="ok">Resolved</Badge>
            <Badge>Waiting</Badge>
            <Badge tone="bad">SLA risk</Badge>
            <Badge tone="warn">High</Badge>
            <Badge tone="ai">Nova (AI)</Badge>
            <Badge tone="solid">24</Badge>
            <Badge tone="ok" dot>
              Live
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Sarah Johnson" />
            <Avatar name="Alex Morgan" presence="online" />
            <Avatar name="Jordan Lee" presence="away" />
            <Avatar name="Nova" ai />
            <span className="text-[13px] text-o-text-2">Customer · Agent with presence · AI agent</span>
          </div>
          <div>
            <Tabs
              idBase={tabsId}
              label="Agent sections"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'overview', label: 'Overview' },
                { id: 'evaluation', label: 'Evaluation', count: 3 },
                { id: 'history', label: 'History' },
              ]}
            />
            <TabPanel idBase={tabsId} id={tab} className="pt-3 text-[14px] text-o-text-2">
              Panel for “{tab}”.
            </TabPanel>
          </div>
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            items={[
              { id: '7', label: '7 days' },
              { id: '30', label: '30 days' },
              { id: '90', label: '90 days' },
            ]}
          />
          <Toggle
            checked={on}
            onChange={setOn}
            label="Auto-assign new conversations"
            description="Round-robin among online agents."
          />
        </Card>
      </div>

      <Card size="lg" flush>
        <div className="p-6 pb-2">
          <CardHeader title="Table" sub="Uppercase headers, 56px rows. Click or press Enter on a row." />
        </div>
        <Table
          caption="Example conversations"
          columns={columns}
          rows={DEMO_ROWS}
          rowKey={(r) => r.id}
          selectedKey={selected}
          onRowClick={(r) => setSelected(r.id)}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card size="lg">
          <CardHeader title="Loading" />
          <div className="mt-4">
            <SkeletonRows rows={3} />
          </div>
        </Card>
        <Card size="lg">
          <CardHeader title="Empty" />
          <EmptyState title="You’re all caught up" body="New conversations in this view will show up here." />
        </Card>
        <Card size="lg">
          <CardHeader title="Error" />
          <ErrorState body="We couldn’t reach the server." onRetry={() => toast.show({ message: 'Retried', tone: 'ok' })} />
        </Card>
      </div>

      <Card size="lg" className="flex flex-col gap-3">
        <CardHeader title="Alerts, toasts and dialogs" />
        <Alert tone="bad">Couldn’t reach the store. We’ll retry in 30 seconds.</Alert>
        <Alert tone="warn">WhatsApp template rejected. Edit it to resume.</Alert>
        <Alert tone="ok">Article published. AI agents will use it within 2 minutes.</Alert>
        <Alert tone="ai">Nova drafted a reply from 2 articles.</Alert>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                message: 'Conversation resolved',
                tone: 'ok',
                action: { label: 'Undo', onClick: () => toast.show({ message: 'Reopened' }) },
              })
            }
          >
            Show toast
          </Button>
          <Button variant="secondary" onClick={() => toast.show({ message: 'Couldn’t save the reply.', tone: 'bad' })}>
            Show error toast
          </Button>
          <Button variant="secondary" onClick={() => setModal(true)}>
            Open modal
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Delete 3 tickets
          </Button>
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Assign conversation"
        description="Pick a teammate. They’ll get a notification."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModal(false)}>Assign</Button>
          </>
        }
      >
        <Field label="Teammate">
          <Select defaultValue="" placeholder="Choose a teammate" options={[{ value: 'a', label: 'Teammate A' }]} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        title="Delete 3 tickets?"
        body="Deleted tickets and their notes can’t be recovered."
        confirmLabel="Delete tickets"
        onConfirm={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setConfirm(false);
            toast.show({ message: 'Demo only: nothing was deleted.' });
          }, 700);
        }}
      />
    </div>
  );
}
