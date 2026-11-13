export type AgentRole = 'owner' | 'admin' | 'agent' | 'light_agent';
export type AgentStatus = 'online' | 'away' | 'offline';
export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: AgentRole;
    workspaceId: string;
    isSuperAdmin?: boolean;
}
export interface TenantContext {
    workspaceId: string;
    user: AuthenticatedUser;
}
