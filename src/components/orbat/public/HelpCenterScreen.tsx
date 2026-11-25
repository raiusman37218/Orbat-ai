'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  PackageSearch,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
  Segmented,
  Select,
  Skeleton,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import {
  loadHelpCenter,
  lookupPublicOrder,
  recordHelpArticleView,
  searchAndAskHelpCenter,
  submitHelpCenterTicket,
  voteHelpArticleHelpful,
  type HelpSearchAiResult,
  type PublicHelpArticleSummary,
  type PublicOrderLookupResult,
} from '@/lib/data/help-center';
import { useData } from '@/lib/data/use-data';
import { normalizeHelpLang, type PortalHelpLang } from '@/lib/portal/portal-types';
import { cn } from '@/lib/utils';

const COPY_BY_LANG: Record<
  PortalHelpLang,
  {
    heroPlaceholder: string;
    askBtn: string;
    collections: string;
    popular: string;
    orderHeading: string;
    contactHeading: string;
    myRequests: string;
  }
> = {
  en: {
    heroPlaceholder: 'Search help articles or ask a question...',
    askBtn: 'Search',
    collections: 'Browse collections',
    popular: 'Articles & guides',
    orderHeading: 'Track an order',
    contactHeading: 'Still need help? Send us a request',
    myRequests: 'My requests',
  },
  ur: {
    heroPlaceholder: 'مدد کے مضامین تلاش کریں یا سوال پوچھیں...',
    askBtn: 'تلاش کریں',
    collections: 'موضوعات دیکھیں',
    popular: 'مقبول رہنما مضامین',
    orderHeading: 'آرڈر ٹریک کریں',
    contactHeading: 'مزید مدد درکار ہے؟ سپورٹ سے رابطہ کریں',
    myRequests: 'میری درخواستیں',
  },
  es: {
    heroPlaceholder: 'Busca artículos de ayuda o haz una pregunta...',
    askBtn: 'Buscar',
    collections: 'Explorar colecciones',
    popular: 'Artículos populares',
    orderHeading: 'Rastrear un pedido',
    contactHeading: '¿Aún necesitas ayuda? Envíanos una solicitud',
    myRequests: 'Mis solicitudes',
  },
};

export function HelpCenterScreen({
  initialWorkspaceKey,
  initialArticleKey,
}: {
  initialWorkspaceKey?: string | null;
  initialArticleKey?: string | null;
}) {
  const { show } = useOrbToast();
  const [selectedWsKey, setSelectedWsKey] = useState<string>(initialWorkspaceKey || '');
  const { data, error, loading, reload } = useData(
    () => loadHelpCenter(selectedWsKey || undefined),
    ['public-help-center', selectedWsKey],
  );

  const [lang, setLang] = useState<PortalHelpLang>('en');
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<HelpSearchAiResult | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [pickedArticle, setPickedArticle] = useState<PublicHelpArticleSummary | null | 'closed'>(null);
  const resolvedArticleKey =
    initialArticleKey ??
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('article')
      : null);
  const activeArticle =
    pickedArticle === 'closed'
      ? null
      : (pickedArticle ??
          (resolvedArticleKey && data?.articles
            ? (data.articles.find(
                (a) => a.id === resolvedArticleKey || a.slug === resolvedArticleKey,
              ) ?? null)
            : null));
  const viewedInitialKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolvedArticleKey || !data?.workspace || !activeArticle) return;
    if (pickedArticle !== null) return;
    if (viewedInitialKeyRef.current === activeArticle.id) return;
    viewedInitialKeyRef.current = activeArticle.id;
    void recordHelpArticleView(data.workspace.id, activeArticle.id).catch(() => {});
  }, [activeArticle, data, pickedArticle, resolvedArticleKey]);
  const [votedArticleIds, setVotedArticleIds] = useState<Record<string, boolean>>({});

  // Order lookup
  const [orderNum, setOrderNum] = useState('');
  const [orderVerifier, setOrderVerifier] = useState('');
  const [lookingOrder, setLookingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<PublicOrderLookupResult | null>(null);

  // Contact / create ticket form
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<{
    ticketId: string;
    ticketNumber: number;
  } | null>(null);

  const { dir } = normalizeHelpLang(lang);
  const copy = COPY_BY_LANG[lang];

  async function handleSearch() {
    if (!data?.workspace) return;
    if (!searchInput.trim()) {
      setSearchResult(null);
      return;
    }
    setSearching(true);
    try {
      const res = await searchAndAskHelpCenter(data.workspace.id, searchInput);
      setSearchResult(res);
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Search failed.',
        tone: 'bad',
      });
    } finally {
      setSearching(false);
    }
  }

  async function handleOpenArticle(article: PublicHelpArticleSummary) {
    setPickedArticle(article);
    if (!data?.workspace) return;
    try {
      await recordHelpArticleView(data.workspace.id, article.id);
    } catch {
      /* non-fatal counter */
    }
  }

  async function handleVote(articleId: string, helpful: boolean) {
    if (!data?.workspace) return;
    try {
      const counts = await voteHelpArticleHelpful(data.workspace.id, articleId, helpful);
      setVotedArticleIds((prev) => ({ ...prev, [articleId]: helpful }));
      setPickedArticle((prev) =>
        prev && prev !== 'closed' && prev.id === articleId
          ? {
              ...prev,
              helpfulCount: counts.helpfulCount,
              notHelpfulCount: counts.notHelpfulCount,
            }
          : prev,
      );
      reload();
      show({ message: 'Thanks for your feedback.', tone: 'ok' });
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not record vote.',
        tone: 'bad',
      });
    }
  }

  async function handleOrderLookup() {
    if (!data?.workspace) return;
    setLookingOrder(true);
    try {
      const res = await lookupPublicOrder(data.workspace.id, orderNum, orderVerifier);
      setOrderResult(res);
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not check order.',
        tone: 'bad',
      });
    } finally {
      setLookingOrder(false);
    }
  }

  async function handleSubmitTicket() {
    if (!data?.workspace) return;
    setSubmittingTicket(true);
    try {
      const created = await submitHelpCenterTicket({
        workspaceId: data.workspace.id,
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
      });
      setCreatedTicket(created);
      setContactSubject('');
      setContactMessage('');
      show({
        message: `Request #TCK-${created.ticketNumber} created.`,
        tone: 'ok',
      });
    } catch (err) {
      show({
        message: err instanceof Error ? err.message : 'Could not submit request.',
        tone: 'bad',
      });
    } finally {
      setSubmittingTicket(false);
    }
  }

  const displayedArticles = (data?.articles || []).filter((a) => {
    if (selectedSectionId && a.sectionId !== selectedSectionId) return false;
    if (searchResult && searchResult.query) {
      return searchResult.matchingArticleIds.includes(a.id);
    }
    return true;
  });

  const wsSlugOrId = data?.workspace?.slug || data?.workspace?.id || '';

  return (
    <div dir={dir} className="min-h-screen bg-o-bg text-o-text">
      {data?.workspace?.helpCenterAnnouncement ? (
        <div className="bg-o-lime px-4 py-2 text-center text-[13.5px] font-medium text-o-forest">
          {data.workspace.helpCenterAnnouncement}
        </div>
      ) : null}

      <header className="border-b border-o-border bg-o-surface">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-xl font-bold text-white"
              style={{ backgroundColor: data?.workspace?.brandColor || '#224F41' }}
            >
              {(data?.workspace?.name || 'O').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-[16px] font-semibold text-o-text">
                {data?.workspace?.name || 'ORBAT Help Center'}
              </p>
              <p className="text-[12px] text-o-text-3">Knowledge base & request portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data && data.availableWorkspaces.length > 1 && (
              <Select
                size="sm"
                aria-label="Select workspace help center"
                value={data.workspace?.id || ''}
                onChange={(e) => {
                  setSelectedWsKey(e.target.value);
                  setPickedArticle('closed');
                  setSearchResult(null);
                  setSelectedSectionId(null);
                }}
                options={data.availableWorkspaces.map((w) => ({
                  value: w.id,
                  label: w.name,
                }))}
              />
            )}

            <Segmented
              label="Help center language"
              value={lang}
              onChange={setLang}
              items={[
                { id: 'en', label: 'EN' },
                { id: 'ur', label: 'UR' },
                { id: 'es', label: 'ES' },
              ]}
            />

            <ButtonLink
              href={wsSlugOrId ? `/portal?ws=${encodeURIComponent(wsSlugOrId)}` : '/portal'}
              variant="secondary"
              size="sm"
            >
              {copy.myRequests}
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Hero search band */}
      <section className="bg-o-forest px-4 py-12 text-o-on-forest sm:px-8 sm:py-16">
        <div className="mx-auto max-w-[820px] text-center">
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[40px]">
            {data?.workspace?.helpCenterTitle || `How can ${data?.workspace?.name || 'we'} help?`}
          </h1>
          <p className="mt-2 text-[15px] text-o-mint sm:text-[16.5px]">
            {data?.workspace?.helpCenterSubtitle ||
              'Search verified help guides, track recent orders, or open a support ticket.'}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearch();
            }}
            className="mx-auto mt-6 flex max-w-[660px] flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-o-text-3"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim()) setSearchResult(null);
                }}
                placeholder={copy.heroPlaceholder}
                className="h-12 w-full rounded-full border-0 bg-white pl-11 pr-4 text-[15px] text-[#17211d] placeholder:text-[#667670] focus:outline-2 focus:outline-o-lime"
              />
            </div>
            <Button
              type="submit"
              loading={searching}
              className="h-12 rounded-full bg-o-lime px-6 font-semibold text-o-forest hover:opacity-95"
            >
              {copy.askBtn}
            </Button>
          </form>
        </div>
      </section>

      <main className="mx-auto flex max-w-[1160px] flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12">
        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-36 rounded-[22px]" />
            <Skeleton className="h-36 rounded-[22px]" />
            <Skeleton className="h-36 rounded-[22px]" />
          </div>
        ) : error && !data ? (
          <ErrorState title="Could not load help center" body={error} onRetry={reload} />
        ) : !data?.workspace ? (
          <EmptyState
            title="No public help center published yet"
            body="Create a workspace via onboarding and publish your first knowledge article to see it live here."
            action={
              <>
                <ButtonLink href="/onboarding" variant="primary">
                  Set up workspace
                </ButtonLink>
                <ButtonLink href="/app/knowledge" variant="secondary">
                  Open Knowledge Hub
                </ButtonLink>
              </>
            }
          />
        ) : (
          <>
            {/* Grounded AI answer box */}
            {searchResult && searchResult.query && (
              <Card className="border-o-forest/30 bg-o-surface-2/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={17} className="text-o-forest" aria-hidden="true" />
                    <h2 className="text-[16px] font-semibold text-o-text">
                      Grounded answer for &ldquo;{searchResult.query}&rdquo;
                    </h2>
                  </div>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      setSearchInput('');
                      setSearchResult(null);
                    }}
                  >
                    Clear search
                  </Button>
                </div>

                {searchResult.answer ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="whitespace-pre-line text-[15px] leading-relaxed text-o-text">
                      {searchResult.answer}
                    </p>
                    {searchResult.citedArticle && (
                      <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-o-text-2">
                        <span>Source article:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const found = data.articles.find(
                              (a) => a.id === searchResult.citedArticle?.id,
                            );
                            if (found) void handleOpenArticle(found);
                          }}
                          className="font-semibold text-o-forest underline"
                        >
                          {searchResult.citedArticle.title}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert tone="ai" className="mt-3">
                    No published article in {data.workspace.name} answered that question directly. Send us a request below and our team will reply.
                  </Alert>
                )}
              </Card>
            )}

            {/* Active Article Reader OR Collections + Articles */}
            {activeArticle ? (
              <Card size="lg">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-o-border pb-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPickedArticle('closed')}
                    leading={<ArrowLeft size={15} />}
                  >
                    All help articles
                  </Button>
                  <div className="flex items-center gap-2 text-[13px] text-o-text-3">
                    {activeArticle.sectionName && (
                      <Badge tone="neutral">{activeArticle.sectionName}</Badge>
                    )}
                    <span>{activeArticle.viewsCount} views</span>
                  </div>
                </div>

                <h2 className="mt-5 text-[24px] font-semibold text-o-text sm:text-[28px]">
                  {activeArticle.title}
                </h2>
                {activeArticle.summary && (
                  <p className="mt-2 text-[15.5px] text-o-text-2">{activeArticle.summary}</p>
                )}

                <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-o-text">
                  {activeArticle.content}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-o-border pt-5">
                  <span className="text-[14px] font-medium text-o-text-2">
                    Was this article helpful?
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={votedArticleIds[activeArticle.id] === true ? 'primary' : 'secondary'}
                      onClick={() => void handleVote(activeArticle.id, true)}
                      leading={<ThumbsUp size={14} />}
                    >
                      Yes ({activeArticle.helpfulCount})
                    </Button>
                    <Button
                      size="sm"
                      variant={votedArticleIds[activeArticle.id] === false ? 'danger' : 'secondary'}
                      onClick={() => void handleVote(activeArticle.id, false)}
                      leading={<ThumbsDown size={14} />}
                    >
                      No ({activeArticle.notHelpfulCount})
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                {data.sections.length > 0 && (
                  <section aria-label={copy.collections}>
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h2 className="text-[20px] font-semibold text-o-text">
                        {copy.collections}
                      </h2>
                      {selectedSectionId && (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setSelectedSectionId(null)}
                        >
                          Show all sections
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {data.sections.map((sec) => {
                        const selected = selectedSectionId === sec.id;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() =>
                              setSelectedSectionId(selected ? null : sec.id)
                            }
                            className={cn(
                              'flex flex-col justify-between rounded-[22px] border p-5 text-left transition',
                              selected
                                ? 'border-o-forest bg-o-surface-2'
                                : 'border-o-border bg-o-surface hover:border-o-border-2',
                            )}
                          >
                            <div>
                              <span className="grid size-10 place-items-center rounded-xl bg-o-surface-2 text-o-forest">
                                <BookOpen size={18} aria-hidden="true" />
                              </span>
                              <h3 className="mt-3 text-[16px] font-semibold text-o-text">
                                {sec.name}
                              </h3>
                              {sec.description && (
                                <p className="mt-1 text-[13.5px] text-o-text-2">
                                  {sec.description}
                                </p>
                              )}
                            </div>
                            <p className="mt-4 text-[13px] font-medium text-o-text-3">
                              {sec.articleCount} published {sec.articleCount === 1 ? 'article' : 'articles'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section aria-label={copy.popular}>
                  <h2 className="mb-4 text-[20px] font-semibold text-o-text">
                    {copy.popular}
                  </h2>
                  {displayedArticles.length === 0 ? (
                    <EmptyState
                      title="No published articles yet"
                      body="Publish articles in the Knowledge Hub and they will appear automatically in this public help center."
                      action={
                        <ButtonLink href="/app/knowledge" variant="secondary">
                          Open Knowledge Hub
                        </ButtonLink>
                      }
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {displayedArticles.map((art) => (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => void handleOpenArticle(art)}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-o-border bg-o-surface p-4 text-left transition hover:border-o-forest"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-o-text">{art.title}</p>
                            <p className="mt-1 line-clamp-2 text-[13.5px] text-o-text-2">
                              {art.summary || art.content.slice(0, 120)}
                            </p>
                            <p className="mt-2 text-[12px] text-o-text-3">
                              {art.sectionName || art.category} · {art.viewsCount} views
                            </p>
                          </div>
                          <ArrowRight size={16} className="mt-1 shrink-0 text-o-text-3" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Order tracker & contact support form */}
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader
                  title={copy.orderHeading}
                  sub="Look up synced Shopify or WooCommerce order fulfillment status."
                  actions={<PackageSearch size={18} className="text-o-forest" />}
                />
                <div className="mt-4 flex flex-col gap-3">
                  <Field label="Order number">
                    <Input
                      value={orderNum}
                      onChange={(e) => setOrderNum(e.target.value)}
                      placeholder="#ORD-1042"
                    />
                  </Field>
                  <Field label="Billing email or phone last digits">
                    <Input
                      value={orderVerifier}
                      onChange={(e) => setOrderVerifier(e.target.value)}
                      placeholder="customer@example.com or 4812"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    loading={lookingOrder}
                    onClick={() => void handleOrderLookup()}
                  >
                    Check order status
                  </Button>

                  {orderResult && (
                    orderResult.found && orderResult.order ? (
                      <div className="mt-2 rounded-2xl border border-o-border bg-o-surface-2/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-o-text">
                            Order {orderResult.order.orderNumber}
                          </span>
                          <Badge tone="ok">{orderResult.order.status}</Badge>
                        </div>
                        {orderResult.order.itemsSummary && (
                          <p className="mt-1 text-[13.5px] text-o-text-2">
                            {orderResult.order.itemsSummary}
                          </p>
                        )}
                        <p className="mt-1 text-[13px] text-o-text-3">
                          Total: {(orderResult.order.totalCents / 100).toFixed(2)}{' '}
                          {orderResult.order.currency.toUpperCase()}
                        </p>
                      </div>
                    ) : (
                      <Alert tone="warn">{orderResult.message || 'Order not found.'}</Alert>
                    )
                  )}
                </div>
              </Card>

              <Card id="contact">
                <CardHeader
                  title={copy.contactHeading}
                  sub={`Submit a real support ticket to ${data.workspace.name} and track replies in My requests.`}
                />
                {createdTicket ? (
                  <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-o-border bg-o-surface-2/50 p-5">
                    <div className="flex items-center gap-2 text-o-forest">
                      <CheckCircle2 size={20} />
                      <h3 className="text-[16px] font-semibold">
                        Request #TCK-{createdTicket.ticketNumber} received
                      </h3>
                    </div>
                    <p className="text-[14px] text-o-text-2">
                      Your customer portal session is signed in. Track live progress, add replies, and mark your issue solved anytime.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink
                        href={
                          wsSlugOrId
                            ? `/portal?ws=${encodeURIComponent(wsSlugOrId)}`
                            : '/portal'
                        }
                        variant="primary"
                        trailing={<ArrowRight size={15} />}
                      >
                        Track in My requests
                      </ButtonLink>
                      <Button variant="secondary" onClick={() => setCreatedTicket(null)}>
                        Send another request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSubmitTicket();
                    }}
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                  >
                    <Field label="Your name">
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Bilal Ahmed"
                      />
                    </Field>
                    <Field label="Email address">
                      <Input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="bilal@company.com"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Subject">
                        <Input
                          required
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                          placeholder="Need help updating shipping address"
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Message">
                        <Textarea
                          required
                          rows={4}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Share details so our team can assist right away..."
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="submit"
                        variant="primary"
                        loading={submittingTicket}
                        leading={<Send size={15} />}
                      >
                        Submit support request
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-o-border py-6 text-center text-[13px] text-o-text-3">
        {data?.workspace?.helpCenterFooterText || (
          <span>
            Powered by <Link href="/" className="font-medium text-o-text-2">ORBAT</Link>
          </span>
        )}
      </footer>
    </div>
  );
}
