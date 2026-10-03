import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in .env")
    exit(1)

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("Checking for new columns...")
    
    cur.execute("ALTER TABLE sites ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE sites ADD COLUMN IF NOT EXISTS length INTEGER DEFAULT 0;")
    cur.execute("ALTER TABLE sites ADD COLUMN IF NOT EXISTS total_area INTEGER DEFAULT 0;")
    
    conn.commit()
    print("Success: Columns 'width', 'length', and 'total_area' added to 'sites' table!")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error updating database: {e}")
