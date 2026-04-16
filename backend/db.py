import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()  # reads backend/.env automatically

def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "student-data-management")
    )
