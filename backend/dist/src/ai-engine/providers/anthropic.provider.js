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
var AnthropicProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AnthropicProvider = AnthropicProvider_1 = class AnthropicProvider {
    constructor(config) {
        this.config = config;
        this.providerName = 'anthropic';
        this.logger = new common_1.Logger(AnthropicProvider_1.name);
        this.apiKey = this.config.get('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    }
    async generateCompletion(request) {
        const apiKey = (request.apiKey || this.apiKey || '').trim();
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not configured.');
        }
        const model = request.model || 'claude-3-5-haiku-20241022';
        const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
        const conversationMessages = request.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: request.maxTokens ?? 512,
                system: systemMessage,
                messages: conversationMessages,
                temperature: request.temperature ?? 0.3,
            }),
            signal: AbortSignal.timeout(request.timeoutMs ?? 25000),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        const content = data.content?.[0]?.text || '';
        const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
        const promptTokens = usage.input_tokens || 0;
        const completionTokens = usage.output_tokens || 0;
        const cost = (promptTokens * 0.8 + completionTokens * 4.0) / 1000000;
        return {
            content,
            model,
            provider: this.providerName,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
            },
            estimatedCostUsd: Number(cost.toFixed(6)),
        };
    }
};
exports.AnthropicProvider = AnthropicProvider;
exports.AnthropicProvider = AnthropicProvider = AnthropicProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AnthropicProvider);
//# sourceMappingURL=anthropic.provider.js.map