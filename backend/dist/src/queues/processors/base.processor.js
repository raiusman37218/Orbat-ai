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
exports.BaseQueueProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
class BaseQueueProcessor extends bullmq_1.WorkerHost {
    constructor(queuesService) {
        super();
        this.queuesService = queuesService;
    }
    async onFailed(job, error) {
        if (!job)
            return;
        const maxAttempts = job.opts?.attempts ?? 1;
        if (job.attemptsMade >= maxAttempts && this.queuesService) {
            await this.queuesService.recordDeadLetterJob({
                queueName: job.queueName,
                jobId: job.id,
                jobName: job.name,
                workspaceId: job.data?.workspaceId || null,
                payload: job.data,
                errorMessage: error?.message || 'Unknown worker failure',
                attemptsMade: job.attemptsMade,
            });
        }
    }
}
exports.BaseQueueProcessor = BaseQueueProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", Promise)
], BaseQueueProcessor.prototype, "onFailed", null);
//# sourceMappingURL=base.processor.js.map