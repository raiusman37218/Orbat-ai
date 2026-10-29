'use client';

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Zap,
  Shield,
  ArrowRight,
  Globe,
  Phone,
  Bot,
  Layers,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface UpgradeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  feature?: string;
  featureTitle?: string;
  targetPlan?: 'starter' | 'pro' | 'enterprise';
  onNavigateToBilling?: () => void;
}

const FEATURE_HIGHLIGHTS: Record<string, { title: string; desc: string; plan: string; icon: any }> = {
  channel_whatsapp: {
    title: 'WhatsApp Business Messaging',
    desc: 'Receive and reply to WhatsApp messages directly inside your unified inbox using the official Meta Cloud API.',
    plan: 'Pro',
    icon: Phone,
  },
  channel_instagram: {
    title: 'Instagram & Facebook Messenger',
    desc: 'Unify direct messages, story mentions, and comments across Instagram and Facebook into one seamless stream.',
    plan: 'Pro',
    icon: Globe,
  },
  custom_help_center_domain: {
    title: 'Custom Help Center Domain',
    desc: 'White-label your public knowledge base under your own domain (e.g. help.yourcompany.com) with automatic SSL.',
    plan: 'Enterprise',
    icon: Globe,
  },
  remove_branding: {
    title: 'Remove Zentry Branding',
    desc: 'Deliver a 100% white-labeled experience by hiding the "Powered by Zentry" badge on your widget and help portal.',
    plan: 'Enterprise',
    icon: Shield,
  },
  automations: {
    title: 'Automated Triggers & Workflows',
    desc: 'Set up event-driven triage rules, auto-assignment, auto-close timers, and webhook notifications.',
    plan: 'Pro',
    icon: Zap,
  },
  sla: {
    title: 'SLA Policies & Business Hours',
    desc: 'Define first-response and resolution targets, track business hours calendars, and prevent breaches.',
    plan: 'Pro',
    icon: Shield,
  },
  max_agents: {
    title: 'Add More Team Seats',
    desc: 'Grow your team beyond the Free 1-seat limit. Add agents, assign roles, and distribute tickets via round-robin.',
    plan: 'Starter / Pro',
    icon: Users,
  },
  ai_bot: {
    title: 'Autonomous Jev AI Auto-Responder',
    desc: 'Unlock 1,000+ monthly AI replies, custom system prompts, grounding with help docs, and smart escalations.',
    plan: 'Pro',
    icon: Bot,
  },
};

export function UpgradeModal({
  isOpen = false,
  onClose,
  feature,
  featureTitle,
  targetPlan = 'pro',
  onNavigateToBilling,
}: UpgradeModalProps) {
  const [active, setActive] = useState(isOpen);
  const [currentFeature, setCurrentFeature] = useState(feature);
  const [currentPlan, setCurrentPlan] = useState(targetPlan);

  useEffect(() => {
    setActive(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (feature) setCurrentFeature(feature);
    if (targetPlan) setCurrentPlan(targetPlan);
  }, [feature, targetPlan]);

  // Global listener so any component can dispatch 'zentry:open-upgrade-modal'
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ feature?: string; targetPlan?: 'starter' | 'pro' | 'enterprise' }>;
      if (customEvent.detail) {
        if (customEvent.detail.feature) setCurrentFeature(customEvent.detail.feature);
        if (customEvent.detail.targetPlan) setCurrentPlan(customEvent.detail.targetPlan);
      }
      setActive(true);
    };

    window.addEventListener('zentry:open-upgrade-modal', handleOpen);
    return () => window.removeEventListener('zentry:open-upgrade-modal', handleOpen);
  }, []);

  if (!active) return null;

  const info = (currentFeature && FEATURE_HIGHLIGHTS[currentFeature]) || {
    title: featureTitle || 'Unlock Premium Features',
    desc: 'Upgrade your workspace to unlock advanced omnichannel messaging, automated workflows, and dedicated scale.',
    plan: currentPlan === 'enterprise' ? 'Enterprise' : 'Pro',
    icon: Sparkles,
  };

  const IconComponent = info.icon;

  const handleUpgradeClick = () => {
    setActive(false);
    onClose?.();
    if (onNavigateToBilling) {
      onNavigateToBilling();
    } else {
      // Dispatches navigation to billing view or opens pricing
      window.dispatchEvent(new CustomEvent('zentry:navigate-view', { detail: { view: 'settings', tab: 'billing' } }));
    }
  };

  const handleDismiss = () => {
    setActive(false);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-warn/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Feature Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 border border-accent/20 shadow-sm">
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/20">
              <Sparkles className="w-3 h-3" />
              <span>{info.plan} Plan Feature</span>
            </div>
            <h3 className="text-lg font-bold text-ink leading-tight">
              {info.title}
            </h3>
            <p className="text-xs text-ink-2 leading-relaxed">
              {info.desc}
            </p>
          </div>
        </div>

        {/* Plan Comparison Highlights */}
        <div className="rounded-xl border border-line bg-surface-2/60 p-4 mb-6 space-y-2.5 text-xs">
          <div className="font-semibold text-ink flex items-center justify-between pb-1.5 border-b border-line">
            <span>What you get by upgrading:</span>
            <span className="text-2xs text-accent font-bold uppercase">14-Day Free Trial Available</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-ink-2">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span><strong>WhatsApp & Instagram:</strong> Unified social direct messages</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span><strong>Autonomous Jev AI:</strong> 1,000+ monthly auto-responses</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span><strong>Automations & SLAs:</strong> Event triggers and business hours</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span><strong>Custom Domain & White-label:</strong> help.yourbrand.com with 0 branding</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-xs font-semibold"
          >
            Maybe Later
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleUpgradeClick}
            className="text-xs font-semibold gap-1.5 shadow-md shadow-accent/20"
          >
            <span>Upgrade to {info.plan}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
