import sys
import os
from sqlalchemy import text
from dotenv import load_dotenv
import psycopg2

load_dotenv()
url = os.getenv("DATABASE_URL")
print(f"Connecting to {url.split('@')[-1]}")

try:
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';")
    columns = [row[0] for row in cur.fetchall()]
    print("Columns in 'users':", columns)
    
    missing = ['theme_preference', 'is_private', 'account_type']
    for col in missing:
        if col not in columns:
            print(f"MISSING: {col}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
