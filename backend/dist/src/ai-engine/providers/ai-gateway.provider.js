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
var AiGatewayProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGatewayProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_service_1 = require("../../database/database.service");
const openai_provider_1 = require("./openai.provider");
const anthropic_provider_1 = require("./anthropic.provider");
const gemini_provider_1 = require("./gemini.provider");
const openai_compatible_provider_1 = require("./openai-compatible.provider");
const mock_fallback_provider_1 = require("./mock-fallback.provider");
const COMPATIBLE_PROVIDERS = new Set([
    'deepseek',
    'openrouter',
    'groq',
    'together',
    'ollama',
    'vllm',
    'compatible',
]);
let AiGatewayProvider = AiGatewayProvider_1 = class AiGatewayProvider {
    constructor(config, openai, anthropic, gemini, compatible, mock, db) {
        this.config = config;
        this.openai = openai;
        this.anthropic = anthropic;
        this.gemini = gemini;
        this.compatible = compatible;
        this.mock = mock;
        this.db = db;
        this.providerName = 'ai-gateway';
        this.logger = new common_1.Logger(AiGatewayProvider_1.name);
    }
    async generateCompletion(request) {
        const wsConfig = request.workspaceId
            ? await this.loadWorkspaceConfig(request.workspaceId)
            : {};
        const candidates = this.buildCandidateChain(request, wsConfig);
        const errors = [];
        for (const candidate of candidates) {
            try {
                return await this.executeWithRetry(candidate.provider, {
                    ...request,
                    model: candidate.model || request.model,
                    apiKey: candidate.apiKey || request.apiKey,
                    baseUrl: candidate.baseUrl || request.baseUrl,
                });
            }
            catch (err) {
                const msg = `${candidate.provider}: ${err?.message || String(err)}`;
                errors.push(msg);
                this.logger.warn(`AI provider candidate failed -> trying next (${msg})`);
            }
        }
        const isProd = (this.config?.get('nodeEnv') || process.env.NODE_ENV) === 'production';
        const allowMockInProd = process.env.ALLOW_MOCK_AI === 'true';
        if (isProd && !allowMockInProd) {
            throw new Error(`No AI provider succeeded (${errors.join(' | ') || 'no provider configured'}).`);
        }
        return this.mock.generateCompletion(request);
    }
    async generateEmbeddings(texts) {
        const geminiKey = this.config?.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
        if (geminiKey) {
            try {
                return await this.gemini.generateEmbeddings(texts, geminiKey);
            }
            catch (err) {
                this.logger.warn(`Gemini embeddings failed: ${err?.message}`);
            }
        }
        const ollamaUrl = process.env.OLLAMA_BASE_URL;
        if (ollamaUrl) {
            try {
                return await this.compatible.generateEmbeddingsForUrl(ollamaUrl, texts, {
                    model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
                });
            }
            catch (err) {
                this.logger.warn(`Ollama embeddings failed: ${err?.message}`);
            }
        }
        const openaiKey = this.config?.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
        if (openaiKey) {
            try {
                return await this.openai.generateEmbeddings(texts);
            }
            catch (err) {
                this.logger.warn(`OpenAI embeddings failed: ${err?.message}`);
            }
        }
        const isProd = (this.config?.get('nodeEnv') || process.env.NODE_ENV) === 'production';
        if (isProd && process.env.ALLOW_MOCK_AI !== 'true') {
            throw new Error('No live embedding provider configured in production.');
        }
        return this.mock.generateEmbeddings(texts);
    }
    async executeWithRetry(provider, request) {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await this.dispatchToProvider(provider, request);
            }
            catch (err) {
                lastError = err;
                const msg = String(err?.message || '');
                const retryable = msg.includes('(429)') ||
                    msg.includes('(500)') ||
                    msg.includes('(502)') ||
                    msg.includes('(503)') ||
                    msg.includes('(504)') ||
                    err?.name === 'TimeoutError' ||
                    err?.name === 'AbortError';
                if (!retryable || attempt === 1) {
                    throw err;
                }
                await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            }
        }
        throw lastError;
    }
    async dispatchToProvider(provider, request) {
        const normalized = provider.toLowerCase();
        if (normalized === 'openai') {
            return this.openai.generateCompletion(request);
        }
        if (normalized === 'anthropic' || normalized === 'claude') {
            return this.anthropic.generateCompletion(request);
        }
        if (normalized === 'gemini' || normalized === 'google') {
            return this.gemini.generateCompletion(request);
        }
        if (COMPATIBLE_PROVIDERS.has(normalized)) {
            return this.compatible.generateForProvider(normalized, request);
        }
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
    async loadWorkspaceConfig(workspaceId) {
        if (!this.db)
            return {};
        try {
            const res = await this.db.query('SELECT ai_settings FROM public.workspaces WHERE id = $1 LIMIT 1', [workspaceId]);
            const settings = res?.rows?.[0]?.ai_settings;
            if (settings && typeof settings === 'object') {
                return settings;
            }
        }
        catch (err) {
            this.logger.warn(`Failed loading workspace AI config: ${err?.message}`);
        }
        return {};
    }
    buildCandidateChain(request, ws) {
        const chain = [];
        const seen = new Set();
        const push = (entry) => {
            const p = entry.provider?.trim().toLowerCase();
            if (!p || seen.has(`${p}:${entry.baseUrl || ''}`))
                return;
            seen.add(`${p}:${entry.baseUrl || ''}`);
            chain.push({ ...entry, provider: p });
        };
        if (request.provider) {
            push({
                provider: request.provider,
                model: request.model,
                apiKey: request.apiKey,
                baseUrl: request.baseUrl,
            });
        }
        if (ws.provider) {
            push({
                provider: ws.provider,
                model: ws.model,
                apiKey: ws.api_key,
                baseUrl: ws.base_url,
            });
        }
        if (ws.fallback_provider) {
            push({
                provider: ws.fallback_provider,
                model: ws.fallback_model,
            });
        }
        const envOrder = [
            ['openai', process.env.OPENAI_API_KEY],
            ['anthropic', process.env.ANTHROPIC_API_KEY],
            ['gemini', process.env.GEMINI_API_KEY],
            ['deepseek', process.env.DEEPSEEK_API_KEY],
            ['openrouter', process.env.OPENROUTER_API_KEY],
            ['groq', process.env.GROQ_API_KEY],
            ['together', process.env.TOGETHER_API_KEY],
            ['ollama', process.env.OLLAMA_BASE_URL],
            ['vllm', process.env.VLLM_BASE_URL],
            ['compatible', process.env.CUSTOM_LLM_BASE_URL],
        ];
        for (const [provider, present] of envOrder) {
            if (present && present.trim()) {
                push({ provider });
            }
        }
        return chain;
    }
};
exports.AiGatewayProvider = AiGatewayProvider;
exports.AiGatewayProvider = AiGatewayProvider = AiGatewayProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        openai_provider_1.OpenAiProvider,
        anthropic_provider_1.AnthropicProvider,
        gemini_provider_1.GeminiProvider,
        openai_compatible_provider_1.OpenAiCompatibleProvider,
        mock_fallback_provider_1.MockFallbackProvider,
        database_service_1.DatabaseService])
], AiGatewayProvider);
//# sourceMappingURL=ai-gateway.provider.js.map