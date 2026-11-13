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
exports.ContactsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const contacts_service_1 = require("./contacts.service");
const query_contacts_dto_1 = require("./dto/query-contacts.dto");
const create_contact_dto_1 = require("./dto/create-contact.dto");
const update_contact_dto_1 = require("./dto/update-contact.dto");
const current_workspace_decorator_1 = require("../common/decorators/current-workspace.decorator");
let ContactsController = class ContactsController {
    constructor(contactsService) {
        this.contactsService = contactsService;
    }
    async getContacts(workspaceId, query) {
        return this.contactsService.getContacts(workspaceId, query);
    }
    async getLiveMeta(workspaceId, visitorIds) {
        const ids = (visitorIds || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return this.contactsService.getLiveVisitorMeta(workspaceId, ids);
    }
    async getContactById(workspaceId, contactId) {
        return this.contactsService.getContactById(workspaceId, contactId);
    }
    async createContact(workspaceId, dto) {
        return this.contactsService.createOrUpsertContact(workspaceId, dto);
    }
    async updateContact(workspaceId, contactId, dto) {
        return this.contactsService.updateContact(workspaceId, contactId, dto);
    }
    async getConversations(workspaceId, contactId) {
        return this.contactsService.getConversations(workspaceId, contactId);
    }
};
exports.ContactsController = ContactsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List contacts / visitors with pagination and filters' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated list of contacts.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, query_contacts_dto_1.QueryContactsDto]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "getContacts", null);
__decorate([
    (0, common_1.Get)('live-meta'),
    (0, swagger_1.ApiOperation)({ summary: 'Batch load recent page history and open tickets for live visitors' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Live visitor metadata returned.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Query)('visitorIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "getLiveMeta", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get contact profile and page history by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Contact details returned.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Contact not found.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "getContactById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create or upsert contact' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Contact created or updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_contact_dto_1.CreateContactDto]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "createContact", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update contact details' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Contact updated.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_contact_dto_1.UpdateContactDto]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Get)(':id/conversations'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all conversation threads for this contact' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of conversations.' }),
    __param(0, (0, current_workspace_decorator_1.CurrentWorkspace)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "getConversations", null);
exports.ContactsController = ContactsController = __decorate([
    (0, swagger_1.ApiTags)('Contacts (Visitors)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('contacts'),
    __metadata("design:paramtypes", [contacts_service_1.ContactsService])
], ContactsController);
//# sourceMappingURL=contacts.controller.js.map