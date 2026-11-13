declare const _default: () => {
    port: number;
    nodeEnv: string;
    isVercel: boolean;
    corsOrigin: string;
    frontendUrl: string | undefined;
    database: {
        url: string | undefined;
        ssl: boolean;
        sslRejectUnauthorized: boolean;
        maxPoolSize: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshSecret: string;
        refreshExpiresIn: string;
    };
    google: {
        clientId: string;
        clientSecret: string;
        callbackUrl: string;
    };
    redis: {
        url: string | undefined;
    };
    storage: {
        accountId: string | undefined;
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
        bucketName: string;
        publicUrl: string | undefined;
    };
};
export default _default;
