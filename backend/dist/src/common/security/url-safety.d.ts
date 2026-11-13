export declare function isPrivateIpAddress(ip: string): boolean;
export declare function resolveAndVerifyPublicHttpsUrl(rawUrl: string, options?: {
    allowHttpInDev?: boolean;
}): Promise<URL>;
export declare function validateProviderBaseUrl(rawBaseUrl: string): Promise<string>;
