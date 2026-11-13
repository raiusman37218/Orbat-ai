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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const database_service_1 = require("../database/database.service");
const public_decorator_1 = require("../common/decorators/public.decorator");
let HealthController = class HealthController {
    constructor(db) {
        this.db = db;
        this.startTime = Date.now();
    }
    async check() {
        const dbPing = await this.db.ping();
        const memory = process.memoryUsage();
        return {
            status: dbPing.ok ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            database: {
                connected: dbPing.ok,
                latencyMs: dbPing.latencyMs,
                ...(dbPing.error && { error: dbPing.error }),
            },
            system: {
                nodeVersion: process.version,
                memoryRssMb: Math.round(memory.rss / 1024 / 1024),
                memoryHeapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
            },
        };
    }
    liveness() {
        return { status: 'alive' };
    }
    async readiness() {
        const dbPing = await this.db.ping();
        if (!dbPing.ok) {
            return { status: 'not_ready', database: dbPing.error };
        }
        return { status: 'ready', database: 'connected' };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'System health check and database connectivity' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'System health metrics returned.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('live'),
    (0, swagger_1.ApiOperation)({ summary: 'Liveness probe for container orchestration' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "liveness", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('ready'),
    (0, swagger_1.ApiOperation)({ summary: 'Readiness probe for traffic routing' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "readiness", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], HealthController);
//# sourceMappingURL=health.controller.js.map