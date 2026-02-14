
import requests

QUESTDB_EXEC_URL = "http://localhost:9000/exec"

def run_query(query):
    try:
        response = requests.get(QUESTDB_EXEC_URL, params={"query": query})
        if response.status_code == 200:
            return response.json()
        print(f"Error: {response.text}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def verify():
    # Check for any remaining tick_seq = 1 after 10 AM
    query = "SELECT count() FROM trades WHERE timestamp > '2026-02-12T10:00:00.000000Z' AND tick_seq = 1"
    res = run_query(query)
    
    if res and res['dataset']:
        count = res['dataset'][0][0]
        print(f"Remaining rows with tick_seq=1 after 10 AM: {count}")
        
        if count == 0:
            print("SUCCESS: All tick sequences appear to be fixed!")
        else:
            print("FAILURE: Some rows still have tick_seq=1.")
            # Let's see which symbols
            sym_query = "SELECT DISTINCT symbol FROM trades WHERE timestamp > '2026-02-12T10:00:00.000000Z' AND tick_seq = 1 LIMIT 5"
            sym_res = run_query(sym_query)
            if sym_res:
                print(f"Sample remaining symbols: {[r[0] for r in sym_res['dataset']]}")
    else:
        print("Could not verify.")

if __name__ == "__main__":
    verify()
