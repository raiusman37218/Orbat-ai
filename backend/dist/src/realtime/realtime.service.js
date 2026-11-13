"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    constructor() {
        this.logger = new common_1.Logger(RealtimeService_1.name);
        this.server = null;
    }
    setServer(server) {
        this.server = server;
        this.logger.log('Socket.IO Server instance registered in RealtimeService.');
    }
    isReady() {
        return Boolean(this.server);
    }
    emitToConversation(conversationId, event, data) {
        if (!this.server) {
            this.logger.warn(`Cannot emit '${event}' to conversation:${conversationId} — Socket.IO server not initialized`);
            return false;
        }
        this.server.to(`conversation:${conversationId}`).emit(event, data);
        return true;
    }
    emitToWorkspace(workspaceId, event, data) {
        if (!this.server) {
            this.logger.warn(`Cannot emit '${event}' to workspace:${workspaceId} — Socket.IO server not initialized`);
            return false;
        }
        this.server.to(`workspace:${workspaceId}`).emit(event, data);
        return true;
    }
    emitToUser(userId, event, data) {
        if (!this.server) {
            this.logger.warn(`Cannot emit '${event}' to user:${userId} — Socket.IO server not initialized`);
            return false;
        }
        this.server.to(`user:${userId}`).emit(event, data);
        return true;
    }
    broadcastTyping(conversationId, data) {
        return this.emitToConversation(conversationId, 'typing:update', {
            conversationId,
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
    broadcastPresence(workspaceId, data) {
        return this.emitToWorkspace(workspaceId, 'presence:update', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)()
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map