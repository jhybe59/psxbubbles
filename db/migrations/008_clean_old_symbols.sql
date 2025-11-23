-- Clean old symbols data and keep only configured 75 symbols
-- This migration removes all data for symbols not in the configured list

-- First, let's see what we're deleting (for reference)
-- DELETE FROM minute_bars WHERE symbol NOT IN (
--   'PIBTL', 'BECO', 'MLCF', 'LOTCHEM', 'KEL', 'TELE', 'PRL', 'CNERGY', 'GCIL', 'PAEL',
--   'BNL', 'TREET', 'PIOC', 'TPLP', 'BFAGRO', 'TOMCL', 'FCCL', 'OBOY', 'WASL', 'EPCL',
--   'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
--   'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL',
--   'CRTM', 'GWLC', 'HUBC', 'MEBL', 'OGDC', 'EMCO', 'FATIMA', 'IMAGE', 'SYS', 'CPHL',
--   'BGL', 'CTM', 'BIPL', 'AVN', 'JVDC', 'TRSM', 'MARI', 'NETSOL', 'YOUW', 'SYM',
--   'BFMOD', 'GHGL', 'OCTOPUS', 'BBFL', 'GAL', 'BIFO', 'GHNI', 'SAZEW', 'FLYNG', 'ISL',
--   'GGL', 'GGGL', 'GCIL', 'GCWL', 'IBLHL'
-- );

-- Actually delete the data
DELETE FROM minute_bars WHERE symbol NOT IN (
  'PIBTL', 'BECO', 'MLCF', 'LOTCHEM', 'KEL', 'TELE', 'PRL', 'CNERGY', 'GCIL', 'PAEL',
  'BNL', 'TREET', 'PIOC', 'TPLP', 'BFAGRO', 'TOMCL', 'FCCL', 'OBOY', 'WASL', 'EPCL',
  'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
  'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL',
  'CRTM', 'GWLC', 'HUBC', 'MEBL', 'OGDC', 'EMCO', 'FATIMA', 'IMAGE', 'SYS', 'CPHL',
  'BGL', 'CTM', 'BIPL', 'AVN', 'JVDC', 'TRSM', 'MARI', 'NETSOL', 'YOUW', 'SYM',
  'BFMOD', 'GHGL', 'OCTOPUS', 'BBFL', 'GAL', 'BIFO', 'GHNI', 'SAZEW', 'FLYNG', 'ISL',
  'GGL', 'GGGL', 'GCIL', 'GCWL', 'IBLHL'
);

-- Also clean instruments table (optional - keep if you want to preserve metadata)
-- DELETE FROM instruments WHERE symbol NOT IN (
--   'PIBTL', 'BECO', 'MLCF', 'LOTCHEM', 'KEL', 'TELE', 'PRL', 'CNERGY', 'GCIL', 'PAEL',
--   'BNL', 'TREET', 'PIOC', 'TPLP', 'BFAGRO', 'TOMCL', 'FCCL', 'OBOY', 'WASL', 'EPCL',
--   'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
--   'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL',
--   'CRTM', 'GWLC', 'HUBC', 'MEBL', 'OGDC', 'EMCO', 'FATIMA', 'IMAGE', 'SYS', 'CPHL',
--   'BGL', 'CTM', 'BIPL', 'AVN', 'JVDC', 'TRSM', 'MARI', 'NETSOL', 'YOUW', 'SYM',
--   'BFMOD', 'GHGL', 'OCTOPUS', 'BBFL', 'GAL', 'BIFO', 'GHNI', 'SAZEW', 'FLYNG', 'ISL',
--   'GGL', 'GGGL', 'GCIL', 'GCWL', 'IBLHL'
-- );

