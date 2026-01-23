// Feature flags / runtime config for client behavior
const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

// Production fallback: detect Railway deployment and use correct API URL
// This ensures socket connections work even if VITE_* env vars aren't embedded at build time
const getApiBaseUrl = () => {
    // First check if env var is set (embedded at build time)
    if (env?.VITE_LIVE_API_BASE_URL) {
        return env.VITE_LIVE_API_BASE_URL;
    }

    // Runtime detection: if on Railway production frontend, use the API service URL
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Detect Railway production deployment
        if (hostname === 'psxbubbles.up.railway.app') {
            return 'https://api-production-7e76.up.railway.app/api';
        }
    }

    // Default fallback for local development (uses Vite proxy)
    return '/api';
};

export const ENABLE_REPO_SNAPSHOTS = env?.VITE_ENABLE_REPO_SNAPSHOTS === 'true';
export const ENABLE_LIVE_API = env?.VITE_ENABLE_LIVE_API === 'true';
export const LIVE_API_BASE_URL = getApiBaseUrl();
export const AUTO_REFRESH_MS = Number(env?.VITE_AUTO_REFRESH_MS || 60000);
export const LIVE_API_KEY = env?.VITE_LIVE_API_KEY || '';
