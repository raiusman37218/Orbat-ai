import { describe, expect, it } from 'vitest';
import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_INDUSTRIES,
  AUTONOMY_LEVEL_DEFS,
  getAgentTemplate,
  slugifyAgentName,
} from './agent-templates';
import { activeNavId, breadcrumbFor } from '@/components/orbat/shell/nav';

describe('Phase 2 AI Agent Templates & Navigation', () => {
  it('provides 10 complete industry templates aligned with filter categories', () => {
    expect(AGENT_TEMPLATES.length).toBe(10);
    const ids = new Set(AGENT_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(10);

    const industrySet = new Set<string>(AGENT_TEMPLATE_INDUSTRIES);
    for (const tpl of AGENT_TEMPLATES) {
      expect(industrySet.has(tpl.industry)).toBe(true);
      expect(tpl.systemPrompt.trim().length).toBeGreaterThan(20);
      expect(tpl.guardrails.length).toBeGreaterThan(0);
      expect(tpl.actions.length).toBeGreaterThan(0);
      expect(tpl.sampleConversation.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves template lookups and slugifies agent names safely', () => {
    expect(getAgentTemplate('fintech-support')?.industry).toBe('Finance');
    expect(getAgentTemplate('non-existent')).toBeNull();
    expect(slugifyAgentName('  Fintech Compliance & Billing! ')).toBe('fintech-compliance-billing');
    expect(slugifyAgentName('---')).toBe('ai-agent');
  });

  it('defines ordered Trust Ladder levels 1 through 4', () => {
    expect(AUTONOMY_LEVEL_DEFS.map((d) => d.level)).toEqual([1, 2, 3, 4]);
    expect(AUTONOMY_LEVEL_DEFS.map((d) => d.name)).toEqual([
      'Shadow',
      'Suggest',
      'Supervised',
      'Autonomous',
    ]);
  });

  it('highlights the right sidebar item and breadcrumb across all Phase 2 routes', () => {
    expect(activeNavId('/app/agents')).toBe('agents');
    expect(activeNavId('/app/agents/templates')).toBe('templates');
    expect(activeNavId('/app/agents/new')).toBe('builder');
    expect(activeNavId('/app/agents/abc-123')).toBe('builder');
    expect(activeNavId('/app/ai-quality')).toBe('quality');
    expect(activeNavId('/app/languages')).toBe('languages');
    expect(activeNavId('/app/knowledge')).toBe('knowledge');

    expect(breadcrumbFor('/app/agents/abc-123')).toEqual({
      section: 'AI & Knowledge',
      page: 'Agent builder',
    });
  });
});
