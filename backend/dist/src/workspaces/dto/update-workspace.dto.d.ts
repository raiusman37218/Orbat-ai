export declare class UpdateWorkspaceDto {
    name?: string;
    websiteUrl?: string;
    brandColor?: string;
    logoUrl?: string;
    greetingTitle?: string;
    greetingMessage?: string;
    widgetPosition?: 'right' | 'left';
    timezone?: string;
    language?: string;
    businessHours?: Record<string, any>;
    aiSettings?: Record<string, any>;
    handoffSettings?: Record<string, any>;
}
