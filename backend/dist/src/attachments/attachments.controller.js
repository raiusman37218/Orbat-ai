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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const attachments_service_1 = require("./attachments.service");
const presign_upload_dto_1 = require("./dto/presign-upload.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let AttachmentsController = class AttachmentsController {
    constructor(attachmentsService) {
        this.attachmentsService = attachmentsService;
    }
    async presignUpload(workspaceId, dto, user) {
        return this.attachmentsService.createPresignedUpload(workspaceId, dto, user);
    }
    async confirmUpload(workspaceId, attachmentId) {
        return this.attachmentsService.confirmUpload(workspaceId, attachmentId);
    }
    async getDownloadUrl(workspaceId, attachmentId) {
        return this.attachmentsService.getDownloadUrl(workspaceId, attachmentId);
    }
    async deleteAttachment(workspaceId, attachmentId) {
        return this.attachmentsService.deleteAttachment(workspaceId, attachmentId);
    }
};
exports.AttachmentsController = AttachmentsController;
__decorate([
    (0, common_1.Post)('presign-upload'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate presigned S3/R2 upload URL for file' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, presign_upload_dto_1.PresignUploadDto, Object]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "presignUpload", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm file has finished uploading to storage' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "confirmUpload", null);
__decorate([
    (0, common_1.Get)(':id/download-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get secure signed download URL for private attachment' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "getDownloadUrl", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete attachment file and metadata' }),
    __param(0, (0, common_1.Param)('workspaceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "deleteAttachment", null);
exports.AttachmentsController = AttachmentsController = __decorate([
    (0, swagger_1.ApiTags)('Attachments & Storage'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('workspaces/:workspaceId/attachments'),
    __metadata("design:paramtypes", [attachments_service_1.AttachmentsService])
], AttachmentsController);
//# sourceMappingURL=attachments.controller.js.map