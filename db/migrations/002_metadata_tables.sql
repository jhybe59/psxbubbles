-- Instruments metadata (symbol master)
CREATE TABLE IF NOT EXISTS instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL UNIQUE,
    name TEXT,
    sector TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    extra JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indices (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS index_members (
    index_code TEXT REFERENCES indices(code) ON DELETE CASCADE,
    symbol TEXT REFERENCES instruments(symbol) ON DELETE CASCADE,
    PRIMARY KEY (index_code, symbol)
);

CREATE TABLE IF NOT EXISTS trading_calendar (
    trading_date DATE PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT
);

CREATE OR REPLACE FUNCTION touch_instrument()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instruments_touch ON instruments;
CREATE TRIGGER instruments_touch
BEFORE UPDATE ON instruments
FOR EACH ROW
EXECUTE PROCEDURE touch_instrument();

