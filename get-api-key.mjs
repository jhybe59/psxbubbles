
import { config } from './server/api/config.mjs';
console.log('API_KEY=' + (config.apiKeys.primary || ''));
