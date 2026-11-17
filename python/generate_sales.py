
import sqlite3
import random
from datetime import datetime
from decimal import Decimal

DB_NAME = "shopsales.db"

SHOPS = [
    ("S01", "Manchester"),
    ("S02", "Birmingham"),
    ("S03", "London")
]

# Product ID, name, category, unit price, sales weight
PRODUCTS = [
    ("P101", "Chicken Sandwich", "Food", 5.50, 12),
    ("P102", "Latte", "Drinks", 3.50, 22),
    ("P103", "Tuna Baguette", "Food", 5.00, 10),
    ("P104", "Croissant", "Food", 2.75, 15),
    ("P105", "Cappuccino", "Drinks", 3.60, 18),
    ("P106", "Americano", "Drinks", 3.00, 14),
    ("P107", "Chicken Baguette", "Food", 6.25, 12),
    ("P108", "Chocolate Muffin", "Food", 2.95, 8),
    ("P109", "Egg Sandwich", "Food", 4.50, 10),
    ("P110", "Orange Juice", "Drinks", 3.25, 7)
]

# Higher weights during breakfast and lunch.
# Hours are local shop trading hours (UK).
HOURLY_WEIGHTS = {
    6: 3,
    7: 7,
    8: 14,
    9: 12,
    10: 7,
    11: 9,
    12: 16,
    13: 15,
    14: 10,
    15: 7,
    16: 6,
    17: 5,
    18: 3,
    19: 2
}


def generate_transaction_time():
    hour = random.choices(
        list(HOURLY_WEIGHTS.keys()),
        weights=list(HOURLY_WEIGHTS.values()),
        k=1
    )[0]

    minute = random.randint(0, 59)
    second = random.randint(0, 59)

    return f"{hour:02d}:{minute:02d}:{second:02d}"


def generate_daily_sales(sales_date=None):
    if sales_date is None:
        sales_date = datetime.now().date()

    date_text = sales_date.isoformat()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        # Create source table if necessary.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ShopSales (
                TransactionID TEXT,
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

        # Add time column to existing databases safely.
        cursor.execute("PRAGMA table_info(ShopSales)")
        existing_columns = [
            row[1] for row in cursor.fetchall()
        ]

        if "TransactionTime" not in existing_columns:
            cursor.execute("""
                ALTER TABLE ShopSales
                ADD COLUMN TransactionTime TEXT
            """)

        # Prevent duplicate generation for the same day.
        cursor.execute("""
            SELECT COUNT(*)
            FROM ShopSales
            WHERE TransactionDate = ?
        """, (date_text,))

        if cursor.fetchone()[0] > 0:
            print("Sales already exist for", date_text)
            print("No new records generated.")
            return

        records = []
        sequence = 1

        for shop_id, shop_name in SHOPS:
            count = random.randint(100, 500)

            for _ in range(count):
                product = random.choices(
                    PRODUCTS,
                    weights=[p[4] for p in PRODUCTS],
                    k=1
                )[0]

                (
                    product_id,
                    product_name,
                    category,
                    price,
                    _
                ) = product

                quantity = random.choices(
                    [1, 2, 3, 4],
                    weights=[65, 25, 8, 2],
                    k=1
                )[0]

                amount = float(
                    Decimal(str(price)) * quantity
                )

                transaction_id = (
                    f"SYN-{sales_date:%Y%m%d}-{sequence:06d}"
                )

                transaction_time = generate_transaction_time()

                sequence += 1

                records.append((
                    transaction_id,
                    date_text,
                    transaction_time,
                    shop_id,
                    shop_name,
                    product_id,
                    product_name,
                    category,
                    quantity,
                    price,
                    amount
                ))

        cursor.executemany("""
            INSERT INTO ShopSales (
                TransactionID,
                TransactionDate,
                TransactionTime,
                ShopID,
                ShopName,
                ProductID,
                ProductName,
                Category,
                Quantity,
                UnitPrice,
                SalesAmount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, records)

        conn.commit()

        print("Daily sales generated:", date_text)
        print("New sales records:", len(records))

        print(
            "Generated revenue: £",
            f"{sum(r[10] for r in records):,.2f}",
            sep=""
        )

        print("Hourly transaction breakdown:")

        hourly_counts = {}

        for record in records:
            hour = record[2][:2]
            hourly_counts[hour] = (
                hourly_counts.get(hour, 0) + 1
            )

        for hour, count in sorted(hourly_counts.items()):
            print(f"{hour}:00 - {count} transactions")

    finally:
        conn.close()


if __name__ == "__main__":
    generate_daily_sales()
