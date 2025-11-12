-- Helper indexes on continuous aggregates to accelerate bucket lookups
CREATE INDEX IF NOT EXISTS idx_minute_bars_5m_bucket_symbol
  ON minute_bars_5m (bucket DESC, symbol);

CREATE INDEX IF NOT EXISTS idx_minute_bars_1d_bucket_symbol
  ON minute_bars_1d (bucket DESC, symbol);

-- Sector rollups derived from 5-minute aggregates
CREATE OR REPLACE VIEW sector_performance_5m AS
SELECT
  mb.bucket,
  COALESCE(inst.sector, 'Unknown') AS sector,
  COUNT(*) AS symbols,
  SUM(CASE WHEN mb.pct_change > 0 THEN 1 ELSE 0 END) AS advancers,
  SUM(CASE WHEN mb.pct_change < 0 THEN 1 ELSE 0 END) AS decliners,
  SUM(CASE WHEN mb.pct_change = 0 THEN 1 ELSE 0 END) AS unchanged,
  AVG(mb.pct_change) AS pct_change,
  SUM(mb.volume_sum) AS volume_sum,
  SUM(mb.turnover_sum) AS turnover_sum
FROM minute_bars_5m mb
LEFT JOIN instruments inst ON inst.symbol = mb.symbol
GROUP BY mb.bucket, sector;

-- Daily sector rollups for end-of-day analytics
CREATE OR REPLACE VIEW sector_performance_1d AS
SELECT
  mb.bucket,
  COALESCE(inst.sector, 'Unknown') AS sector,
  COUNT(*) AS symbols,
  SUM(CASE WHEN mb.pct_change > 0 THEN 1 ELSE 0 END) AS advancers,
  SUM(CASE WHEN mb.pct_change < 0 THEN 1 ELSE 0 END) AS decliners,
  SUM(CASE WHEN mb.pct_change = 0 THEN 1 ELSE 0 END) AS unchanged,
  AVG(mb.pct_change) AS pct_change,
  SUM(mb.volume_sum) AS volume_sum,
  SUM(mb.turnover_sum) AS turnover_sum
FROM minute_bars_1d mb
LEFT JOIN instruments inst ON inst.symbol = mb.symbol
GROUP BY mb.bucket, sector;

-- Index rollups leveraging index membership metadata
CREATE OR REPLACE VIEW index_performance_5m AS
SELECT
  mb.bucket,
  im.index_code,
  COUNT(*) AS members,
  AVG(mb.pct_change) AS pct_change,
  SUM(mb.volume_sum) AS volume_sum,
  SUM(mb.turnover_sum) AS turnover_sum
FROM minute_bars_5m mb
JOIN index_members im ON im.symbol = mb.symbol
GROUP BY mb.bucket, im.index_code;

CREATE OR REPLACE VIEW index_performance_1d AS
SELECT
  mb.bucket,
  im.index_code,
  COUNT(*) AS members,
  AVG(mb.pct_change) AS pct_change,
  SUM(mb.volume_sum) AS volume_sum,
  SUM(mb.turnover_sum) AS turnover_sum
FROM minute_bars_1d mb
JOIN index_members im ON im.symbol = mb.symbol
GROUP BY mb.bucket, im.index_code;

-- Latest snapshot helpers
CREATE OR REPLACE VIEW sector_performance_latest AS
SELECT DISTINCT ON (sector)
  sector,
  bucket,
  bucket AS as_of,
  symbols,
  advancers,
  decliners,
  unchanged,
  pct_change,
  volume_sum,
  turnover_sum
FROM sector_performance_5m
ORDER BY sector, bucket DESC;

CREATE OR REPLACE VIEW index_performance_latest AS
SELECT DISTINCT ON (index_code)
  index_code,
  bucket,
  bucket AS as_of,
  members,
  pct_change,
  volume_sum,
  turnover_sum
FROM index_performance_5m
ORDER BY index_code, bucket DESC;


