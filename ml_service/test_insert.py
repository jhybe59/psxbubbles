from config import settings
import psycopg2
from datetime import datetime

conn = psycopg2.connect(settings.questdb_dsn)
cur = conn.cursor()

try:
    print("Testing ML Predictions Insert...")
    cur.execute("""
        INSERT INTO ml_predictions (
            timestamp, symbol, action, signal_strength, confidence, regime, agents, start_price, prediction_probability
        ) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (datetime.now(), 'TEST_INSERT', 'buy', 0.95, 0.88, 'bull', '{"TrendAgent": 1.0}', 100.50, 0.88))
    
    conn.commit()
    print("INSERT SUCCESS: Manually inserted test row")
    
except Exception as e:
    print(f"INSERT FAILED: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
