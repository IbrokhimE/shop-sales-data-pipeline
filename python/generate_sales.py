
import sqlite3
import random
from datetime import datetime, timedelta
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

def generate_daily_sales(sales_date=None):
    if sales_date is None:
        sales_date = datetime.now().date()

    date_text = sales_date.isoformat()
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        # Create source table if necessary
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ShopSales (
                TransactionID TEXT,
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

        # Prevent accidental repeat generation
        cursor.execute("""
            SELECT COUNT(*) FROM ShopSales
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

                product_id, product_name, category, price, _ = product
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
                sequence += 1

                records.append((
                    transaction_id,
                    date_text,
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
                TransactionID, TransactionDate,
                ShopID, ShopName, ProductID,
                ProductName, Category, Quantity,
                UnitPrice, SalesAmount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, records)

        conn.commit()

        print("Daily sales generated:", date_text)
        print("New sales records:", len(records))
        print(
            "Generated revenue: £",
            f"{sum(r[9] for r in records):,.2f}",
            sep=""
        )

    finally:
        conn.close()


if __name__ == "__main__":
    generate_daily_sales()
