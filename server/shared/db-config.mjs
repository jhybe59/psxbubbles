export const parseDatabaseUrl = (databaseUrl) => {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get('sslmode');
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname?.replace(/^\//, '') || '',
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      // Default to true on hosted providers when sslmode is require
      ssl: sslMode ? ['require', 'verify-ca', 'verify-full'].includes(sslMode) : true
    };
  } catch {
    return null;
  }
};

export const buildTimescaleConfigFromEnv = (env) => {
  // 1. Prefer DATABASE_URL first (Railway standard)
  if (env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(env.DATABASE_URL);
    if (parsed) {
      // Allow override via POSTGRES_SSL if explicitly set
      if ((env.POSTGRES_SSL ?? env.TIMESCALE_SSL) != null) {
        parsed.ssl = ['1', 'true', 'yes', 'on'].includes(String(env.POSTGRES_SSL ?? env.TIMESCALE_SSL).toLowerCase());
      }
      return parsed;
    }
  }

  // 2. Support both POSTGRES_* and legacy TIMESCALE_* env vars
  const hasExplicit =
    env.POSTGRES_HOST || env.POSTGRES_PORT || env.POSTGRES_DB || env.POSTGRES_USER ||
    env.TIMESCALE_HOST || env.TIMESCALE_PORT || env.TIMESCALE_DB || env.TIMESCALE_USER;

  if (hasExplicit) {
    const ssl =
      (env.POSTGRES_SSL ?? env.TIMESCALE_SSL) != null
        ? ['1', 'true', 'yes', 'on'].includes(String(env.POSTGRES_SSL ?? env.TIMESCALE_SSL).toLowerCase())
        : false;
    return {
      host: env.POSTGRES_HOST || env.TIMESCALE_HOST || 'localhost',
      port: Number(env.POSTGRES_PORT || env.TIMESCALE_PORT) || 5432,
      database: env.POSTGRES_DB || env.TIMESCALE_DB || 'cryptobubbles',
      user: env.POSTGRES_USER || env.TIMESCALE_USER || 'postgres',
      password: env.POSTGRES_PASSWORD || env.TIMESCALE_PASSWORD || 'postgres',
      ssl
    };
  }

  // 3. Fallback to localhost defaults
  return {
    host: 'localhost',
    port: 5432,
    database: 'cryptobubbles',
    user: 'postgres',
    password: 'postgres',
    ssl: false
  };
};


