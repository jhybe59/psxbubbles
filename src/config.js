// Feature flags / runtime config for client behavior
const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

// Railway production URLs - HARDCODED for reliability
const RAILWAY_API_URL = 'https://api-production-7e76.up.railway.app';
const RAILWAY_FRONTEND_HOST = 'psxbubbles.up.railway.app';

// Detect if running on Railway production
const isRailwayProduction = () => {
    if (typeof window !== 'undefined') {
        return window.location.hostname === RAILWAY_FRONTEND_HOST;
    }
    return false;
};

// Get API base URL (for REST calls)
const getApiBaseUrl = () => {
    // First check if env var is set (embedded at build time)
    if (env?.VITE_LIVE_API_BASE_URL) {
        return env.VITE_LIVE_API_BASE_URL;
    }

    // Runtime detection: if on Railway production
    if (isRailwayProduction()) {
        return RAILWAY_API_URL + '/api';
    }

    // Default fallback for local development (uses Vite proxy)
    return '/api';
};

// Get Socket URL (for WebSocket connections) - SEPARATE from API URL
const getSocketUrl = () => {
    // First check if env var is set
    if (env?.VITE_SOCKET_URL) {
        return env.VITE_SOCKET_URL;
    }

    // If LIVE_API_BASE_URL starts with http, extract base using URL constructor
    if (env?.VITE_LIVE_API_BASE_URL?.startsWith('http')) {
        try {
            const url = new URL(env.VITE_LIVE_API_BASE_URL);
            return url.origin;
        } catch (e) {
            console.warn('[config] Failed to parse VITE_LIVE_API_BASE_URL:', e);
        }
    }

    // Runtime detection: if on Railway production
    if (isRailwayProduction()) {
        return RAILWAY_API_URL;
    }

    // Local development
    if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
            return 'http://localhost:8080';
        }
        return origin;
    }

    return '';
};

export const ENABLE_REPO_SNAPSHOTS = env?.VITE_ENABLE_REPO_SNAPSHOTS === 'true';
export const ENABLE_LIVE_API = env?.VITE_ENABLE_LIVE_API === 'true';
export const LIVE_API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = getSocketUrl();
export const AUTO_REFRESH_MS = Number(env?.VITE_AUTO_REFRESH_MS || 60000);
export const LIVE_API_KEY = env?.VITE_LIVE_API_KEY || '';

// Debug log in production
if (typeof window !== 'undefined' && isRailwayProduction()) {
    console.log('[config] Railway Production Mode');
    console.log('[config] API URL:', LIVE_API_BASE_URL);
    console.log('[config] Socket URL:', SOCKET_URL);
}
