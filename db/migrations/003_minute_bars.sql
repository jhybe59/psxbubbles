-- Raw minute bars hypertable
CREATE TABLE IF NOT EXISTS minute_bars (
    symbol TEXT NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    open NUMERIC(18,6) NOT NULL,
    high NUMERIC(18,6) NOT NULL,
    low NUMERIC(18,6) NOT NULL,
    close NUMERIC(18,6) NOT NULL,
    volume NUMERIC(20,2) NOT NULL DEFAULT 0,
    value NUMERIC(22,2),
    daily_pct NUMERIC(10,4),
    raw JSONB,
    PRIMARY KEY (symbol, ts)
);

SELECT create_hypertable('minute_bars', 'ts', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS minute_bars_ts_idx ON minute_bars (ts DESC);
CREATE INDEX IF NOT EXISTS minute_bars_symbol_ts_idx ON minute_bars (symbol, ts DESC);

