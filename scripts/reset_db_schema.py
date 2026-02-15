import psycopg2
import sys
import os

# Add ml_service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ml_service'))

from config import settings

def reset_db():
    print(f"Connecting to QuestDB at {settings.questdb_host}:{settings.questdb_port}...")
    try:
        conn = psycopg2.connect(settings.questdb_dsn)
        cur = conn.cursor()

        print("Dropping ml_predictions table...")
        cur.execute("DROP TABLE IF EXISTS ml_predictions;")
        conn.commit()
        
        print("Recreating tables...")
        from db_init import init_db
        init_db()

        cur.close()
        conn.close()
        print("Database schema reset successfully.")
        
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    reset_db()
