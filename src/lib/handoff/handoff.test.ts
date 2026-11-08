import { describe, expect, it } from 'vitest';
import {
  canAiRespond,
  getHandoffStateBadge,
  HANDOFF_STATES,
  isValidHandoffTransition,
  isWithinOfficeHours,
  matchHandoffKeywords,
  VALID_HANDOFF_TRANSITIONS,
} from './state-machine';
import type { HandoffStatus } from '@/types/database';

describe('AI -> Human Agent Handoff State Machine', () => {
  it('covers all 6 required handoff states', () => {
    const required: HandoffStatus[] = [
      'bot_active',
      'handoff_offered',
      'waiting_for_agent',
      'agent_active',
      'offline_queued',
      'resolved',
    ];
    expect(HANDOFF_STATES).toHaveLength(6);
    for (const state of required) {
      expect(HANDOFF_STATES).toContain(state);
    }
  });

  describe('valid state transitions', () => {
    it('allows bot_active to transition to handoff_offered, waiting_for_agent, offline_queued, or resolved', () => {
      expect(isValidHandoffTransition('bot_active', 'handoff_offered')).toBe(true);
      expect(isValidHandoffTransition('bot_active', 'waiting_for_agent')).toBe(true);
      expect(isValidHandoffTransition('bot_active', 'offline_queued')).toBe(true);
      expect(isValidHandoffTransition('bot_active', 'resolved')).toBe(true);
      // Cannot jump straight to agent_active without claim/accept
      expect(isValidHandoffTransition('bot_active', 'agent_active')).toBe(false);
    });

    it('allows handoff_offered transitions', () => {
      expect(isValidHandoffTransition('handoff_offered', 'waiting_for_agent')).toBe(true);
      expect(isValidHandoffTransition('handoff_offered', 'offline_queued')).toBe(true);
      expect(isValidHandoffTransition('handoff_offered', 'bot_active')).toBe(true);
      expect(isValidHandoffTransition('handoff_offered', 'resolved')).toBe(true);
      expect(isValidHandoffTransition('handoff_offered', 'agent_active')).toBe(false);
    });

    it('allows waiting_for_agent to be claimed by agent or fall back to offline_queued', () => {
      expect(isValidHandoffTransition('waiting_for_agent', 'agent_active')).toBe(true);
      expect(isValidHandoffTransition('waiting_for_agent', 'offline_queued')).toBe(true);
      expect(isValidHandoffTransition('waiting_for_agent', 'resolved')).toBe(true);
      expect(isValidHandoffTransition('waiting_for_agent', 'handoff_offered')).toBe(false);
    });

    it('enforces agent_active transitions: can only return to AI or resolve', () => {
      expect(isValidHandoffTransition('agent_active', 'bot_active')).toBe(true);
      expect(isValidHandoffTransition('agent_active', 'resolved')).toBe(true);
      expect(isValidHandoffTransition('agent_active', 'waiting_for_agent')).toBe(false);
      expect(isValidHandoffTransition('agent_active', 'handoff_offered')).toBe(false);
      expect(isValidHandoffTransition('agent_active', 'offline_queued')).toBe(false);
    });

    it('allows customer reopening resolved conversations within 24h back to bot_active', () => {
      expect(isValidHandoffTransition('resolved', 'bot_active')).toBe(true);
      expect(isValidHandoffTransition('resolved', 'waiting_for_agent')).toBe(true);
    });
  });

  describe('canAiRespond (SPEC C AI Guard)', () => {
    it('permits AI to respond during bot_active and handoff_offered', () => {
      expect(canAiRespond('bot_active')).toBe(true);
      expect(canAiRespond('handoff_offered')).toBe(true);
    });

    it('strictly forbids AI from speaking once human agent is active (agent_active)', () => {
      expect(canAiRespond('agent_active')).toBe(false);
      expect(canAiRespond('agent_active', { aiAssist: true })).toBe(false);
      expect(canAiRespond('agent_active', { aiEnabled: true })).toBe(false);
    });

    it('strictly forbids AI from speaking while waiting for agent', () => {
      expect(canAiRespond('waiting_for_agent')).toBe(false);
    });

    it('strictly forbids AI from speaking on resolved conversations', () => {
      expect(canAiRespond('resolved')).toBe(false);
    });

    it('handles offline_queued: AI speaks ONLY when customer explicitly enabled ai_assist', () => {
      expect(canAiRespond('offline_queued', { aiAssist: false })).toBe(false);
      expect(canAiRespond('offline_queued', { aiAssist: undefined })).toBe(false);
      expect(canAiRespond('offline_queued', { aiAssist: true })).toBe(true);
    });

    it('respects global aiEnabled flag', () => {
      expect(canAiRespond('bot_active', { aiEnabled: false })).toBe(false);
      expect(canAiRespond('handoff_offered', { aiEnabled: false })).toBe(false);
      expect(canAiRespond('offline_queued', { aiAssist: true, aiEnabled: false })).toBe(false);
    });
  });

  describe('matchHandoffKeywords', () => {
    it('detects standard English keywords', () => {
      expect(matchHandoffKeywords('Can I speak to an agent?')).toEqual({
        matched: true,
        keyword: 'agent',
      });
      expect(matchHandoffKeywords('I need a human right now')).toEqual({
        matched: true,
        keyword: 'human',
      });
      expect(matchHandoffKeywords('Please connect me with a real person')).toEqual({
        matched: true,
        keyword: 'real person',
      });
      expect(matchHandoffKeywords('I want a refund on my plan')).toEqual({
        matched: true,
        keyword: 'refund',
      });
    });

    it('detects Roman Urdu keywords', () => {
      expect(matchHandoffKeywords('kisi insaan se baat karwao')).toEqual({
        matched: true,
        keyword: 'insaan',
      });
      expect(matchHandoffKeywords('koi banda available hai?')).toEqual({
        matched: true,
        keyword: 'banda',
      });
      expect(matchHandoffKeywords('mujhe agent se baat karni hai')).toEqual({
        matched: true,
        keyword: 'agent se baat',
      });
    });

    it('does not trigger on partial words or substring collisions', () => {
      expect(matchHandoffKeywords('The percentage of uptime is 99%').matched).toBe(false);
      expect(matchHandoffKeywords('This is great management').matched).toBe(false);
    });

    it('supports custom workspace keywords', () => {
      expect(
        matchHandoffKeywords('I have an urgent billing query', ['urgent billing'])
      ).toEqual({
        matched: true,
        keyword: 'urgent billing',
      });
    });
  });

  describe('getHandoffStateBadge', () => {
    it('returns valid UI badges for each state', () => {
      expect(getHandoffStateBadge('bot_active').label).toBe('AI Active');
      expect(getHandoffStateBadge('handoff_offered').label).toBe('Handoff Offered');
      expect(getHandoffStateBadge('waiting_for_agent').label).toBe('Waiting for Agent');
      expect(getHandoffStateBadge('agent_active').label).toBe('Agent Active');
      expect(getHandoffStateBadge('offline_queued').label).toBe('Offline Queue');
      expect(getHandoffStateBadge('resolved').label).toBe('Resolved');
    });
  });

  describe('isWithinOfficeHours', () => {
    const baseSchedule = {
      enabled: true,
      timezone: 'UTC',
      schedule: {
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false, start: '09:00', end: '17:00' },
        sunday: { enabled: false, start: '09:00', end: '17:00' },
      },
      holidays: ['2026-12-25'],
    };

    it('returns true if office hours enforcement is disabled', () => {
      expect(isWithinOfficeHours({ ...baseSchedule, enabled: false })).toBe(true);
      expect(isWithinOfficeHours(null)).toBe(true);
    });

    it('returns true on an enabled weekday during open hours', () => {
      // 2026-11-23 is Monday at 12:00 UTC
      const openTime = new Date('2026-11-23T12:00:00Z');
      expect(isWithinOfficeHours(baseSchedule, openTime)).toBe(true);
    });

    it('returns false before opening or after closing', () => {
      // Monday 08:30 UTC
      const tooEarly = new Date('2026-11-23T08:30:00Z');
      expect(isWithinOfficeHours(baseSchedule, tooEarly)).toBe(false);

      // Monday 17:30 UTC
      const tooLate = new Date('2026-11-23T17:30:00Z');
      expect(isWithinOfficeHours(baseSchedule, tooLate)).toBe(false);
    });

    it('returns false on weekends when disabled', () => {
      // 2026-11-28 is Saturday
      const saturday = new Date('2026-11-28T12:00:00Z');
      expect(isWithinOfficeHours(baseSchedule, saturday)).toBe(false);
    });

    it('returns false on holidays', () => {
      // 2026-12-25 is Friday (normally open, but in holidays list)
      const holiday = new Date('2026-12-25T12:00:00Z');
      expect(isWithinOfficeHours(baseSchedule, holiday)).toBe(false);
    });
  });
});
