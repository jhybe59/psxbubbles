-- Retention policies for additional aggregates (added after creation in 007)
DO $$
BEGIN
  IF to_regclass('minute_bars_4h') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' AND hypertable_name = 'minute_bars_4h'
  ) THEN
    PERFORM add_retention_policy('minute_bars_4h', INTERVAL '730 days');
  END IF;

  IF to_regclass('minute_bars_1w') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' AND hypertable_name = 'minute_bars_1w'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1w', INTERVAL '1460 days');
  END IF;

  IF to_regclass('minute_bars_1mo') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' AND hypertable_name = 'minute_bars_1mo'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1mo', INTERVAL '2920 days');
  END IF;

  IF to_regclass('minute_bars_1y') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' AND hypertable_name = 'minute_bars_1y'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1y', INTERVAL '3650 days');
  END IF;
END $$;
