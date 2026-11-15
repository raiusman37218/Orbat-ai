'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  Plus,
  Search,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  useOrbToast,
} from '@/components/orbat/primitives';
import { PageContainer, PageHeader } from '@/components/orbat/shell/PageContainer';
import { useShellSession } from '@/components/orbat/shell/session-context';
import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_INDUSTRIES,
  createAgentFromTemplate,
  getAiAgentsBootstrap,
  type AgentTemplateSpec,
} from '@/lib/data/agents';
import { useData } from '@/lib/data/use-data';

function TemplateInspectorBody({
  tpl,
  canManage,
  creatingId,
  onUseTemplate,
}: {
  tpl: AgentTemplateSpec;
  canManage: boolean;
  creatingId: string | null;
  onUseTemplate: (tpl: AgentTemplateSpec) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="ai">{tpl.industry}</Badge>
          {tpl.frameworks.map((fw) => (
            <Badge key={fw} tone="neutral">
              {fw}
            </Badge>
          ))}
        </div>
        <h2 className="mt-2 font-o-display text-[19px] font-semibold tracking-tight text-o-text">
          {tpl.name}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-o-text-2">{tpl.tagline}</p>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
          <Wrench size={12} aria-hidden="true" />
          What this agent handles
        </div>
        <ul className="mt-2 space-y-2">
          {tpl.actions.map((act) => (
            <li
              key={act.title}
              className="rounded-[10px] border border-o-border bg-o-surface-2 px-3 py-2"
            >
              <div className="text-[13px] font-medium text-o-text">{act.title}</div>
              <div className="mt-0.5 text-[12px] text-o-text-3">{act.detail}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
          <Shield size={12} aria-hidden="true" />
          Built-in compliance guardrails
        </div>
        <ul className="mt-2 space-y-1.5">
          {tpl.guardrails.map((g) => (
            <li key={g} className="flex items-start gap-2 text-[12.5px] text-o-text-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-o-ok" aria-hidden="true" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
          Works with
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tpl.worksWith.map((item) => (
            <Badge key={item} tone="neutral">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-o-text-3">
          Sample conversation
        </div>
        <div className="mt-2 space-y-2 rounded-[12px] border border-o-border bg-o-bg p-3">
          {tpl.sampleConversation.map((turn, idx) => (
            <div
              key={idx}
              className={`rounded-[10px] px-3 py-2 text-[12.5px] leading-relaxed ${
                turn.from === 'customer'
                  ? 'border border-o-border bg-o-surface text-o-text'
                  : 'bg-o-ai-soft text-o-ai-text'
              }`}
            >
              <span className="mr-1.5 font-semibold">
                {turn.from === 'customer' ? 'Customer:' : `${tpl.name}:`}
              </span>
              {turn.text}
            </div>
          ))}
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2 border-t border-o-border pt-3">
          <Button
            variant="ai"
            size="md"
            loading={creatingId === tpl.id}
            leading={<Sparkles size={14} aria-hidden="true" />}
            onClick={() => onUseTemplate(tpl)}
            className="flex-1"
          >
            Use this template
          </Button>
          <ButtonLink
            href={`/app/agents/new?template=${encodeURIComponent(tpl.id)}`}
            variant="secondary"
            size="md"
          >
            Customize draft
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

export function AgentTemplatesScreen() {
  const router = useRouter();
  const { workspace } = useShellSession();
  const toast = useOrbToast();
  const workspaceId = workspace.id;

  const [industry, setIndustry] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(AGENT_TEMPLATES[0].id);
  const [mobilePreview, setMobilePreview] = useState<AgentTemplateSpec | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const authState = useData(
    () => getAiAgentsBootstrap(workspaceId),
    ['ai-templates-auth', workspaceId],
  );
  const canManage = Boolean(authState.data?.canManage);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENT_TEMPLATES.filter((t) => {
      if (industry !== 'All' && t.industry !== industry) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.industry.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.frameworks.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [industry, search]);

  const activeTemplate = useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? AGENT_TEMPLATES[0],
    [filtered, selectedId],
  );

  const handleUseTemplate = async (tpl: AgentTemplateSpec) => {
    setCreatingId(tpl.id);
    try {
      const res = await createAgentFromTemplate(workspaceId, tpl.id);
      if (!res.success) {
        toast.show({ tone: 'bad', message: res.error });
        return;
      }
      toast.show({ tone: 'ok', message: `Created draft "${res.agent.name}".` });
      router.push(`/app/agents/${res.agent.id}`);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Agent templates"
        description="Industry-tested blueprints with pre-built compliance rules, tone presets, and handoff triggers"
        actions={
          <>
            <ButtonLink href="/app/agents" variant="secondary" size="md">
              Back to agents
            </ButtonLink>
            {canManage ? (
              <ButtonLink
                href="/app/agents/new"
                variant="ai"
                size="md"
                leading={<Plus size={14} aria-hidden="true" />}
              >
                Blank agent
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {/* Search + Industry chips */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-o-text-3"
            aria-hidden="true"
          />
          <Input
            aria-label="Search agent templates"
            placeholder="Search by industry, compliance (HIPAA, GDPR), or workflow…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by industry">
          {AGENT_TEMPLATE_INDUSTRIES.map((ind) => {
            const active = industry === ind;
            return (
              <button
                key={ind}
                type="button"
                aria-pressed={active}
                onClick={() => setIndustry(ind)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  active
                    ? 'bg-o-ai text-white'
                    : 'border border-o-border bg-o-surface text-o-text-2 hover:bg-o-surface-2 hover:text-o-text'
                }`}
              >
                {ind}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              title="No matching templates"
              body="Try another keyword or clear the industry filter."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIndustry('All');
                    setSearch('');
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((tpl) => {
              const selected = activeTemplate.id === tpl.id;
              return (
                <Card
                  key={tpl.id}
                  className={`flex flex-col justify-between transition-all ${
                    selected
                      ? 'ring-2 ring-o-ai/50 border-o-ai'
                      : 'hover:border-o-border-strong'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(tpl.id)}
                    className="text-left focus:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={selected ? 'ai' : 'neutral'}>{tpl.badge}</Badge>
                      <span className="o-num text-[11.5px] text-o-text-3">
                        {tpl.actionsCount} actions · {tpl.workflowsCount} flows
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-[15px] font-semibold text-o-text">{tpl.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-o-text-2">
                      {tpl.tagline}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tpl.frameworks.map((fw) => (
                        <Badge key={fw} tone="neutral">
                          {fw}
                        </Badge>
                      ))}
                    </div>
                  </button>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-o-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      leading={<Eye size={13} />}
                      onClick={() => {
                        setSelectedId(tpl.id);
                        setMobilePreview(tpl);
                      }}
                      className="lg:hidden"
                    >
                      Preview
                    </Button>
                    <div className="ml-auto flex items-center gap-1.5">
                      {canManage ? (
                        <Button
                          variant={selected ? 'ai' : 'secondary'}
                          size="sm"
                          loading={creatingId === tpl.id}
                          onClick={() => handleUseTemplate(tpl)}
                        >
                          Use template
                        </Button>
                      ) : (
                        <ButtonLink
                          href={`/app/agents/new?template=${encodeURIComponent(tpl.id)}`}
                          variant="secondary"
                          size="sm"
                        >
                          Preview draft
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Desktop sticky inspector */}
        <Card className="hidden lg:sticky lg:top-[76px] lg:block">
          <TemplateInspectorBody
            tpl={activeTemplate}
            canManage={canManage}
            creatingId={creatingId}
            onUseTemplate={handleUseTemplate}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(mobilePreview)}
        onClose={() => setMobilePreview(null)}
        title="Template preview"
        wide
      >
        {mobilePreview ? (
          <TemplateInspectorBody
            tpl={mobilePreview}
            canManage={canManage}
            creatingId={creatingId}
            onUseTemplate={handleUseTemplate}
          />
        ) : null}
      </Modal>
    </PageContainer>
  );
}
