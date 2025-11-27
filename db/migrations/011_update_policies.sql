-- Update continuous aggregate policies for faster refresh rates

-- 5 minute bars: refresh every minute (was 1 minute) - keep same but ensure offset is tight
SELECT remove_continuous_aggregate_policy('minute_bars_5m', if_exists => TRUE);
SELECT add_continuous_aggregate_policy('minute_bars_5m',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE);

-- 15 minute bars: refresh every minute (was 5 minutes)
SELECT remove_continuous_aggregate_policy('minute_bars_15m', if_exists => TRUE);
SELECT add_continuous_aggregate_policy('minute_bars_15m',
  start_offset => INTERVAL '6 hours',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE);

-- 1 hour bars: refresh every 5 minutes (was 15 minutes)
SELECT remove_continuous_aggregate_policy('minute_bars_1h', if_exists => TRUE);
SELECT add_continuous_aggregate_policy('minute_bars_1h',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);

-- 1 day bars: refresh every 5 minutes (was 1 hour)
SELECT remove_continuous_aggregate_policy('minute_bars_1d', if_exists => TRUE);
SELECT add_continuous_aggregate_policy('minute_bars_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);
