export declare const QUEUE_AI_PROCESSING = "ai-processing";
export declare const QUEUE_NOTIFICATIONS = "notifications";
export declare const QUEUE_AUTOMATIONS = "automations";
export declare const QUEUE_WEBHOOKS = "webhooks";
export interface AiTaskPayload {
    workspaceId: string;
    conversationId: string;
    triggerMessageId?: string;
    taskType: 'generate_reply' | 'summarize' | 'index_kb' | 'suggest_macros';
    metadata?: Record<string, any>;
}
export interface NotificationPayload {
    workspaceId: string;
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    template: 'agent_assigned' | 'new_message' | 'sla_breach' | 'weekly_summary';
    context: Record<string, any>;
}
export interface AutomationPayload {
    workspaceId: string;
    action: 'check_sla' | 'auto_close_inactive' | 'run_macro';
    targetId?: string;
    metadata?: Record<string, any>;
}
export interface WebhookPayload {
    workspaceId: string;
    endpointUrl: string;
    event: string;
    payload: Record<string, any>;
    secretKey?: string;
}
