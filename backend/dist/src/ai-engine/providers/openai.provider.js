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
var OpenAiProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OpenAiProvider = OpenAiProvider_1 = class OpenAiProvider {
    constructor(config) {
        this.config = config;
        this.providerName = 'openai';
        this.logger = new common_1.Logger(OpenAiProvider_1.name);
        this.apiKey = this.config.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    }
    async generateCompletion(request) {
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured.');
        }
        const model = request.model || 'gpt-4o-mini';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: request.messages,
                temperature: request.temperature ?? 0.3,
                max_tokens: request.maxTokens ?? 512,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        const usage = data.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        };
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const cost = (promptTokens * 0.15 + completionTokens * 0.6) / 1000000;
        return {
            content,
            model,
            provider: this.providerName,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: usage.total_tokens || promptTokens + completionTokens,
            },
            estimatedCostUsd: Number(cost.toFixed(6)),
        };
    }
    async generateEmbeddings(texts) {
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured.');
        }
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: texts,
            }),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI embedding error (${response.status}): ${err}`);
        }
        const data = await response.json();
        return data.data.map((item) => item.embedding);
    }
};
exports.OpenAiProvider = OpenAiProvider;
exports.OpenAiProvider = OpenAiProvider = OpenAiProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiProvider);
//# sourceMappingURL=openai.provider.js.map