export const QUEUE_AI_PROCESSING = 'ai-processing';
export const QUEUE_MESSAGE_DELIVERY = 'message-delivery';
export const QUEUE_EMAIL_PROCESSING = 'email-processing';
export const QUEUE_WEBHOOKS = 'webhooks';
export const QUEUE_AUTOMATIONS = 'automations';
export const QUEUE_KNOWLEDGE_INDEXING = 'knowledge-indexing';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_ANALYTICS = 'analytics';

export const ALL_QUEUES = [
  QUEUE_AI_PROCESSING,
  QUEUE_MESSAGE_DELIVERY,
  QUEUE_EMAIL_PROCESSING,
  QUEUE_WEBHOOKS,
  QUEUE_AUTOMATIONS,
  QUEUE_KNOWLEDGE_INDEXING,
  QUEUE_NOTIFICATIONS,
  QUEUE_ANALYTICS,
] as const;

export interface AiTaskPayload {
  workspaceId: string;
  conversationId: string;
  triggerMessageId?: string;
  triggerMessage?: string;
  taskType: 'generate_reply' | 'summarize' | 'index_kb' | 'suggest_macros';
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface MessageDeliveryPayload {
  workspaceId: string;
  conversationId?: string;
  outboxId?: string;
  batchSize?: number;
  idempotencyKey?: string;
}

export interface EmailProcessingPayload {
  workspaceId: string;
  action: 'send_outbound' | 'process_inbound';
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  conversationId?: string;
  rawEmailId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  workspaceId: string;
  endpointUrl: string;
  event: string;
  payload: Record<string, any>;
  secretKey?: string;
  idempotencyKey?: string;
}

export interface AutomationPayload {
  workspaceId: string;
  action: 'check_sla' | 'auto_close_inactive' | 'run_macro';
  targetId?: string;
  inactivityMinutes?: number;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeIndexingPayload {
  workspaceId: string;
  knowledgeId: string;
  title?: string;
  content?: string;
  action: 'reindex_document' | 'delete_document';
  idempotencyKey?: string;
}

export interface NotificationPayload {
  workspaceId: string;
  recipientEmail: string;
  recipientAgentId?: string;
  recipientName?: string;
  subject: string;
  template: 'agent_assigned' | 'new_message' | 'sla_breach' | 'weekly_summary';
  context: Record<string, any>;
  idempotencyKey?: string;
}

export interface AnalyticsPayload {
  workspaceId: string;
  eventType: 'conversation_closed' | 'ai_resolution' | 'daily_rollup';
  conversationId?: string;
  metrics?: Record<string, number>;
  idempotencyKey?: string;
}
