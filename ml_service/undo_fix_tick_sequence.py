
import requests
import json
from datetime import datetime, timedelta

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

def undo_fix_tick_sequences():
    print("Starting undo process...")
    
    # 1. Get List of Symbols
    # We can scan for symbols that likely have high tick_seqs in the afternoon
    # Or just iterate over all symbols found in the recent trades
    scan_query = "SELECT DISTINCT symbol FROM trades WHERE timestamp > '2026-02-12T09:30:00.000000Z'"
    res = run_query(scan_query)
    if not res or 'dataset' not in res:
        print("Could not fetch symbols.")
        return
        
    symbols = [r[0] for r in res['dataset']]
    print(f"Checking {len(symbols)} symbols...")
    
    for symbol in symbols:
        # 2. Find the "Cut Point"
        # We need to find where the sequence was stitched.
        # Hypothesis: There is a time gap > X minutes, or we can look for the start of the 'new' data.
        # Since I stitched it, the sequence is now N, N+1.
        # But if we assume the "new" data started with tick_seq=1, and I added Offset O.
        # Then tick_seq is now 1+O.
        # And the previous row was O.
        # So tick_seq is continuous.
        
        # We look for a TIME GAP.
        # Fetch key columns for today
        # We limit to rows around the potential gap.
        
        data_query = f"SELECT timestamp, tick_seq FROM trades WHERE symbol = '{symbol}' AND timestamp > '2026-02-12T09:00:00.000000Z' ORDER BY timestamp ASC"
        data_res = run_query(data_query)
        
        if not data_res or 'dataset' not in data_res:
            continue
            
        rows = data_res['dataset']
        # rows is list of [timestamp_str, tick_seq]
        
        if len(rows) < 2:
            continue
            
        # Find the gap
        max_gap = timedelta(0)
        gap_idx = -1
        
        for i in range(1, len(rows)):
            t1 = datetime.fromisoformat(rows[i-1][0].replace('Z', '+00:00'))
            t2 = datetime.fromisoformat(rows[i][0].replace('Z', '+00:00'))
            
            delta = t2 - t1
            # Ignore overnight gaps (if gap is massive, like > 8 hours)
            if delta > timedelta(hours=8):
                continue

            if delta > timedelta(minutes=5) and delta > max_gap:
                max_gap = delta
                gap_idx = i
        
        if gap_idx != -1 and max_gap > timedelta(minutes=5):
            # We found a significant gap (>10 mins)
            # Likely the cut point is at gap_idx (the first record of the NEW batch)
            
            cut_row = rows[gap_idx]
            cut_ts = cut_row[0]
            current_seq = cut_row[1]
            
            prev_row = rows[gap_idx-1]
            prev_seq = prev_row[1]
            
            # Check if current_seq looks like it was fixed (i.e., it's roughly prev_seq + 1)
            # If it was NOT fixed (original), then current_seq would be 1.
            # If it WAS fixed, current_seq ~= prev_seq + 1.
            
            diff = current_seq - prev_seq
            
            # The fix used global max, creating a large jump if local history was smaller.
            # So a large positive diff indicates a fixed segment (where we added a huge offset).
            # A small diff (1) means we added a local offset (ideal fix).
            # A negative diff (reset) means we didn't touch it.
            
            if diff > 1000: 
                 # Found a large jump after a gap. This is the segment we fixed with global max.
                 # We want to revert it to start at 1.
                 offset_to_remove = current_seq - 1
                 
                 print(f"Symbol: {symbol}")
                 print(f"  Gap Found: {max_gap} at {cut_ts}")
                 print(f"  Prev: {prev_seq}, Current: {current_seq}, Diff: {diff}")
                 print(f"  Calculated Offset to Remove: {offset_to_remove}")
                 
                 if offset_to_remove > 0:
                     # Execute Update
                     update_query = f"UPDATE trades SET tick_seq = tick_seq - {offset_to_remove} WHERE symbol = '{symbol}' AND timestamp >= '{cut_ts}'"
                     print(f"  Executing: {update_query}")
                     run_query(update_query)
            elif diff < 100 and diff > -100:
                 # It's continuous. Using local offset. Same logic: revert to 1.
                 offset_to_remove = current_seq - 1
                 print(f"Symbol: {symbol} (Continuous fix detected)")
                 print(f"  Gap Found: {max_gap} at {cut_ts}")
                 print(f"  Removing offset: {offset_to_remove}")
                 
                 update_query = f"UPDATE trades SET tick_seq = tick_seq - {offset_to_remove} WHERE symbol = '{symbol}' AND timestamp >= '{cut_ts}'"
                 run_query(update_query)
            else:
                print(f"Symbol {symbol}: Gap found but weird diff ({diff}). Skipping.") 


        else:
            # print(f"Symbol {symbol}: No significant gap found.")
            pass

if __name__ == "__main__":
    undo_fix_tick_sequences()
