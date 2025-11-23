-- Retention and compression policies
-- Only add if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars'
  ) THEN
    PERFORM add_retention_policy('minute_bars', INTERVAL '90 days');
  END IF;
END $$;

ALTER TABLE minute_bars SET (timescaledb.compress);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_compression' 
    AND hypertable_name = 'minute_bars'
  ) THEN
    PERFORM add_compression_policy('minute_bars', INTERVAL '7 days');
  END IF;
END $$;

-- Retention policies for continuous aggregates (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_5m'
  ) THEN
    PERFORM add_retention_policy('minute_bars_5m', INTERVAL '365 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_15m'
  ) THEN
    PERFORM add_retention_policy('minute_bars_15m', INTERVAL '365 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_1h'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1h', INTERVAL '730 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_1d'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1d', INTERVAL '1460 days');
  END IF;
  
  -- Additional aggregates retention policies
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_4h'
  ) THEN
    PERFORM add_retention_policy('minute_bars_4h', INTERVAL '730 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_1w'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1w', INTERVAL '1460 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_1mo'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1mo', INTERVAL '2920 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_retention' 
    AND hypertable_name = 'minute_bars_1y'
  ) THEN
    PERFORM add_retention_policy('minute_bars_1y', INTERVAL '3650 days');
  END IF;
END $$;

