"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOriginEntry = normalizeOriginEntry;
exports.parseCorsAllowlist = parseCorsAllowlist;
exports.isOriginAllowed = isOriginAllowed;
exports.buildCorsOptions = buildCorsOptions;
const DEFAULT_CORS_HEADERS = [
    'Content-Type',
    'Authorization',
    'X-Workspace-Id',
    'X-Requested-With',
    'x-zentry-visitor',
    'x-zentry-visitor-token',
].join(', ');
function normalizeOriginEntry(raw) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed || trimmed === '*')
        return null;
    if (trimmed.includes('://*.')) {
        const [protocolPart, rest] = trimmed.split('://');
        const hostPart = (rest || '').split('/')[0].toLowerCase();
        if (!protocolPart || !hostPart.startsWith('*.'))
            return null;
        return `${protocolPart.toLowerCase()}://${hostPart}`;
    }
    const withProtocol = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1')
            ? `http://${trimmed}`
            : `https://${trimmed}`;
    try {
        const url = new URL(withProtocol);
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return null;
        return `${url.protocol}//${url.host}`.toLowerCase();
    }
    catch {
        return null;
    }
}
function parseCorsAllowlist(env = process.env) {
    const rawCors = (env.CORS_ORIGIN || '').trim();
    const nodeEnv = env.NODE_ENV || 'development';
    const exactOrigins = new Set();
    const wildcardPatterns = [];
    const candidateValues = [];
    if (rawCors) {
        for (const part of rawCors.split(',')) {
            if (part.trim())
                candidateValues.push(part.trim());
        }
    }
    for (const extraKey of [
        'FRONTEND_URL',
        'NEXT_PUBLIC_APP_URL',
        'VERCEL_URL',
        'VERCEL_BRANCH_URL',
        'VERCEL_PROJECT_PRODUCTION_URL',
    ]) {
        const val = (env[extraKey] || '').trim();
        if (val)
            candidateValues.push(val);
    }
    for (const item of candidateValues) {
        const normalized = normalizeOriginEntry(item);
        if (!normalized)
            continue;
        if (normalized.includes('://*.')) {
            const [protocol, host] = normalized.split('://');
            const baseHost = host.slice(2);
            if (baseHost && !baseHost.includes('*')) {
                wildcardPatterns.push({ protocol: `${protocol}:`, baseHost });
            }
        }
        else {
            exactOrigins.add(normalized);
        }
    }
    const allowAllInDev = nodeEnv !== 'production' && (rawCors === '' || rawCors.split(',').some((p) => p.trim() === '*'));
    return {
        allowAllInDev,
        exactOrigins,
        wildcardPatterns,
    };
}
function isOriginAllowed(requestOrigin, allowlist) {
    if (!requestOrigin)
        return true;
    if (allowlist.allowAllInDev)
        return true;
    const normalizedIncoming = normalizeOriginEntry(requestOrigin);
    if (!normalizedIncoming || normalizedIncoming.includes('://*.')) {
        return false;
    }
    if (allowlist.exactOrigins.has(normalizedIncoming)) {
        return true;
    }
    try {
        const url = new URL(normalizedIncoming);
        const hostname = url.hostname.toLowerCase();
        for (const pattern of allowlist.wildcardPatterns) {
            if (url.protocol !== pattern.protocol)
                continue;
            if (hostname.endsWith(`.${pattern.baseHost}`) && hostname.length > pattern.baseHost.length + 1) {
                return true;
            }
        }
    }
    catch {
        return false;
    }
    return false;
}
function buildCorsOptions(env = process.env) {
    const allowlist = parseCorsAllowlist(env);
    return {
        allowlist,
        origin: (origin, callback) => {
            callback(null, isOriginAllowed(origin, allowlist));
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: DEFAULT_CORS_HEADERS,
        credentials: true,
        optionsSuccessStatus: 204,
    };
}
//# sourceMappingURL=cors.js.map