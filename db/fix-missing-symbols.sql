-- Insert missing symbols into instruments table
-- If symbol already exists, update active=true

INSERT INTO instruments (symbol, name, active)
VALUES 
  ('QUICE', 'QUICE', true),
  ('SSGC', 'SSGC', true),
  ('POWER', 'POWER', true),
  ('FFL', 'FFL', true),
  ('SLGL', 'SLGL', true),
  ('CEPB', 'CEPB', true),
  ('DCL', 'DCL', true),
  ('UNITY', 'UNITY', true),
  ('ASL', 'ASL', true),
  ('MUGHAL', 'MUGHAL', true),
  ('FCL', 'FCL', true),
  ('TGL', 'TGL', true),
  ('MACFL', 'MACFL', true)
ON CONFLICT (symbol) 
DO UPDATE SET 
  active = true,
  updated_at = NOW();

