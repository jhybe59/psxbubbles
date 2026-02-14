import psycopg2

DSN = "postgresql://admin:quest@localhost:8812/qdb"

def check_history():
    try:
        conn = psycopg2.connect(DSN)
        cur = conn.cursor()
        
        cur.execute("SELECT count(*) FROM minute_bars;")
        count = cur.fetchone()[0]
        print(f"Total minute bars: {count}")
        
        cur.execute("SELECT count(*) FROM minute_bars WHERE symbol = 'OGDC';")
        ogdc_count = cur.fetchone()[0]
        print(f"OGDC bars: {ogdc_count}")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_history()
