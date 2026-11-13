declare const _default: () => {
    port: number;
    nodeEnv: string;
    corsOrigin: string;
    database: {
        url: string;
        ssl: boolean;
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
        url: string;
    };
    storage: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucketName: string;
        publicUrl: string;
    };
};
export default _default;
