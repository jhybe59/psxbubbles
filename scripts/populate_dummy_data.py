import psycopg2
import random
from datetime import datetime, timedelta
import json
import sys
import os

# Add ml_service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ml_service'))
from config import settings

def populate():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()
        
        symbols = ['OGDC', 'LUCK', 'TRG', 'SYS', 'PPL']
        actions = ['buy', 'sell', 'hold']
        regimes = ['bull', 'bear', 'range']
        
        base_time = datetime.now() - timedelta(hours=2)
        records = []
        
        print("Generating 50 synthetic records...")
        for i in range(50):
            ts = base_time + timedelta(minutes=i*2)
            sym = random.choice(symbols)
            act = random.choice(actions)
            conf = random.uniform(0.7, 0.99)
            reg = random.choice(regimes)
            agents = json.dumps({"TrendAgent": random.uniform(0.5, 1.0), "VolAgent": random.uniform(0.5, 1.0)})
            price = 100.0 + random.uniform(-5, 5) + (i * 0.5)
            
            records.append((ts, sym, act, conf, conf, reg, agents, price, conf))
            
        cur.executemany("""
            INSERT INTO ml_predictions (
                timestamp, symbol, action, signal_strength, confidence, regime, agents, start_price, prediction_probability
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, records)
        
        conn.commit()
        print(f"Successfully inserted {len(records)} records.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error populating data: {e}")

if __name__ == "__main__":
    populate()
