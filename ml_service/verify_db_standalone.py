import psycopg2
import time

DSN = "postgresql://admin:quest@localhost:8812/qdb"

def verify_loop():
    print(f"Connecting to QuestDB at {DSN}...")
    try:
        conn = psycopg2.connect(DSN)
        cur = conn.cursor()
        
        print("Monitoring data ingestion (Ctrl+C to stop)...")
        print(f"{'Time':<10} | {'Predictions':<12} | {'Features':<10}")
        print("-" * 40)

        for _ in range(12): # Monitor for 1 minute (every 5s)
            try:
                cur.execute("SELECT count(*) FROM ml_predictions;")
                pred_count = cur.fetchone()[0]
                
                cur.execute("SELECT count(*) FROM market_features;")
                feat_count = cur.fetchone()[0]

                print(f"{time.strftime('%H:%M:%S'):<10} | {pred_count:<12} | {feat_count:<10}")
                conn.commit() # Ensure we see new data
            except Exception as e:
                print(f"Query error: {e}")
                
            time.sleep(5)
            
        conn.close()
        
    except Exception as e:
        print(f"Error checking database: {e}")

if __name__ == "__main__":
    verify_loop()
