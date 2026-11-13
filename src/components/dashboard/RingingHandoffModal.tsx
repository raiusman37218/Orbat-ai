'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PhoneCall, PhoneForwarded, X, AlertCircle, Clock, User, MessageSquare } from 'lucide-react';
import { sound } from '@/lib/sound';
import { startTabAlert, stopTabAlert } from '@/lib/favicon';
import { cn } from '@/lib/utils';
import { claimConversationAction, skipConversationAction } from '@/app/actions/inbox';
import { isBackendAuthenticated } from '@/lib/api/backend-auth';
import { claimBackendHandoff, skipBackendHandoff } from '@/lib/api/backend-client';
import { useToast } from '@/components/ui/Toast';

export interface RingingHandoffPayload {
  conversationId: string;
  visitorName: string;
  visitorEmail?: string | null;
  question?: string | null;
  summary?: string | null;
  reason?: string | null;
  timeoutSeconds: number;
  broadcast?: boolean;
}

interface RingingHandoffModalProps {
  payload: RingingHandoffPayload | null;
  onClose: () => void;
  onAccepted: (conversationId: string) => void;
}

export function RingingHandoffModal({ payload, onClose, onAccepted }: RingingHandoffModalProps) {
  const toast = useToast();
  const [remainingSeconds, setRemainingSeconds] = useState(payload?.timeoutSeconds || 45);
  const [claiming, setClaiming] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const initialSeconds = payload?.timeoutSeconds || 45;

  useEffect(() => {
    if (!payload) return;

    setRemainingSeconds(payload.timeoutSeconds || 45);
    sound.startRinging();
    startTabAlert('🔔 Customer waiting for agent!');

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      sound.stopRinging();
      stopTabAlert();
    };
  }, [payload?.conversationId]);

  const handleAutoSkip = async () => {
    if (!payload) return;
    sound.stopRinging();
    stopTabAlert();
    try {
      if (isBackendAuthenticated()) {
        await skipBackendHandoff(payload.conversationId);
      } else {
        await skipConversationAction(payload.conversationId);
      }
    } catch {
      // Ignore
    }
    onClose();
  };

  const handleAccept = async () => {
    if (!payload || claiming) return;
    setClaiming(true);
    sound.stopRinging();
    stopTabAlert();

    try {
      let res: { ok: boolean; reason?: string; message?: string } | null = null;
      if (isBackendAuthenticated()) {
        res = await claimBackendHandoff(payload.conversationId);
      } else {
        res = await claimConversationAction(payload.conversationId);
      }

      if (!res?.ok) {
        if (res?.reason === 'already_claimed') {
          toast.show(res.message || 'Another agent already took this chat', 'info');
        } else {
          toast.error(res?.message || 'Could not claim chat');
        }
        onClose();
        return;
      }

      toast.success('Chat accepted');
      onAccepted(payload.conversationId);
      onClose();
    } catch (err: any) {
      toast.error('Error claiming chat: ' + (err?.message || 'Unknown error'));
      onClose();
    } finally {
      setClaiming(false);
    }
  };

  const handleSkip = async () => {
    if (!payload || skipping) return;
    setSkipping(true);
    sound.stopRinging();
    stopTabAlert();

    try {
      if (isBackendAuthenticated()) {
        await skipBackendHandoff(payload.conversationId);
      } else {
        await skipConversationAction(payload.conversationId);
      }
      toast.show('Chat skipped', 'info');
    } catch {
      // Ignore
    } finally {
      setSkipping(false);
      onClose();
    }
  };

  if (!payload) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / initialSeconds) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade">
      <div className="card w-full max-w-md p-6 shadow-2xl border-line-2 bg-surface animate-rise relative overflow-hidden">
        {/* Top Progress Bar for Countdown */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-line">
          <div
            className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Ringing Header */}
        <div className="flex items-start justify-between gap-3 mt-1 pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent animate-pulse shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-ink">Incoming Customer Chat</h3>
                {payload.broadcast && (
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                    Broadcast
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3">A customer requested live human support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            disabled={claiming || skipping}
            className="text-ink-3 hover:text-ink p-1 rounded-md transition-colors cursor-pointer"
            title="Skip this chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visitor Details & Initial Question */}
        <div className="py-4 space-y-3">
          <div className="flex items-center gap-2.5 text-xs">
            <User className="w-4 h-4 text-ink-3 shrink-0" />
            <span className="font-semibold text-ink">{payload.visitorName || 'Customer'}</span>
            {payload.visitorEmail && (
              <span className="text-ink-3 text-2xs truncate font-mono">({payload.visitorEmail})</span>
            )}
          </div>

          {(payload.question || payload.summary) && (
            <div className="p-3 rounded-xl bg-surface-2 border border-line text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-2xs font-medium text-ink-3">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{payload.reason ? `Reason: ${payload.reason}` : 'Question'}</span>
              </div>
              <p className="text-ink font-medium leading-relaxed line-clamp-3">
                &ldquo;{payload.question || payload.summary}&rdquo;
              </p>
            </div>
          )}

          {/* Countdown Clock Display */}
          <div className="flex items-center justify-between text-xs text-ink-3 pt-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Auto-skip in</span>
            </span>
            <span className="font-mono font-bold text-accent text-sm">
              {remainingSeconds}s
            </span>
          </div>
        </div>

        {/* Accept / Skip Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={claiming || skipping}
            className="btn btn-secondary justify-center py-2.5 font-semibold text-xs gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <PhoneForwarded className="w-4 h-4" />
            <span>{skipping ? 'Skipping…' : 'Skip'}</span>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={claiming || skipping}
            className="btn btn-primary justify-center py-2.5 font-semibold text-xs gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{claiming ? 'Accepting…' : 'Accept Chat'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
