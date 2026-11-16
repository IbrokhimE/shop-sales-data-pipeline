
import sqlite3
import json
from pathlib import Path

DB_NAME = "shopsales.db"
JSON_FILE = Path("sales_data.json")

COLUMNS = [
    "TransactionID", "TransactionDate", "ShopID",
    "ShopName", "ProductID", "ProductName",
    "Category", "Quantity", "UnitPrice", "SalesAmount"
]

if not JSON_FILE.exists():
    print("No historical sales data found.")
    print("Starting with a new database.")
else:
    with JSON_FILE.open("r", encoding="utf-8") as file:
        sales = json.load(file)

    if not isinstance(sales, list):
        raise ValueError("Historical sales JSON must contain a list.")

    conn = sqlite3.connect(DB_NAME)

    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ShopSales (
                TransactionID TEXT PRIMARY KEY,
                TransactionDate TEXT,
                ShopID TEXT,
                ShopName TEXT,
                ProductID TEXT,
                ProductName TEXT,
                Category TEXT,
                Quantity INTEGER,
                UnitPrice REAL,
                SalesAmount REAL
            )
        """)

        records = [
            tuple(sale[column] for column in COLUMNS)
            for sale in sales
        ]

        conn.executemany("""
            INSERT OR IGNORE INTO ShopSales
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, records)

        conn.commit()

        print("Historical sales restored successfully.")
        print("Records in JSON:", len(records))
        print(
            "Records in database:",
            conn.execute(
                "SELECT COUNT(*) FROM ShopSales"
            ).fetchone()[0]
        )

    finally:
        conn.close()
