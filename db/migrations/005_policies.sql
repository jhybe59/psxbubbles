-- Retention policies are now handled by QuestDB
-- This migration is no longer needed and does nothing

-- QuestDB has built-in data retention via ALTER TABLE ... SET (maxUncommittedRows = ...)
-- Or you can use scheduled tasks to DROP PARTITION

