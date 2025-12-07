-- Continuous aggregates are now handled by QuestDB SAMPLE BY
-- This migration is no longer needed and does nothing

-- QuestDB provides on-the-fly aggregation with SAMPLE BY clause:
-- SELECT ... FROM minute_bars SAMPLE BY 5m
-- SELECT ... FROM minute_bars SAMPLE BY 1h
-- etc.

