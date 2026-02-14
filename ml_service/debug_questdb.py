
import requests
import pandas as pd
import io
from datetime import datetime

QUESTDB_URL = "http://localhost:9000/exec"

def query_questdb(query):
    response = requests.get(QUESTDB_URL, params={"query": query})
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

def inspect_ticks(symbol=None):
    # Query for latest data
    query = "SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10"
    print(f"Executing query: {query}")
    data = query_questdb(query)
    
    if data and 'dataset' in data:
        print(f"Latest 10 rows: {data['dataset']}")
        return data['dataset']
    else:
        print("No data found.")
        return []

if __name__ == "__main__":
    # You can change the symbol if needed, or leave None to see all
    inspect_ticks('OGDC') 
