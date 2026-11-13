"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsModule = void 0;
const common_1 = require("@nestjs/common");
const attachments_controller_1 = require("./attachments.controller");
const attachments_service_1 = require("./attachments.service");
const cloudflare_r2_provider_1 = require("./storage/cloudflare-r2.provider");
const storage_provider_interface_1 = require("./storage/storage-provider.interface");
let AttachmentsModule = class AttachmentsModule {
};
exports.AttachmentsModule = AttachmentsModule;
exports.AttachmentsModule = AttachmentsModule = __decorate([
    (0, common_1.Module)({
        controllers: [attachments_controller_1.AttachmentsController],
        providers: [
            attachments_service_1.AttachmentsService,
            cloudflare_r2_provider_1.CloudflareR2StorageProvider,
            {
                provide: storage_provider_interface_1.STORAGE_PROVIDER,
                useClass: cloudflare_r2_provider_1.CloudflareR2StorageProvider,
            },
        ],
        exports: [attachments_service_1.AttachmentsService, storage_provider_interface_1.STORAGE_PROVIDER],
    })
], AttachmentsModule);
//# sourceMappingURL=attachments.module.js.map