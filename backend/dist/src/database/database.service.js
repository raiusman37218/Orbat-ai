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
var DatabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
let DatabaseService = DatabaseService_1 = class DatabaseService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(DatabaseService_1.name);
        this.pool = null;
    }
    async onModuleInit() {
        const dbUrl = this.configService.get('database.url');
        const ssl = this.configService.get('database.ssl');
        const sslRejectUnauthorized = this.configService.get('database.sslRejectUnauthorized') ?? true;
        const max = this.configService.get('database.maxPoolSize');
        if (!dbUrl) {
            this.logger.warn('DATABASE_URL is not set. Database operations will fail until configured.');
            return;
        }
        const isVercel = this.configService.get('isVercel') ?? (process.env.VERCEL === '1' || process.env.VERCEL === 'true');
        this.pool = new pg_1.Pool({
            connectionString: dbUrl,
            ssl: ssl ? { rejectUnauthorized: sslRejectUnauthorized } : false,
            max: max || (isVercel ? 5 : 20),
            idleTimeoutMillis: isVercel ? 10000 : 30000,
            connectionTimeoutMillis: 5000,
        });
        this.pool.on('error', (err) => {
            this.logger.error('Unexpected idle client error in PostgreSQL pool:', err);
        });
        if (isVercel) {
            return;
        }
        try {
            const res = await this.pool.query('SELECT NOW() as current_time, version() as version');
            this.logger.log(`Connected to PostgreSQL successfully. Version: ${res.rows[0]?.version?.split(' ')[1] || 'Unknown'}`);
        }
        catch (err) {
            this.logger.error(`Failed to connect to PostgreSQL: ${err.message}`);
        }
    }
    async onModuleDestroy() {
        if (this.pool) {
            await this.pool.end();
            this.logger.log('PostgreSQL pool closed.');
        }
    }
    async query(text, params) {
        if (!this.pool) {
            throw new Error('Database pool is not initialized. Please check DATABASE_URL.');
        }
        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            if (duration > 1000) {
                this.logger.warn(`Slow query (${duration}ms): ${text.slice(0, 100)}...`);
            }
            return res;
        }
        catch (err) {
            this.logger.error(`Database query failed: ${err.message} | Query: ${text.slice(0, 150)}`);
            throw err;
        }
    }
    async transaction(callback) {
        if (!this.pool) {
            throw new Error('Database pool is not initialized.');
        }
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    async ping() {
        if (!this.pool) {
            return { ok: false, latencyMs: 0, error: 'Database pool not initialized' };
        }
        const start = Date.now();
        try {
            await this.pool.query('SELECT 1');
            return { ok: true, latencyMs: Date.now() - start };
        }
        catch (err) {
            return { ok: false, latencyMs: Date.now() - start, error: err.message };
        }
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseService);
//# sourceMappingURL=database.service.js.map