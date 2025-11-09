// Feature flags / runtime config for client behavior
const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

export const ENABLE_REPO_SNAPSHOTS = env?.VITE_ENABLE_REPO_SNAPSHOTS === 'true';
export const ENABLE_LIVE_API = env?.VITE_ENABLE_LIVE_API === 'true';
export const LIVE_API_BASE_URL = env?.VITE_LIVE_API_BASE_URL || '/api';
export const AUTO_REFRESH_MS = Number(env?.VITE_AUTO_REFRESH_MS || 60000);
export const LIVE_API_KEY = env?.VITE_LIVE_API_KEY || '';
