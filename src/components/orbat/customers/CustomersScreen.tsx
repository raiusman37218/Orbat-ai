'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Columns3,
  Download,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
  Table,
  useOrbToast,
  type Column,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import { fmtInt, timeAgo } from '@/components/orbat/overview/format';
import {
  deleteCustomerSegment,
  exportCustomersToCsv,
  formatMoneyCents,
  getCustomersBootstrap,
  listCustomers,
  useCustomersLiveSync,
  type BuiltInSegmentSlug,
  type CustomerRecord,
  type CustomersQueryParams,
} from '@/lib/data/customers';
import { useData } from '@/lib/data/use-data';
import { errorMessage } from '@/lib/errors/user-error';
import {
  AddCustomerModal,
  ImportCsvModal,
  NewSegmentModal,
} from './CustomerModals';
import { CustomerProfileView, segmentBadgeTone } from './CustomerProfileView';

const PAGE_SIZE = 25;

type OptionalCol = 'segment' | 'location' | 'orders' | 'ltv' | 'sentiment' | 'last_seen';

const OPTIONAL_COLS: Array<{ key: OptionalCol; label: string }> = [
  { key: 'segment', label: 'Segment' },
  { key: 'location', label: 'Location' },
  { key: 'orders', label: 'Orders' },
  { key: 'ltv', label: 'Lifetime value' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'last_seen', label: 'Last seen' },
];

function deriveCustomerSentiment(
  latestSentiment: string | null | undefined,
  signals: CustomerRecord['ai_signals'] | null | undefined,
): {
  label: string;
  className: string;
} {
  const joined = [
    latestSentiment || '',
    ...(signals || []).map((s) => s.label),
  ]
    .join(' ')
    .toLowerCase()
    .trim();
  if (!joined) return { label: '—', className: 'text-o-text-3' };
  if (joined.includes('negative') || joined.includes('churn risk: high')) {
    return { label: 'Negative', className: 'text-o-bad font-medium' };
  }
  if (joined.includes('frustrated') || joined.includes('churn risk: medium')) {
    return { label: 'Frustrated', className: 'text-o-warn font-medium' };
  }
  if (joined.includes('positive') || joined.includes('low churn')) {
    return { label: 'Positive', className: 'text-o-ok font-medium' };
  }
  return { label: 'Neutral', className: 'text-o-text-2' };
}

export function CustomersScreen({
  initialCustomerId,
}: {
  initialCustomerId: string | null;
}) {
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [prevInitCustomerId, setPrevInitCustomerId] = useState<string | null>(initialCustomerId);
  if (initialCustomerId !== prevInitCustomerId) {
    setPrevInitCustomerId(initialCustomerId);
    if (initialCustomerId) setSelectedCustomerId(initialCustomerId);
  }

  const [segmentSlug, setSegmentSlug] = useState<BuiltInSegmentSlug>('all');
  const [customSegmentId, setCustomSegmentId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [ltvPreset, setLtvPreset] = useState<'any' | '0' | '100' | '500' | '1000'>('any');
  const [sortBy, setSortBy] = useState<NonNullable<CustomersQueryParams['sortBy']>>('last_seen_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    segment: true,
    location: true,
    orders: true,
    ltv: true,
    sentiment: true,
    last_seen: true,
  });
  const [colsOpen, setColsOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newSegOpen, setNewSegOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(0);
    }, 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  const bootstrapState = useData(
    () => getCustomersBootstrap(workspaceId),
    ['customers-bootstrap', workspaceId],
  );

  const queryParams = useMemo<CustomersQueryParams>(() => {
    const base: CustomersQueryParams = {
      segmentSlug: customSegmentId ? undefined : segmentSlug,
      customSegmentId: customSegmentId || undefined,
      q: debouncedQ || undefined,
      country: countryFilter || undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    };
    if (ltvPreset === '0') {
      base.minLtvCents = 0;
      base.maxLtvCents = 0;
    } else if (ltvPreset === '100') {
      base.minLtvCents = 10000;
    } else if (ltvPreset === '500') {
      base.minLtvCents = 50000;
    } else if (ltvPreset === '1000') {
      base.minLtvCents = 100000;
    }
    return base;
  }, [segmentSlug, customSegmentId, debouncedQ, countryFilter, ltvPreset, sortBy, sortDir, page]);

  const listState = useData(
    () => listCustomers(workspaceId, queryParams),
    [
      'customers-list',
      workspaceId,
      queryParams.segmentSlug ?? '',
      queryParams.customSegmentId ?? '',
      queryParams.q ?? '',
      queryParams.country ?? '',
      String(queryParams.minLtvCents ?? ''),
      String(queryParams.maxLtvCents ?? ''),
      queryParams.sortBy ?? '',
      queryParams.sortDir ?? '',
      String(queryParams.page ?? 0),
    ],
  );

  const reloadAll = useCallback(() => {
    bootstrapState.reload();
    listState.reload();
  }, [bootstrapState, listState]);

  useCustomersLiveSync(workspaceId, reloadAll, !selectedCustomerId);

  const openProfile = (id: string) => {
    setSelectedCustomerId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const closeProfile = () => {
    setSelectedCustomerId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleDeleteSegment = async (segmentId: string, name: string) => {
    try {
      await deleteCustomerSegment(workspaceId, segmentId);
      if (customSegmentId === segmentId) {
        setCustomSegmentId(null);
        setSegmentSlug('all');
      }
      toast.show({ tone: 'ok', message: `Deleted segment "${name}"` });
      reloadAll();
    } catch (err) {
      toast.show({ tone: 'bad', message: errorMessage(err) });
    }
  };

  const boot = bootstrapState.data;
  const customers = listState.data?.customers ?? [];
  const total = listState.data?.total ?? 0;
  const allCount =
    boot?.systemSegments.find((s) => s.slug === 'all')?.count ?? total;

  const canEdit = Boolean(boot?.canEdit);
  const canAddNote = Boolean(boot?.canAddNote);
  const canReply = Boolean(boot?.canReply);

  const hasFilters = Boolean(debouncedQ || countryFilter || ltvPreset !== 'any');
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromRow = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toRow = Math.min(total, (page + 1) * PAGE_SIZE);

  if (selectedCustomerId) {
    return (
      <PageContainer>
        <CustomerProfileView
          workspaceId={workspaceId}
          visitorId={selectedCustomerId}
          canEdit={canEdit}
          canAddNote={canAddNote}
          canReply={canReply}
          currentAgentId={boot?.currentAgentId ?? null}
          onBack={closeProfile}
          onChanged={reloadAll}
        />
      </PageContainer>
    );
  }

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => {
        const displayName = row.name || row.email || row.company || 'Unnamed customer';
        return (
          <div className="flex items-center gap-2.5 py-1.5 min-w-0">
            <Avatar name={displayName} size={32} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-o-text max-w-[220px]">
                {displayName}
              </div>
              <div className="truncate text-[12px] text-o-text-3 max-w-[240px]">
                {row.email || row.phone || row.company || 'No email on file'}
              </div>
            </div>
          </div>
        );
      },
    },
    ...(visibleCols.segment
      ? [
          {
            key: 'segment',
            header: 'Segment',
            cell: (row: CustomerRecord) => (
              <Badge tone={segmentBadgeTone(row.segment)}>{row.segment || 'Customer'}</Badge>
            ),
          } satisfies Column<CustomerRecord>,
        ]
      : []),
    ...(visibleCols.location
      ? [
          {
            key: 'location',
            header: 'Location',
            hideBelow: 'md' as const,
            cell: (row: CustomerRecord) => {
              const loc = [row.ip_location_city, row.ip_location_country]
                .filter(Boolean)
                .join(', ');
              return <span className="text-[13px] text-o-text-2">{loc || '—'}</span>;
            },
          } satisfies Column<CustomerRecord>,
        ]
      : []),
    ...(visibleCols.orders
      ? [
          {
            key: 'orders',
            header: 'Orders',
            align: 'right' as const,
            hideBelow: 'sm' as const,
            cell: (row: CustomerRecord) => (
              <span className="o-num text-[13px] text-o-text">
                {fmtInt(row.orders_count ?? 0)}
              </span>
            ),
          } satisfies Column<CustomerRecord>,
        ]
      : []),
    ...(visibleCols.ltv
      ? [
          {
            key: 'ltv',
            header: 'Lifetime value',
            align: 'right' as const,
            cell: (row: CustomerRecord) => (
              <span className="o-num text-[13px] font-semibold text-o-text">
                {formatMoneyCents(row.lifetime_value_cents ?? 0)}
              </span>
            ),
          } satisfies Column<CustomerRecord>,
        ]
      : []),
    ...(visibleCols.sentiment
      ? [
          {
            key: 'sentiment',
            header: 'Sentiment',
            hideBelow: 'lg' as const,
            cell: (row: CustomerRecord) => {
              const s = deriveCustomerSentiment(row.latest_sentiment, row.ai_signals);
              return <span className={`text-[13px] ${s.className}`}>{s.label}</span>;
            },
          } satisfies Column<CustomerRecord>,
        ]
      : []),
    ...(visibleCols.last_seen
      ? [
          {
            key: 'last_seen',
            header: 'Last seen',
            align: 'right' as const,
            hideBelow: 'sm' as const,
            cell: (row: CustomerRecord) => (
              <span className="o-num text-[12.5px] text-o-text-3">
                {row.last_seen_at ? timeAgo(row.last_seen_at) : '—'}
              </span>
            ),
          } satisfies Column<CustomerRecord>,
        ]
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description={`${fmtInt(allCount)} people · synced across connected channels`}
        actions={
          <>
            {canEdit ? (
              <Button
                variant="secondary"
                size="md"
                leading={<Upload size={14} aria-hidden="true" />}
                onClick={() => setImportOpen(true)}
              >
                Import CSV
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="md"
              leading={<Download size={14} aria-hidden="true" />}
              disabled={customers.length === 0}
              onClick={() => exportCustomersToCsv(customers)}
            >
              Export
            </Button>
            {canEdit ? (
              <Button
                variant="primary"
                size="md"
                leading={<Plus size={14} aria-hidden="true" />}
                onClick={() => setAddOpen(true)}
              >
                Add customer
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left segments panel */}
        <nav
          aria-label="Segments"
          className="w-full shrink-0 rounded-[20px] border border-o-border bg-o-surface p-2.5 lg:w-[232px]"
        >
          <div className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
            Segments
          </div>

          <div className="space-y-0.5">
            {(boot?.systemSegments ?? []).map((sg) => {
              const active = !customSegmentId && segmentSlug === sg.slug;
              return (
                <button
                  key={sg.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCustomSegmentId(null);
                    setSegmentSlug(sg.slug as BuiltInSegmentSlug);
                    setPage(0);
                  }}
                  className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[13.5px] transition-colors ${
                    active
                      ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                  }`}
                >
                  <span className="truncate">{sg.name}</span>
                  <span className="o-num text-[12px] text-o-text-3">{fmtInt(sg.count)}</span>
                </button>
              );
            })}

            {(boot?.customSegments ?? []).map((cs) => {
              const active = customSegmentId === cs.id;
              return (
                <div
                  key={cs.id}
                  className={`group flex h-8 items-center justify-between rounded-lg px-2 text-[13.5px] transition-colors ${
                    active
                      ? 'bg-o-accent-soft text-o-accent-text font-semibold'
                      : 'text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCustomSegmentId(cs.id);
                      setPage(0);
                    }}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {cs.name}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={`Delete segment ${cs.name}`}
                      onClick={() => handleDeleteSegment(cs.id, cs.name)}
                      className="ml-1 opacity-70 hover:text-o-bad hover:opacity-100"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {canEdit ? (
            <button
              type="button"
              onClick={() => setNewSegOpen(true)}
              className="mt-2 flex h-8 w-full items-center gap-1.5 rounded-lg border border-dashed border-o-border-strong px-2 text-[13px] text-o-text-2 hover:bg-o-surface-2 hover:text-o-text"
            >
              <Plus size={13} aria-hidden="true" />
              New segment
            </button>
          ) : null}
        </nav>

        {/* Right table area */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-[340px]">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-o-text-3"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, company"
                aria-label="Search customers"
                className="!h-9 !pl-9 !pr-8 !text-[13px]"
              />
              {searchInput ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-o-text-3 hover:text-o-text"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <Select
              size="sm"
              aria-label="Filter by country"
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(0);
              }}
              className="!h-9 !w-auto !text-[13px]"
            >
              <option value="">+ Country</option>
              {(boot?.countries ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select
              size="sm"
              aria-label="Filter by lifetime value"
              value={ltvPreset}
              onChange={(e) => {
                setLtvPreset(e.target.value as typeof ltvPreset);
                setPage(0);
              }}
              className="!h-9 !w-auto !text-[13px]"
            >
              <option value="any">+ Lifetime value</option>
              <option value="100">$100+</option>
              <option value="500">$500+</option>
              <option value="1000">$1,000+</option>
              <option value="0">$0 (leads)</option>
            </Select>

            <Select
              size="sm"
              aria-label="Sort customers"
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split(':') as [
                  NonNullable<CustomersQueryParams['sortBy']>,
                  'asc' | 'desc',
                ];
                setSortBy(f);
                setSortDir(d);
                setPage(0);
              }}
              className="!h-9 !w-auto !text-[13px]"
            >
              <option value="last_seen_at:desc">Sort: Last seen</option>
              <option value="lifetime_value_cents:desc">Sort: Highest LTV</option>
              <option value="orders_count:desc">Sort: Most orders</option>
              <option value="name:asc">Sort: Name A–Z</option>
              <option value="first_seen_at:desc">Sort: Newest joined</option>
            </Select>

            <div className="relative ml-auto">
              <Button
                variant="secondary"
                size="sm"
                leading={<Columns3 size={14} aria-hidden="true" />}
                onClick={() => setColsOpen((o) => !o)}
                aria-expanded={colsOpen}
                className="!h-9"
              >
                Columns
              </Button>
              {colsOpen ? (
                <div className="absolute right-0 top-10 z-30 w-48 rounded-2xl border border-o-border bg-o-surface p-2.5 shadow-lg space-y-1.5">
                  <div className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-o-text-3">
                    Visible columns
                  </div>
                  {OPTIONAL_COLS.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] text-o-text hover:bg-o-surface-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols[c.key]}
                        onChange={(e) =>
                          setVisibleCols((prev) => ({
                            ...prev,
                            [c.key]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <Card flush>
            {listState.error ? (
              <ErrorState
                title="Could not load customers"
                body={listState.error}
                onRetry={reloadAll}
              />
            ) : listState.loading && !listState.data ? (
              <div className="p-6">
                <SkeletonRows rows={7} />
              </div>
            ) : customers.length === 0 ? (
              <EmptyState
                title={hasFilters || customSegmentId || segmentSlug !== 'all' ? 'No customers match these filters' : 'No customers yet'}
                body={
                  hasFilters || customSegmentId || segmentSlug !== 'all'
                    ? 'Try clearing your search, country, or segment filters.'
                    : 'Add customers manually, import a CSV, or connect live chat & support channels.'
                }
                action={
                  hasFilters || customSegmentId || segmentSlug !== 'all' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSegmentSlug('all');
                        setCustomSegmentId(null);
                        setSearchInput('');
                        setCountryFilter('');
                        setLtvPreset('any');
                        setPage(0);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : canEdit ? (
                    <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                      Add first customer
                    </Button>
                  ) : null
                }
              />
            ) : (
              <>
                <Table
                  caption="Customers directory"
                  columns={columns}
                  rows={customers}
                  rowKey={(r) => r.id}
                  onRowClick={(row) => openProfile(row.id)}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-o-border px-4 py-3 text-[12.5px] text-o-text-3">
                  <span>
                    Showing <strong className="o-num text-o-text">{fromRow}</strong>–
                    <strong className="o-num text-o-text">{toRow}</strong> of{' '}
                    <strong className="o-num text-o-text">{fmtInt(total)}</strong>
                  </span>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Prev
                      </Button>
                      <span className="o-num px-2">
                        {page + 1} / {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page + 1 >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AddCustomerModal
        open={addOpen}
        workspaceId={workspaceId}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          reloadAll();
          openProfile(id);
        }}
      />

      <ImportCsvModal
        open={importOpen}
        workspaceId={workspaceId}
        onClose={() => setImportOpen(false)}
        onImported={reloadAll}
      />

      <NewSegmentModal
        open={newSegOpen}
        workspaceId={workspaceId}
        initialCountry={countryFilter}
        initialMinLtvDollars={ltvPreset === 'any' ? '' : ltvPreset}
        onClose={() => setNewSegOpen(false)}
        onCreated={(seg) => {
          reloadAll();
          setCustomSegmentId(seg.id);
          setPage(0);
        }}
      />
    </PageContainer>
  );
}
