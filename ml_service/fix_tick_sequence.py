
import requests
import urllib.parse
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
        if 'response' in locals() and response:
             print(response.text)
        return None

def fix_tick_sequences():
    # 1. Identify affected symbols (those with tick_seq=1 after 10 AM today)
    # The user mentioned the issue happened today (2026-02-12)
    # Timestamps in QuestDB are usually handled in UTC or specific timezone. 
    # The user said "10 AM today". Let's assume the reset starts around there.
    # We'll look for any tick_seq=1 after 9:30 AM to be safe.
    
    reset_start_time = "2026-02-12T09:30:00.000000Z" # Adjust if needed
    
    # Get symbols that have a reset
    # DISTINCT symbol involves a scan, so we might just check known symbols or scan recent data
    scan_query = f"SELECT DISTINCT symbol FROM trades WHERE timestamp > '{reset_start_time}' AND tick_seq = 1"
    print(f"Scanning for affected symbols since {reset_start_time}...")
    
    result = run_query(scan_query)
    if not result or 'dataset' not in result:
        print("No affected symbols found or query failed.")
        return

    affected_symbols = [row[0] for row in result['dataset']]
    print(f"Found {len(affected_symbols)} affected symbols: {affected_symbols}")
    
    for symbol in affected_symbols:
        print(f"\nProcessing {symbol}...")
        
        # 2. Find max sequence before the reset
        # We look for the last tick before the reset time (or just the overall max before the reset block)
        # To be precise: find the max tick_seq where timestamp < (timestamp of first tick_seq=1 after reset_start_time)
        # But simpler: max tick_seq before reset_start_time shoud work if the gap was clean.
        
        # Let's find the specific timestamp where it reset for this symbol to be precise
        first_reset_query = f"SELECT min(timestamp) FROM trades WHERE symbol = '{symbol}' AND timestamp > '{reset_start_time}' AND tick_seq = 1"
        res = run_query(first_reset_query)
        if not res or not res['dataset'] or not res['dataset'][0][0]:
            print(f"Skipping {symbol}: Could not find reset timestamp.")
            continue
            
        first_reset_ts = res['dataset'][0][0]
        print(f"  Reset detected at: {first_reset_ts}")
        
        # Get max sequence before this timestamp
        last_seq_query = f"SELECT max(tick_seq) FROM trades WHERE symbol = '{symbol}' AND timestamp < '{first_reset_ts}'"
        res = run_query(last_seq_query)
        
        offset = 0
        if res and res['dataset'] and res['dataset'][0][0]:
             offset = res['dataset'][0][0]
        
        print(f"  Last valid sequence: {offset}")
        
        if offset == 0:
            print("  No previous sequence found or offset is 0. Skipping.")
            continue
            
        # 3. Update the sequence
        # UPDATE trades SET tick_seq = tick_seq + offset WHERE symbol = 'SYMBOL' AND timestamp >= 'RESET_TS'
        update_query = f"UPDATE trades SET tick_seq = tick_seq + {offset} WHERE symbol = '{symbol}' AND timestamp >= '{first_reset_ts}'"
        print(f"  Allocating update: {update_query}")
        
        # QuestDB REST API might not support UPDATE directly in /exec for older versions, but let's try.
        # It usually supports it.
        update_res = run_query(update_query)
        
        if update_res:
             print("  Update executed successfully.")
             # Verify
             verify_query = f"SELECT min(tick_seq), max(tick_seq) FROM trades WHERE symbol = '{symbol}' AND timestamp >= '{first_reset_ts}'"
             v_res = run_query(verify_query)
             if v_res and v_res['dataset']:
                 print(f"  New range after reset: {v_res['dataset'][0]}")
        else:
             print("  Update failed.")

if __name__ == "__main__":
    fix_tick_sequences()
