"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateConversationDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateConversationDto {
}
exports.UpdateConversationDto = UpdateConversationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['open', 'closed', 'snoozed', 'pending']),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['low', 'normal', 'high', 'urgent']),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['autopilot', 'copilot', 'disabled']),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "aiMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['bot_active', 'handoff_offered', 'waiting_for_agent', 'agent_active', 'offline_queued', 'resolved']),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "handoffStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_o, value) => value !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "assignedAgentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_o, value) => value !== null),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "snoozedUntil", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateConversationDto.prototype, "tags", void 0);
//# sourceMappingURL=update-conversation.dto.js.map