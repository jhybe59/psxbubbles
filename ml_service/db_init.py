import psycopg2
from config import settings

def init_db():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()

        # ML Predictions Table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ml_predictions (
            timestamp TIMESTAMP,
            symbol SYMBOL,
            prediction_probability DOUBLE
        ) timestamp(timestamp) PARTITION BY DAY;
        """)
        
        # Market Features Table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS market_features (
            timestamp TIMESTAMP,
            symbol SYMBOL,
            atr_14 DOUBLE,
            volatility_20 DOUBLE
        ) timestamp(timestamp) PARTITION BY DAY;
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("QuestDB tables initialized successfully.")
        
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == "__main__":
    init_db()
