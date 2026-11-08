/**
 * Emails a workspace sends to its own team: the invitation to join, and the
 * alert that a customer is waiting for a person. Both go out through the
 * workspace's SMTP (Settings → Channels → SMTP), so they come from the
 * business's own address, and both use the shared layout (layout.ts), which
 * escapes everything.
 */
import { renderEmail } from './layout';

export interface InviteEmailProps {
  workspaceName: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  inviteeName: string;
  inviterName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresInDays: number;
}

export function inviteEmail(p: InviteEmailProps): { subject: string; html: string; text: string } {
  const first = (p.inviteeName || '').trim().split(/\s+/)[0];
  const { html, text } = renderEmail({
    brandName: p.workspaceName,
    brandColor: p.brandColor,
    logoUrl: p.logoUrl,
    preheader: `${p.inviterName} invited you to answer customers with the ${p.workspaceName} team.`,
    title: `Join ${p.workspaceName}`,
    paragraphs: [
      `Hi ${first || 'there'},`,
      `${p.inviterName} invited you to the ${p.workspaceName} support team. Accept the invitation, choose your own password, and you will go straight to the shared inbox.`,
    ],
    details: [
      ['Role', p.roleLabel],
      ['Link valid for', `${p.expiresInDays} days, one use`],
    ],
    button: { label: 'Accept invitation', url: p.acceptUrl },
    footer: `You received this because ${p.inviterName} invited this address to ${p.workspaceName}. If you were not expecting it, you can ignore this email.`,
  });
  return { subject: `${p.inviterName} invited you to join ${p.workspaceName}`, html, text };
}

export type TeamAlertEvent = 'handover' | 'customer_reply';

export interface TeamAlertEmailProps {
  event: TeamAlertEvent;
  workspaceName: string;
  brandColor?: string | null;
  visitorName: string;
  preview: string;
  reason?: string | null;
  conversationUrl: string;
  onShift: boolean;
}

export function teamAlertEmail(p: TeamAlertEmailProps): { subject: string; html: string; text: string } {
  const preview = p.preview.replace(/\s+/g, ' ').trim().slice(0, 600);
  const handover = p.event === 'handover';
  const subject = handover ? `${p.visitorName} needs a person` : `${p.visitorName} replied and is waiting`;
  const { html, text } = renderEmail({
    brandName: p.workspaceName,
    brandColor: p.brandColor,
    preheader: preview ? `"${preview.slice(0, 100)}"` : subject,
    title: subject,
    paragraphs: [
      handover
        ? `The bot handed a conversation with ${p.visitorName} to the team. Nobody has replied yet.`
        : `${p.visitorName} wrote again in a conversation the team is handling.`,
    ],
    quote: preview ? { label: p.visitorName, text: preview } : undefined,
    details: p.reason ? [['Why', p.reason.slice(0, 200)]] : undefined,
    button: { label: 'Open the conversation', url: p.conversationUrl },
    footer: p.onShift
      ? `You received this because you are on shift for ${p.workspaceName}. Choose what you are emailed about in Settings → Notifications.`
      : `You received this as a member of ${p.workspaceName}. Choose what you are emailed about in Settings → Notifications.`,
  });
  return { subject, html, text };
}

export interface MissedChatEmailProps {
  workspaceName: string;
  brandColor?: string | null;
  visitorName: string;
  preview?: string;
  reason?: string | null;
  conversationUrl: string;
}

export function missedChatEmail(p: MissedChatEmailProps): { subject: string; html: string; text: string } {
  const preview = (p.preview || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const subject = `Missed chat: ${p.visitorName} was moved to offline queue`;
  const { html, text } = renderEmail({
    brandName: p.workspaceName,
    brandColor: p.brandColor,
    preheader: preview ? `"${preview.slice(0, 100)}"` : subject,
    title: subject,
    paragraphs: [
      `A chat with ${p.visitorName} went unanswered while ringing or timed out in queue, and has been moved to the offline queue.`,
    ],
    quote: preview ? { label: p.visitorName, text: preview } : undefined,
    details: [
      ['Customer', p.visitorName],
      ['Handoff Reason', p.reason || 'Requested human support'],
      ['Status', 'Offline queued'],
    ],
    button: { label: 'View in Queue', url: p.conversationUrl },
    footer: `You received this because missed-chat email notifications are enabled for your account in ${p.workspaceName}.`,
  });
  return { subject, html, text };
}

export interface UnansweredQueueAlertEmailProps {
  workspaceName: string;
  brandColor?: string | null;
  visitorName: string;
  waitMinutes?: number;
  reason?: string | null;
  conversationUrl: string;
  alertToRole: string;
}

export function unansweredQueueAlertEmail(p: UnansweredQueueAlertEmailProps): { subject: string; html: string; text: string } {
  const waitMin = p.waitMinutes || 5;
  const subject = `[Urgent] Customer waiting for ${waitMin}+ minutes in ${p.workspaceName}`;
  const { html, text } = renderEmail({
    brandName: p.workspaceName,
    brandColor: p.brandColor,
    preheader: `${p.visitorName} has been waiting in queue for over ${waitMin} minutes without an agent.`,
    title: `Unanswered Chat Alert (${waitMin}+ minutes)`,
    paragraphs: [
      `${p.visitorName} is still waiting in the queue without an agent reply.`,
      `As a workspace ${p.alertToRole}, please review the queue and assign an agent or reply directly.`,
    ],
    details: [
      ['Customer', p.visitorName],
      ['Wait Time', `${waitMin}+ minutes`],
      ['Handoff Reason', p.reason || 'Unanswered handoff request'],
    ],
    button: { label: 'Open Conversation', url: p.conversationUrl },
    footer: `You received this supervisory alert because unanswered queue alerts are configured for ${p.alertToRole}s in ${p.workspaceName}.`,
  });
  return { subject, html, text };
}

export interface QueueSummaryEmailProps {
  workspaceName: string;
  brandColor?: string | null;
  agentName: string;
  queuedCount: number;
  waitingCount: number;
  dashboardUrl: string;
}

export function queueSummaryEmail(p: QueueSummaryEmailProps): { subject: string; html: string; text: string } {
  const total = p.queuedCount + p.waitingCount;
  const subject = `${total} customer chat${total === 1 ? '' : 's'} waiting in ${p.workspaceName}`;
  const { html, text } = renderEmail({
    brandName: p.workspaceName,
    brandColor: p.brandColor,
    preheader: `Queue summary: ${p.waitingCount} waiting for agent, ${p.queuedCount} offline queued.`,
    title: `Queue Summary for ${p.workspaceName}`,
    paragraphs: [
      `Hi ${p.agentName}, here is the current customer queue summary.`,
    ],
    details: [
      ['Waiting for agent', `${p.waitingCount}`],
      ['Offline queued', `${p.queuedCount}`],
      ['Total pending', `${total}`],
    ],
    button: { label: 'Open Inbox & Queue', url: p.dashboardUrl },
    footer: `You received this because queue summary email notifications are enabled in ${p.workspaceName}.`,
  });
  return { subject, html, text };
}
