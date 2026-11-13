export type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
export interface ParsedCorsAllowlist {
    allowAllInDev: boolean;
    exactOrigins: Set<string>;
    wildcardPatterns: Array<{
        protocol: string;
        baseHost: string;
    }>;
}
export declare function normalizeOriginEntry(raw: string): string | null;
export declare function parseCorsAllowlist(env?: Record<string, string | undefined>): ParsedCorsAllowlist;
export declare function isOriginAllowed(requestOrigin: string | undefined, allowlist: ParsedCorsAllowlist): boolean;
export declare function buildCorsOptions(env?: Record<string, string | undefined>): {
    allowlist: ParsedCorsAllowlist;
    origin: (origin: string | undefined, callback: CorsOriginCallback) => void;
    methods: string;
    allowedHeaders: string;
    credentials: boolean;
    optionsSuccessStatus: number;
};
