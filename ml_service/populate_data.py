import psycopg2
import random
from datetime import datetime, timedelta
import json
import sys
import os

# App is running in /app in container
try:
    from config import settings
except ImportError:
    # Fallback for local run
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ml_service'))
    from config import settings

def populate():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()
        
        # Reduced list to ensuring repeating panels work cleanly
        symbols = ['OGDC', 'LUCK', 'TRG', 'SYS', 'PPL']
        
        # Only create BIG MOVES for these 3 (Testing Grid View)
        active_movers = ['OGDC', 'LUCK', 'TRG'] 
        
        base_time = datetime.now() - timedelta(hours=4)
        
        splits = 50 # Number of price points per symbol
        
        print("Generating continuous price data (trades)...")
        trade_records = []
        prediction_records = []
        
        for sym in symbols:
            price = 100.0
            vol = 1000
            
            # Stagger the big moves so they don't look identical
            if sym in active_movers:
                big_move_start = random.randint(10, 20)
                is_active = True
            else:
                big_move_start = -1
                is_active = False

            for i in range(splits):
                ts = base_time + timedelta(minutes=i*5)
                
                # Big Move Logic (Only for active movers)
                if is_active and i >= big_move_start and i < big_move_start + 10:
                    change = random.uniform(0.8, 2.5) # SUSTAINED UP TREND
                    vol = random.randint(10000, 50000) 
                else:
                    change = random.uniform(-0.3, 0.3) # Sideways
                    vol = random.randint(100, 5000)
                
                price += change
                
                # Insert into trades
                trade_records.append((sym, price, vol, price*vol, 0.0, i, ts))
                
                # Generate Prediction ONLY at the start of the Big Move
                if is_active and i == big_move_start:
                    act = 'buy'
                    conf = random.uniform(0.88, 0.99) # VERY HIGH CONFIDENCE
                    reg = 'bull'
                    agents = json.dumps({"Trend": 0.99, "Vol": 0.95})
                    
                    prediction_records.append((
                        ts, sym, act, conf, conf, reg, agents, price, conf
                    ))

        # Batch Insert Trades
        cur.executemany("""
            INSERT INTO trades (
                symbol, price, volume, value, daily_pct, tick_seq, timestamp
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, trade_records)
        
        # Batch Insert Predictions
        cur.executemany("""
            INSERT INTO ml_predictions (
                timestamp, symbol, action, signal_strength, confidence, regime, agents, start_price, prediction_probability
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, prediction_records)
        
        conn.commit()
        print(f"Successfully inserted {len(trade_records)} trades and {len(prediction_records)} predictions.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error populating data: {e}")

if __name__ == "__main__":
    populate()
