"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MockFallbackProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockFallbackProvider = void 0;
const common_1 = require("@nestjs/common");
let MockFallbackProvider = MockFallbackProvider_1 = class MockFallbackProvider {
    constructor() {
        this.providerName = 'mock-fallback';
        this.logger = new common_1.Logger(MockFallbackProvider_1.name);
    }
    async generateCompletion(request) {
        const userPrompt = request.messages[request.messages.length - 1]?.content || '';
        this.logger.log(`[Mock LLM] Responding to prompt: "${userPrompt.slice(0, 50)}..."`);
        let content = 'Thank you for reaching out! Our team is reviewing your question and will assist you shortly.';
        if (userPrompt.toLowerCase().includes('hours') || userPrompt.toLowerCase().includes('time')) {
            content = 'Our support team is available Monday through Friday from 9am to 6pm UTC.';
        }
        else if (userPrompt.toLowerCase().includes('refund') || userPrompt.toLowerCase().includes('billing')) {
            content = 'For billing inquiries and refunds, please provide your invoice number and our billing department will review it within 24 hours.';
        }
        const promptTokens = Math.ceil(userPrompt.length / 4);
        const completionTokens = Math.ceil(content.length / 4);
        return {
            content,
            model: request.model || 'mock-gpt-4o',
            provider: this.providerName,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
            },
            estimatedCostUsd: 0.00001,
        };
    }
    async generateEmbeddings(texts) {
        return texts.map(() => Array.from({ length: 768 }, () => (Math.random() - 0.5) / 10));
    }
};
exports.MockFallbackProvider = MockFallbackProvider;
exports.MockFallbackProvider = MockFallbackProvider = MockFallbackProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MockFallbackProvider);
//# sourceMappingURL=mock-fallback.provider.js.map