import redis
import json
import time
from datetime import datetime, timedelta

import os

def simulate():
    redis_host = os.getenv('ML_REDIS_HOST', 'localhost')
    print(f"Connecting to Redis at {redis_host}:6379...")
    r = redis.Redis(host=redis_host, port=6379, db=0)
    
    symbol = "OGDC"
    ticks = []
    base_time = datetime.now() - timedelta(minutes=70)
    
    for i in range(1000):
        t = base_time + timedelta(minutes=i)
        ticks.append({
            "timestamp": t.isoformat(),
            "price": 120.0 + i,
            "volume": 100 + i*10,
            "side": "buy"
        })
    
    channel = f"ticks.raw.{symbol}"
    print(f"Publishing {len(ticks)} ticks to {channel}...")
    
    for i, msg in enumerate(ticks):
        subs = r.publish(channel, json.dumps(msg))
        print(f"Tick {i+1}: Subscribers={subs}")
        time.sleep(0.5)

    if subs == 0:
        print("WARNING: No subscribers found! Check if ml-service is connected to the same Redis.")

if __name__ == "__main__":
    simulate()
