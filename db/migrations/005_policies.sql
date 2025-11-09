-- Retention and compression policies
SELECT add_retention_policy('minute_bars', INTERVAL '90 days', cascade => TRUE);

ALTER TABLE minute_bars SET (timescaledb.compress);
SELECT add_compression_policy('minute_bars', INTERVAL '7 days');

SELECT add_retention_policy('minute_bars_5m', INTERVAL '365 days', cascade => TRUE);
SELECT add_retention_policy('minute_bars_15m', INTERVAL '365 days', cascade => TRUE);
SELECT add_retention_policy('minute_bars_1h', INTERVAL '730 days', cascade => TRUE);
SELECT add_retention_policy('minute_bars_1d', INTERVAL '1460 days', cascade => TRUE);

