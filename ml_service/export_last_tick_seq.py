
import requests
import csv
import sys
from datetime import datetime

QUESTDB_EXEC_URL = "http://localhost:9000/exec"

def run_query(query):
    try:
        response = requests.get(QUESTDB_EXEC_URL, params={"query": query})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Query failed: {query}")
        print(f"Error: {e}")
        return None

def export_last_ticks():
    # Debug: Check DB time range
    print("Checking DB Time Range...")
    time_query = "SELECT min(timestamp), max(timestamp), count() FROM trades"
    time_res = run_query(time_query)
    print(f"DB Time Range & Count: {time_res['dataset'] if time_res else 'Error'}")

    filtered_count_query = "SELECT count() FROM trades WHERE timestamp > '2026-02-12T09:30:00.000000Z'"
    filtered_res = run_query(filtered_count_query)
    print(f"Filtered Count (> 09:30): {filtered_res['dataset'] if filtered_res else 'Error'}")
    
    # 1. Identify relevant symbols
    # Since we undid the fix, there might not be tick_seq=1 entries anymore if they were reverted? 
    # Or actually, reverting means they are back to 1... but wait.
    # If I reverted, then `tick_seq` IS 1 (again). 
    # Why did it find 0 symbols?
    # Ah, maybe because I subtracted the offset, so they ARE 1.
    # But maybe the query `tick_seq = 1` failed? 
    # Let's just get ALL symbols active today.
    scan_query = "SELECT DISTINCT symbol FROM trades WHERE timestamp > '2026-02-12T09:30:00.000000Z'"
    res = run_query(scan_query)
    print(f"Debug: res keys: {res.keys() if res else 'None'}")
    if res and 'dataset' in res:
         print(f"Debug: dataset length: {len(res['dataset'])}")
    else:
         print(f"Debug: Full response: {res}")

    if not res or 'dataset' not in res:
        print("Could not fetch symbols.")
        return
        
    symbols = [r[0] for r in res['dataset']]
    print(f"Found {len(symbols)} symbols. Fetching latest tick_seq for each...")
    
    results = []
    
    for i, symbol in enumerate(symbols):
        # 2. Get latest tick_seq by timestamp
        # latest query
        query = f"SELECT tick_seq, timestamp FROM trades WHERE symbol = '{symbol}' ORDER BY timestamp DESC LIMIT 1"
        r = run_query(query)
        
        if r and r['dataset']:
            last_seq = r['dataset'][0][0]
            last_ts = r['dataset'][0][1]
            results.append([symbol, last_seq, last_ts])
        else:
            print(f"Warning: No data for {symbol}")
            
        if (i + 1) % 10 == 0:
            print(f"Processed {i + 1}/{len(symbols)}...")
            
    # 3. Save to CSV
    filename = "g:/PSXBUBBLES/psxbubbles-main/psxbubbles-main/ml_service/latest_tick_sequences.csv"
    print(f"Saving to {filename}...")
    
    try:
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["symbol", "last_tick_seq", "last_timestamp"])
            writer.writerows(results)
        print("Done.")
    except Exception as e:
        print(f"Failed to write CSV: {e}")

if __name__ == "__main__":
    export_last_ticks()
