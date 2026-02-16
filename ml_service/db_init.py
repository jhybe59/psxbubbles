import psycopg2
from config import settings

def init_db():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()

        # ML Predictions Table
        # Removed DROP to preserve history
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ml_predictions (
            timestamp TIMESTAMP,
            symbol SYMBOL,
            action SYMBOL,
            signal_strength DOUBLE,
            confidence DOUBLE,
            regime SYMBOL,
            agents STRING,
            start_price DOUBLE,
            prediction_probability DOUBLE
        ) timestamp(timestamp) PARTITION BY DAY;
        """)
        
        # Trades Table (Raw Ticks)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            timestamp TIMESTAMP,
            symbol SYMBOL,
            price DOUBLE,
            volume DOUBLE
        ) timestamp(timestamp) PARTITION BY DAY;
        """)
        
        # Minute Bars Table (OHLCV)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS minute_bars (
            timestamp TIMESTAMP,
            symbol SYMBOL,
            open DOUBLE,
            high DOUBLE,
            low DOUBLE,
            close DOUBLE,
            volume DOUBLE
        ) timestamp(timestamp) PARTITION BY MONTH;
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
