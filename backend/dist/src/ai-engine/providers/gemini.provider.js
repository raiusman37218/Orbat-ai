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
var GeminiProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GeminiProvider = GeminiProvider_1 = class GeminiProvider {
    constructor(config) {
        this.config = config;
        this.providerName = 'gemini';
        this.logger = new common_1.Logger(GeminiProvider_1.name);
        this.apiKey = this.config.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    }
    async generateCompletion(request) {
        const key = (request.apiKey || this.apiKey || '').trim();
        if (!key) {
            throw new Error('GEMINI_API_KEY is not configured.');
        }
        const model = request.model || 'gemini-2.5-flash';
        const systemInstruction = request.messages.find((m) => m.role === 'system')?.content;
        const contents = request.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': key,
            },
            body: JSON.stringify({
                ...(systemInstruction
                    ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
                    : {}),
                contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: '' }] }],
                generationConfig: {
                    temperature: request.temperature ?? 0.3,
                    maxOutputTokens: request.maxTokens ?? 512,
                },
            }),
            signal: AbortSignal.timeout(request.timeoutMs ?? 25000),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
        }
        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts
            ?.map((p) => p?.text || '')
            .join('') || '';
        const meta = data?.usageMetadata || {};
        const promptTokens = Number(meta.promptTokenCount || 0);
        const completionTokens = Number(meta.candidatesTokenCount || 0);
        const cost = (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000;
        return {
            content,
            model,
            provider: this.providerName,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: Number(meta.totalTokenCount || promptTokens + completionTokens),
            },
            estimatedCostUsd: Number(cost.toFixed(6)),
        };
    }
    async generateEmbeddings(texts, apiKeyOverride) {
        const key = (apiKeyOverride || this.apiKey || '').trim();
        if (!key) {
            throw new Error('GEMINI_API_KEY is not configured for embeddings.');
        }
        const results = [];
        for (const text of texts) {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': key,
                },
                body: JSON.stringify({
                    model: 'models/gemini-embedding-001',
                    content: { parts: [{ text }] },
                    outputDimensionality: 768,
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`Gemini embedding error (${response.status}): ${errText.slice(0, 300)}`);
            }
            const data = await response.json();
            const values = data?.embedding?.values;
            if (!Array.isArray(values) || values.length === 0) {
                throw new Error('Gemini returned empty embedding vector');
            }
            results.push(values);
        }
        return results;
    }
};
exports.GeminiProvider = GeminiProvider;
exports.GeminiProvider = GeminiProvider = GeminiProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiProvider);
//# sourceMappingURL=gemini.provider.js.map