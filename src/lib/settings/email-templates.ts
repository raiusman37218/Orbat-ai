export type EmailTemplateCategory = 'Conversations' | 'Tickets' | 'Security' | 'Compliance';

export interface EmailTemplateSeed {
  templateKey: string;
  category: EmailTemplateCategory;
  name: string;
  triggerDescription: string;
  subject: string;
  body: string;
  ctaLabel: string;
  availableVariables: string[];
  sampleContext: Record<string, string>;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    templateKey: 'missed_chat',
    category: 'Conversations',
    name: 'Missed chat follow-up',
    triggerDescription: 'Sent 5 minutes after an unanswered widget message when offline',
    subject: 'We got your message — {{workspace_name}}',
    body: [
      'Hi {{customer_name}},',
      '',
      "Thanks for reaching out while the team was away. Your note is in queue #{{ticket_number}}, and {{agent_name}} will reply as soon as we're back at {{next_open_time}}.",
      '',
      'Summary of what you asked:',
      '“{{last_message}}”',
    ].join('\n'),
    ctaLabel: 'Open conversation',
    availableVariables: [
      'customer_name',
      'workspace_name',
      'ticket_number',
      'agent_name',
      'next_open_time',
      'last_message',
    ],
    sampleContext: {
      customer_name: 'Hannah',
      workspace_name: 'Acme Support',
      ticket_number: '1042',
      agent_name: 'Alex',
      next_open_time: '09:00 UTC',
      last_message: 'Can I switch our billing plan to annual?',
    },
  },
  {
    templateKey: 'transcript',
    category: 'Conversations',
    name: 'Chat transcript',
    triggerDescription: 'Sent when a customer requests a copy of the conversation',
    subject: 'Your conversation transcript ({{ticket_number}})',
    body: [
      'Hi {{customer_name}},',
      '',
      'Here is a copy of your conversation with {{workspace_name}} on {{closed_date}}.',
      '',
      'Handled by: {{agent_name}}',
      'Summary: {{conversation_summary}}',
    ].join('\n'),
    ctaLabel: 'View thread online',
    availableVariables: [
      'customer_name',
      'workspace_name',
      'ticket_number',
      'closed_date',
      'agent_name',
      'conversation_summary',
    ],
    sampleContext: {
      customer_name: 'Hannah',
      workspace_name: 'Acme Support',
      ticket_number: '1042',
      closed_date: 'Today',
      agent_name: 'Alex',
      conversation_summary: 'Verified workspace webhook configuration and rotated signing secret.',
    },
  },
  {
    templateKey: 'ticket_reply',
    category: 'Tickets',
    name: 'Ticket reply',
    triggerDescription: 'Sent each time an agent posts a public reply on an email ticket',
    subject: 'Re: {{ticket_subject}} [{{ticket_number}}]',
    body: [
      'Hi {{customer_name}},',
      '',
      '{{reply_body}}',
      '',
      '— {{agent_name}}, {{workspace_name}}',
    ].join('\n'),
    ctaLabel: 'Reply to ticket',
    availableVariables: [
      'customer_name',
      'ticket_subject',
      'ticket_number',
      'reply_body',
      'agent_name',
      'workspace_name',
    ],
    sampleContext: {
      customer_name: 'Hannah',
      ticket_subject: 'API rate limit upgrade',
      ticket_number: '1042',
      reply_body: 'We raised your workspace webhook throughput to 120 req/sec and verified delivery.',
      agent_name: 'Alex',
      workspace_name: 'Acme Support',
    },
  },
  {
    templateKey: 'ticket_solved',
    category: 'Tickets',
    name: 'Ticket solved + rating',
    triggerDescription: 'Sent when a ticket transitions to closed and CSAT is enabled',
    subject: 'How did we do on ticket {{ticket_number}}?',
    body: [
      'Hi {{customer_name}},',
      '',
      '{{agent_name}} marked your ticket “{{ticket_subject}}” as solved. Could you spare 5 seconds to rate how we handled it?',
      '',
      'If anything else comes up, simply reply to reopen the thread.',
    ].join('\n'),
    ctaLabel: 'Rate this conversation',
    availableVariables: ['customer_name', 'agent_name', 'ticket_subject', 'ticket_number', 'workspace_name'],
    sampleContext: {
      customer_name: 'Hannah',
      agent_name: 'Alex',
      ticket_subject: 'API rate limit upgrade',
      ticket_number: '1042',
      workspace_name: 'Acme Support',
    },
  },
  {
    templateKey: 'verify_code',
    category: 'Security',
    name: 'Verification code',
    triggerDescription: 'Sent when a teammate signs in or enables email verification',
    subject: 'Your {{workspace_name}} verification code: {{otp_code}}',
    body: [
      'Hi {{agent_name}},',
      '',
      'Use this one-time verification code to confirm your session:',
      '',
      '{{otp_code}}',
      '',
      'This code expires in 10 minutes. If you did not request it, rotate your password immediately.',
    ].join('\n'),
    ctaLabel: '',
    availableVariables: ['agent_name', 'workspace_name', 'otp_code'],
    sampleContext: {
      agent_name: 'Alex',
      workspace_name: 'Acme Support',
      otp_code: '482 910',
    },
  },
  {
    templateKey: 'team_invite',
    category: 'Security',
    name: 'Team invite',
    triggerDescription: 'Sent when an admin invites a new member to the workspace',
    subject: '{{inviter_name}} invited you to join {{workspace_name}} on ORBAT',
    body: [
      'Hi {{invitee_name}},',
      '',
      '{{inviter_name}} has invited you to collaborate in {{workspace_name}} as {{invite_role}}.',
      '',
      'Accept the invitation below to set up your account and join the inbox.',
    ].join('\n'),
    ctaLabel: 'Accept invitation',
    availableVariables: ['invitee_name', 'inviter_name', 'workspace_name', 'invite_role'],
    sampleContext: {
      invitee_name: 'Sam',
      inviter_name: 'Alex',
      workspace_name: 'Acme Support',
      invite_role: 'Admin',
    },
  },
  {
    templateKey: 'dsr_received',
    category: 'Compliance',
    name: 'Data request confirmation',
    triggerDescription: 'Sent when a customer submits an export or erasure request',
    subject: 'We received your privacy request ({{request_id}})',
    body: [
      'Hi {{customer_name}},',
      '',
      'This confirms we received your {{request_type}} request for {{workspace_name}}.',
      '',
      'Reference ID: {{request_id}}',
      'Estimated completion: within {{sla_days}} days.',
    ].join('\n'),
    ctaLabel: 'View request status',
    availableVariables: ['customer_name', 'request_type', 'workspace_name', 'request_id', 'sla_days'],
    sampleContext: {
      customer_name: 'Hannah',
      request_type: 'data export',
      workspace_name: 'Acme Support',
      request_id: 'DSR-2026-091',
      sla_days: '30',
    },
  },
];

export function renderTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key];
    }
    return match;
  });
}
