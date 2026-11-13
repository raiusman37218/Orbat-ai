import { AgentRole } from '../types/tenant-context';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: AgentRole[]) => import("@nestjs/common").CustomDecorator<string>;
