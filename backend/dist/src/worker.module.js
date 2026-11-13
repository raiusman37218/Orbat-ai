"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const configuration_1 = require("./config/configuration");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const conversations_module_1 = require("./conversations/conversations.module");
const messages_module_1 = require("./messages/messages.module");
const realtime_module_1 = require("./realtime/realtime.module");
const queues_module_1 = require("./queues/queues.module");
const queues_workers_module_1 = require("./queues/queues-workers.module");
const ai_engine_module_1 = require("./ai-engine/ai-engine.module");
let WorkerModule = class WorkerModule {
};
exports.WorkerModule = WorkerModule;
exports.WorkerModule = WorkerModule = __decorate([
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
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            realtime_module_1.RealtimeModule,
            queues_module_1.QueuesModule,
            ai_engine_module_1.AiEngineModule,
            queues_workers_module_1.QueuesWorkersModule,
        ],
    })
], WorkerModule);
//# sourceMappingURL=worker.module.js.map