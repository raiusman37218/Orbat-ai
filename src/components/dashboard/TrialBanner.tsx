'use client';

import React, { useState } from 'react';
import { Sparkles, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Workspace } from '@/types/database';

interface TrialBannerProps {
  workspace: Workspace | null;
  onUpgradeClick?: () => void;
  trialDaysRemaining?: number | null;
  isTrialExpired?: boolean;
}

export function TrialBanner({
  workspace,
  onUpgradeClick,
  trialDaysRemaining,
  isTrialExpired = false,
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !workspace) return null;

  const plan = workspace.plan || 'free';
  const isTrial = typeof trialDaysRemaining === 'number' && trialDaysRemaining > 0;

  // Paid plans that are active don't show the trial/free banner
  if (!isTrial && !isTrialExpired && plan !== 'free') {
    return null;
  }

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      window.dispatchEvent(
        new CustomEvent('zentry:open-upgrade-modal', {
          detail: {
            feature: 'channel_whatsapp',
            targetPlan: 'pro',
          },
        })
      );
    }
  };

  return (
    <aside
      aria-label="Subscription status"
      className={`w-full px-4 py-2 text-xs flex items-center justify-between gap-3 border-b transition-all ${
        isTrialExpired
          ? 'bg-danger-soft border-danger-line text-danger'
          : isTrial
          ? 'bg-accent-soft border-accent/20 text-ink'
          : 'bg-surface-2 border-line text-ink'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isTrialExpired ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-danger" aria-hidden="true" />
        ) : (
          <Sparkles className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
        )}

        <div className="truncate">
          {isTrialExpired ? (
            <span>
              <strong>Free Trial Ended:</strong> Your workspace has switched to the Free tier (1 agent seat, basic live chat).
            </span>
          ) : isTrial ? (
            <span>
              <strong>Free Trial:</strong> You have <strong>{trialDaysRemaining} days remaining</strong> on your {plan.toUpperCase()} trial.
            </span>
          ) : (
            <span>
              <strong>Free Plan:</strong> You are currently on the Free tier with 1 seat &amp; 25 AI replies/mo.
            </span>
          )}
          <span className="hidden sm:inline text-ink-3 ml-1.5">
            Upgrade to Pro to unlock WhatsApp, Instagram, automations, and custom domains.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleUpgrade}
          className="btn btn-xs btn-primary gap-1 font-semibold text-2xs px-2.5 py-1"
        >
          <span>Upgrade</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
