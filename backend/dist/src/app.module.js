"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const configuration_1 = require("./config/configuration");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const workspaces_module_1 = require("./workspaces/workspaces.module");
const users_module_1 = require("./users/users.module");
const contacts_module_1 = require("./contacts/contacts.module");
const conversations_module_1 = require("./conversations/conversations.module");
const messages_module_1 = require("./messages/messages.module");
const inboxes_module_1 = require("./inboxes/inboxes.module");
const realtime_module_1 = require("./realtime/realtime.module");
const attachments_module_1 = require("./attachments/attachments.module");
const queues_module_1 = require("./queues/queues.module");
const queues_workers_module_1 = require("./queues/queues-workers.module");
const ai_engine_module_1 = require("./ai-engine/ai-engine.module");
const health_module_1 = require("./health/health.module");
const widget_module_1 = require("./widget/widget.module");
const jwt_auth_guard_1 = require("./auth/guards/jwt-auth.guard");
const tenant_guard_1 = require("./common/guards/tenant.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
                ignoreEnvFile: process.env.VERCEL === '1' || process.env.VERCEL === 'true',
                envFilePath: ['.env', '.env.local'],
            }),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            workspaces_module_1.WorkspacesModule,
            users_module_1.UsersModule,
            contacts_module_1.ContactsModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            inboxes_module_1.InboxesModule,
            realtime_module_1.RealtimeModule,
            attachments_module_1.AttachmentsModule,
            queues_module_1.QueuesModule,
            ...(process.env.IS_WORKER === 'true' || process.env.ENABLE_EMBEDDED_WORKERS === 'true'
                ? [queues_workers_module_1.QueuesWorkersModule]
                : []),
            ai_engine_module_1.AiEngineModule,
            health_module_1.HealthModule,
            widget_module_1.WidgetModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: tenant_guard_1.TenantGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: roles_guard_1.RolesGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map