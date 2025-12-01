export const config = {
    apiBaseUrl: process.env.API_BASE_URL ?? 'https://api-externa.com',
    apiTimeout: parseInt(process.env.API_TIMEOUT ?? '5000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY ?? '1000', 10)
};
