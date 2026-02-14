"""
Populate minute_bars from trades data in QuestDB.
Aggregates 9M+ ticks into 1-minute OHLCV bars.
"""
import requests
import time

QUESTDB_URL = "http://questdb:9000/exec"

def main():
    print("=== Populating minute_bars from trades data ===")
    print("This will aggregate 9.1M ticks into 1-minute OHLCV bars...")

    # QuestDB INSERT ... SELECT with SAMPLE BY for minute aggregation
    sql = """
    INSERT INTO minute_bars (symbol, open, high, low, close, volume, value, daily_pct, trades, timestamp)
    SELECT 
        symbol,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume,
        sum(value) as value,
        last(daily_pct) as daily_pct,
        count() as trades,
        timestamp
    FROM trades
    WHERE price > 0
    SAMPLE BY 1m FILL(PREV)
    """

    start = time.time()
    r = requests.get(QUESTDB_URL, params={"query": sql}, timeout=600)
    elapsed = time.time() - start

    result = r.json()
    if "error" in result:
        err = result["error"]
        print(f"ERROR: {err}")
        
        # If table issue, try without FILL
        print("Trying without FILL(PREV)...")
        sql2 = """
        INSERT INTO minute_bars (symbol, open, high, low, close, volume, value, daily_pct, trades, timestamp)
        SELECT 
            symbol,
            first(price) as open,
            max(price) as high,
            min(price) as low,
            last(price) as close,
            sum(volume) as volume,
            sum(value) as value,
            last(daily_pct) as daily_pct,
            count() as trades,
            timestamp
        FROM trades
        WHERE price > 0
        SAMPLE BY 1m
        """
        r = requests.get(QUESTDB_URL, params={"query": sql2}, timeout=600)
        elapsed = time.time() - start
        result = r.json()
        if "error" in result:
            err2 = result["error"]
            print(f"ERROR 2: {err2}")
            return
        print(f"Aggregation completed (no FILL) in {elapsed:.1f}s")
    else:
        print(f"Aggregation completed in {elapsed:.1f}s")

    # Check count
    r2 = requests.get(QUESTDB_URL, params={"query": "SELECT count() FROM minute_bars"})
    count = r2.json()["dataset"][0][0]
    print(f"Minute bars created: {count:,}")

    # Check symbols
    r3 = requests.get(QUESTDB_URL, params={"query": "SELECT count_distinct(symbol) FROM minute_bars"})
    symbols = r3.json()["dataset"][0][0]
    print(f"Symbols: {symbols}")
    
    # Show sample
    r4 = requests.get(QUESTDB_URL, params={"query": "SELECT * FROM minute_bars LIMIT 5"})
    data = r4.json()
    cols = [c["name"] for c in data["columns"]]
    print(f"\nSample data ({', '.join(cols)}):")
    for row in data["dataset"]:
        print(row)

    print("\n=== Done ===")

if __name__ == "__main__":
    main()
