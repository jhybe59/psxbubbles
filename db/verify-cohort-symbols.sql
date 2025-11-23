-- Verify all 20 cohort symbols exist in instruments table
-- Shows symbol and active status

SELECT 
  symbol,
  name,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM instruments
WHERE symbol IN (
  'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 
  'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
  'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY',
  'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL'
)
ORDER BY symbol;

-- Summary: Count existing vs expected
SELECT 
  COUNT(*) as total_found,
  20 as expected,
  COUNT(CASE WHEN active THEN 1 END) as active_count,
  COUNT(CASE WHEN NOT active THEN 1 END) as inactive_count,
  CASE 
    WHEN COUNT(*) = 20 AND COUNT(CASE WHEN NOT active THEN 1 END) = 0 
    THEN '✅ All symbols present and active'
    WHEN COUNT(*) = 20 
    THEN '⚠️ All symbols present but some inactive'
    ELSE '❌ Missing symbols'
  END as status
FROM instruments
WHERE symbol IN (
  'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 
  'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
  'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY',
  'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL'
);

