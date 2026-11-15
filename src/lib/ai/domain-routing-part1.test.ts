import { describe, expect, it } from 'vitest';
import {
  buildSupportAgentPrompt,
  getDomainPersonaAndGlossary,
  normalizeIndustryKey,
} from './support-agent';
import { getDomainQuickChips, getDomainWelcome } from './sub-agents';
import { AGENT_TEMPLATE_INDUSTRIES } from './agent-templates';

const PROP_FIRM_LEAK_RE = /proprietary trading|prop[\s-]firm|funded trader|trading rules|drawdown limits|challenge prices/i;

describe('Part 1 industry normalization and domain routing', () => {
  it('normalizes display labels and aliases cleanly', () => {
    expect(normalizeIndustryKey('Real estate')).toBe('real_estate');
    expect(normalizeIndustryKey('Public sector')).toBe('public_sector');
    expect(normalizeIndustryKey('SaaS')).toBe('saas');
    expect(normalizeIndustryKey('E-commerce')).toBe('ecommerce');
    expect(normalizeIndustryKey('general')).toBe('generic');
    expect(normalizeIndustryKey(null)).toBe('');
    expect(normalizeIndustryKey('   ')).toBe('');
  });

  it.each([
    ['Real estate', 'real estate'],
    ['Insurance', 'insurance policy'],
    ['Travel', 'travel and hospitality'],
    ['Telecom', 'telecom and connectivity'],
    ['Public sector', 'public-sector'],
  ])('provides dedicated persona & glossary for %s without prop-firm copy', (industry, expectedPhrase) => {
    const { persona, glossary } = getDomainPersonaAndGlossary(industry, 'Aria', 'Orbat Co');
    expect(persona.toLowerCase()).toContain(expectedPhrase);
    expect(persona).not.toMatch(PROP_FIRM_LEAK_RE);
    expect(glossary).not.toMatch(PROP_FIRM_LEAK_RE);

    const prompt = buildSupportAgentPrompt({
      botName: 'Aria',
      businessName: 'Orbat Co',
      industry,
      lang: 'en',
      knowledge: '[SOURCE 1]\nTitle: FAQ\nContent: Office hours are 9am-5pm.',
    });
    expect(prompt).not.toMatch(PROP_FIRM_LEAK_RE);
  });

  it('never leaks prop-firm copy for any AGENT_TEMPLATE_INDUSTRIES item or unknown industry', () => {
    for (const industry of [...AGENT_TEMPLATE_INDUSTRIES, 'Clothing', 'Bakery', 'Other']) {
      const { persona, glossary } = getDomainPersonaAndGlossary(industry, 'Aria', 'Orbat Co');
      expect(persona).not.toMatch(PROP_FIRM_LEAK_RE);
      expect(glossary).not.toMatch(PROP_FIRM_LEAK_RE);

      const welcomeEn = getDomainWelcome(industry, 'en', 'Orbat Co');
      const welcomeUr = getDomainWelcome(industry, 'roman_ur', 'Orbat Co');
      expect(welcomeEn).not.toMatch(PROP_FIRM_LEAK_RE);
      expect(welcomeUr).not.toMatch(PROP_FIRM_LEAK_RE);

      const chipsText = getDomainQuickChips(industry)
        .map((c) => `${c.label} ${c.value}`)
        .join(' ');
      expect(chipsText).not.toMatch(PROP_FIRM_LEAK_RE);
    }
  });

  it('falls back unrecognized non-empty industries to generic customer support', () => {
    const { persona } = getDomainPersonaAndGlossary('Boutique Fashion', 'Zoya', 'ThreadHub');
    expect(persona).toContain('senior customer support agent at ThreadHub');
    expect(persona).not.toMatch(PROP_FIRM_LEAK_RE);
  });

  it('retains prop-firm domain explicitly for prop_firm / trading', () => {
    for (const ind of ['prop_firm', 'prop-firm', 'trading', 'funded_trading']) {
      const { persona } = getDomainPersonaAndGlossary(ind, 'Max', 'Apex Funding');
      expect(persona).toContain('proprietary trading (prop) firm');
      expect(getDomainQuickChips(ind).map((c) => c.label)).toContain('📋 Trading Rules');
    }
  });
});
