
import sqlite3
import json
from pathlib import Path

DB_NAME = "shopsales.db"
JSON_FILE = Path("sales_data.json")

COLUMNS = [
    "TransactionID",
    "TransactionDate",
    "TransactionTime",
    "ShopID",
    "ShopName",
    "ProductID",
    "ProductName",
    "Category",
    "Quantity",
    "UnitPrice",
    "SalesAmount"
]


def restore_sales():
    if not JSON_FILE.exists():
        print("No historical sales data found.")
        print("Starting with a new database.")
        return

    with JSON_FILE.open("r", encoding="utf-8") as file:
        sales = json.load(file)

    if not isinstance(sales, list):
        raise ValueError(
            "Historical sales JSON must contain a list."
        )

    conn = sqlite3.connect(DB_NAME)

    try:
        # Create the source table if it does not exist.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ShopSales (
                TransactionID TEXT PRIMARY KEY,
                TransactionDate TEXT,
                TransactionTime TEXT,
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

        # Safely migrate databases created before
        # TransactionTime was introduced.
        existing_columns = [
            row[1]
            for row in conn.execute(
                "PRAGMA table_info(ShopSales)"
            )
        ]

        if "TransactionTime" not in existing_columns:
            conn.execute("""
                ALTER TABLE ShopSales
                ADD COLUMN TransactionTime TEXT
            """)

        # Older JSON records may not have TransactionTime.
        # Store NULL rather than inventing historical times.
        records = []

        for sale in sales:
            record = tuple(
                sale.get(column)
                if column == "TransactionTime"
                else sale[column]
                for column in COLUMNS
            )

            records.append(record)

        # Explicit column names avoid depending on
        # the physical order of SQLite table columns.
        placeholders = ", ".join(
            ["?"] * len(COLUMNS)
        )

        column_names = ", ".join(COLUMNS)

        conn.executemany(
            f"""
            INSERT OR IGNORE INTO ShopSales (
                {column_names}
            )
            VALUES ({placeholders})
            """,
            records
        )

        conn.commit()

        print("Historical sales restored successfully.")
        print("Records in JSON:", len(records))

        print(
            "Records in database:",
            conn.execute(
                "SELECT COUNT(*) FROM ShopSales"
            ).fetchone()[0]
        )

        print(
            "Records with transaction times:",
            conn.execute("""
                SELECT COUNT(*)
                FROM ShopSales
                WHERE TransactionTime IS NOT NULL
            """).fetchone()[0]
        )

    finally:
        conn.close()


if __name__ == "__main__":
    restore_sales()
