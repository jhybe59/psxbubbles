import psycopg2
from config import settings
import sys

def verify_db():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()

        cur.execute("SELECT count(*) FROM ml_predictions;")
        pred_count = cur.fetchone()[0]
        
        cur.execute("SELECT count(*) FROM market_features;")
        feat_count = cur.fetchone()[0]

        print(f"Predictions: {pred_count}")
        print(f"Features:    {feat_count}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error checking database: {e}")

if __name__ == "__main__":
    verify_db()
