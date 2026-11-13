"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AutomationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
let AutomationsProcessor = AutomationsProcessor_1 = class AutomationsProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(AutomationsProcessor_1.name);
    }
    async process(job) {
        const { action, workspaceId, targetId } = job.data;
        this.logger.log(`Executing automation job ${job.id} (${action}) for workspace ${workspaceId}`);
        switch (action) {
            case 'check_sla':
                return { action, checked: true, breachedCount: 0 };
            case 'auto_close_inactive':
                return { action, closedCount: 0 };
            default:
                return { action, executed: true };
        }
    }
};
exports.AutomationsProcessor = AutomationsProcessor;
exports.AutomationsProcessor = AutomationsProcessor = AutomationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_AUTOMATIONS, {
        concurrency: 5,
    })
], AutomationsProcessor);
//# sourceMappingURL=automations.processor.js.map