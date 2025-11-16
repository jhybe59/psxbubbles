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
  // Prefer explicit TIMESCALE_* if provided
  const hasExplicit =
    env.TIMESCALE_HOST || env.TIMESCALE_PORT || env.TIMESCALE_DB || env.TIMESCALE_USER;

  if (hasExplicit) {
    const ssl =
      env.TIMESCALE_SSL != null
        ? ['1', 'true', 'yes', 'on'].includes(String(env.TIMESCALE_SSL).toLowerCase())
        : false;
    return {
      host: env.TIMESCALE_HOST || 'localhost',
      port: env.TIMESCALE_PORT ? Number(env.TIMESCALE_PORT) : 5432,
      database: env.TIMESCALE_DB || 'cryptobubbles',
      user: env.TIMESCALE_USER || 'postgres',
      password: env.TIMESCALE_PASSWORD || 'postgres',
      ssl
    };
  }

  if (env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(env.DATABASE_URL);
    if (parsed) {
      // Allow override via TIMESCALE_SSL if explicitly set
      if (env.TIMESCALE_SSL != null) {
        parsed.ssl = ['1', 'true', 'yes', 'on'].includes(String(env.TIMESCALE_SSL).toLowerCase());
      }
      return parsed;
    }
  }

  // Fallback to localhost defaults
  return {
    host: 'localhost',
    port: 5432,
    database: 'cryptobubbles',
    user: 'postgres',
    password: 'postgres',
    ssl: false
  };
};


