export declare class UpdateConversationDto {
    status?: 'open' | 'closed' | 'snoozed' | 'pending';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    aiMode?: 'autopilot' | 'copilot' | 'disabled';
    handoffStatus?: 'bot_active' | 'handoff_offered' | 'waiting_for_agent' | 'agent_active' | 'offline_queued' | 'resolved';
    assignedAgentId?: string | null;
    snoozedUntil?: string | null;
    tags?: string[];
}
