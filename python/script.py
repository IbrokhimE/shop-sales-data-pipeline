
import sqlite3
from datetime import datetime

# ==========================================
# SHOP SALES DATA ENGINEERING PROJECT
# Python + SQLite Automated Batch Pipeline
# ==========================================

DB_NAME = "shopsales.db"

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

try:
    print("SHOP SALES DATA PIPELINE")
    print("Run time:", datetime.now())
    print("=" * 55)

    # ==========================================
    # STEP 1: CREATE SOURCE TABLE
    # ==========================================

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

    # Safely upgrade older databases.
    cursor.execute("PRAGMA table_info(ShopSales)")
    existing_columns = [
        row[1] for row in cursor.fetchall()
    ]

    if "TransactionTime" not in existing_columns:
        cursor.execute("""
            ALTER TABLE ShopSales
            ADD COLUMN TransactionTime TEXT
        """)

    # Original sample data.
    # Historical sample transactions have no recorded time.
    sales_data = [
        ("T001", "2026-09-01", "S01", "Manchester",
         "P101", "Chicken Sandwich", "Food", 2, 5.50, 11.00),

        ("T002", "2026-09-01", "S01", "Manchester",
         "P102", "Latte", "Drinks", 1, 3.50, 3.50),

        ("T003", "2026-09-01", "S02", "Birmingham",
         "P103", "Tuna Baguette", "Food", 2, 5.00, 10.00),

        ("T004", "2026-09-02", "S02", "Birmingham",
         "P102", "Latte", "Drinks", 3, 3.50, 10.50),

        ("T005", "2026-09-02", "S03", "London",
         "P104", "Croissant", "Food", 2, 2.75, 5.50),

        ("T006", "2026-09-02", "S01", "Manchester",
         "P101", "Chicken Sandwich", "Food", 1, 5.50, 5.50),

        # Intentional duplicate for quality testing.
        ("T006", "2026-09-02", "S01", "Manchester",
         "P101", "Chicken Sandwich", "Food", 1, 5.50, 5.50),

        ("T007", "2026-09-03", "S03", "London",
         "P102", "Latte", "Drinks", 2, 3.50, 7.00),

        # Intentional missing values.
        ("T008", "2026-09-03", "S02", "Birmingham",
         "P103", "Tuna Baguette", "Food", None, 5.00, None),

        # Intentional inconsistent shop name.
        ("T009", "2026-09-03", "S01", "manchester",
         "P104", "Croissant", "Food", 3, 2.75, 8.25)
    ]

    cursor.execute("SELECT COUNT(*) FROM ShopSales")

    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
            INSERT INTO ShopSales (
                TransactionID,
                TransactionDate,
                ShopID,
                ShopName,
                ProductID,
                ProductName,
                Category,
                Quantity,
                UnitPrice,
                SalesAmount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sales_data)

        print("Original sample data inserted.")
    else:
        print("Existing sales data preserved.")

    conn.commit()

    print("\nSTEP 1: Data ingestion completed")

    # ==========================================
    # STEP 2: DATA QUALITY VALIDATION
    # ==========================================

    print("\nSTEP 2: Automated validation checks")

    cursor.execute("""
        SELECT COUNT(*)
        FROM ShopSales
        WHERE Quantity IS NULL
           OR SalesAmount IS NULL
    """)
    missing = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COALESCE(SUM(record_count - 1), 0)
        FROM (
            SELECT COUNT(*) AS record_count
            FROM ShopSales
            GROUP BY TransactionID
            HAVING COUNT(*) > 1
        )
    """)
    duplicates = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM ShopSales
        WHERE Quantity IS NOT NULL
          AND SalesAmount IS NOT NULL
          AND UnitPrice IS NOT NULL
          AND ABS(SalesAmount - Quantity * UnitPrice) > 0.001
    """)
    incorrect_amounts = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM ShopSales
        WHERE TransactionTime IS NOT NULL
          AND (
              LENGTH(TransactionTime) != 8
              OR TransactionTime NOT GLOB
                 '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'
              OR CAST(SUBSTR(TransactionTime, 1, 2) AS INTEGER) > 23
          )
    """)
    invalid_times = cursor.fetchone()[0]

    print("Incomplete records:", missing)
    print("Duplicate records:", duplicates)
    print("Incorrect sales amounts:", incorrect_amounts)
    print("Invalid transaction times:", invalid_times)

    # ==========================================
    # STEP 3: CLEAN AND TRANSFORM DATA
    # ==========================================

    print("\nSTEP 3: Cleaning and transforming data")

    # Rebuild reporting table only.
    # Original source records remain untouched.
    cursor.execute("DROP TABLE IF EXISTS CleanSales")

    cursor.execute("""
        CREATE TABLE CleanSales AS
        SELECT
            TransactionID,
            TransactionDate,
            CASE
                WHEN TransactionTime IS NOT NULL
                 AND LENGTH(TransactionTime) = 8
                 AND TransactionTime GLOB
                     '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'
                 AND CAST(
                     SUBSTR(TransactionTime, 1, 2)
                     AS INTEGER
                 ) <= 23
                THEN TransactionTime
                ELSE NULL
            END AS TransactionTime,
            ShopID,
            CASE
                WHEN LOWER(TRIM(ShopName)) = 'manchester'
                THEN 'Manchester'
                ELSE TRIM(ShopName)
            END AS ShopName,
            ProductID,
            ProductName,
            Category,
            Quantity,
            UnitPrice,
            ROUND(Quantity * UnitPrice, 2) AS SalesAmount
        FROM ShopSales
        WHERE Quantity IS NOT NULL
          AND Quantity > 0
          AND UnitPrice IS NOT NULL
          AND UnitPrice >= 0
          AND SalesAmount IS NOT NULL
          AND ABS(SalesAmount - Quantity * UnitPrice) <= 0.001
          AND rowid IN (
              SELECT MIN(rowid)
              FROM ShopSales
              GROUP BY TransactionID
          )
    """)

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM CleanSales")
    cleaned_count = cursor.fetchone()[0]

    print("CleanSales table created")
    print("Clean records:", cleaned_count)

    # ==========================================
    # STEP 4: AUTOMATED DATA QUALITY TESTS
    # ==========================================

    print("\nSTEP 4: Automated tests")

    cursor.execute("""
        SELECT COUNT(*)
        FROM CleanSales
        WHERE Quantity IS NULL
           OR SalesAmount IS NULL
    """)

    assert cursor.fetchone()[0] == 0, \
        "Missing value test failed"

    print("Completeness test: PASS")

    cursor.execute("""
        SELECT COUNT(*)
        FROM (
            SELECT TransactionID
            FROM CleanSales
            GROUP BY TransactionID
            HAVING COUNT(*) > 1
        )
    """)

    assert cursor.fetchone()[0] == 0, \
        "Duplicate test failed"

    print("Uniqueness test: PASS")

    cursor.execute("""
        SELECT COUNT(*)
        FROM CleanSales
        WHERE ABS(SalesAmount - Quantity * UnitPrice) > 0.001
    """)

    assert cursor.fetchone()[0] == 0, \
        "Sales accuracy test failed"

    print("Sales accuracy test: PASS")

    # ==========================================
    # STEP 5: SALES PERFORMANCE BY SHOP
    # ==========================================

    print("\nSTEP 5: Sales performance by shop")
    print("-" * 60)

    cursor.execute("""
        SELECT
            ShopName,
            ROUND(SUM(SalesAmount), 2) AS TotalSales,
            COUNT(*) AS Transactions,
            ROUND(AVG(SalesAmount), 2) AS AverageSale
        FROM CleanSales
        GROUP BY ShopName
        ORDER BY TotalSales DESC
    """)

    for shop, total, count, average in cursor.fetchall():
        print(
            f"{shop}: £{total:.2f} | "
            f"Transactions: {count} | "
            f"Average: £{average:.2f}"
        )

    # ==========================================
    # STEP 6: OVERALL DASHBOARD KPIs
    # ==========================================

    print("\nSTEP 6: Dashboard KPIs")

    cursor.execute("""
        SELECT
            COUNT(*),
            ROUND(COALESCE(SUM(SalesAmount), 0), 2),
            ROUND(COALESCE(AVG(SalesAmount), 0), 2)
        FROM CleanSales
    """)

    transactions, total_sales, average_sale = cursor.fetchone()

    print("Total transactions:", transactions)
    print(f"Total sales: £{total_sales:,.2f}")
    print(f"Average transaction value: £{average_sale:.2f}")

    # ==========================================
    # STEP 7: TOP 10 BEST-SELLING PRODUCTS
    # ==========================================

    print("\nSTEP 7: Top 10 best-selling products")
    print("-" * 60)

    cursor.execute("""
        SELECT
            ProductName,
            SUM(Quantity) AS UnitsSold,
            ROUND(SUM(SalesAmount), 2) AS Revenue
        FROM CleanSales
        GROUP BY ProductName
        ORDER BY UnitsSold DESC, ProductName
        LIMIT 10
    """)

    for rank, (product, units, revenue) in enumerate(
        cursor.fetchall(), start=1
    ):
        print(
            f"{rank}. {product}: "
            f"{units} units sold | "
            f"Revenue: £{revenue:,.2f}"
        )

    # ==========================================
    # STEP 8: TOP 10 PRODUCTS BY REVENUE
    # ==========================================

    print("\nSTEP 8: Top 10 products by revenue")
    print("-" * 60)

    cursor.execute("""
        SELECT
            ProductName,
            SUM(Quantity) AS UnitsSold,
            ROUND(SUM(SalesAmount), 2) AS Revenue
        FROM CleanSales
        GROUP BY ProductName
        ORDER BY Revenue DESC, ProductName
        LIMIT 10
    """)

    for rank, (product, units, revenue) in enumerate(
        cursor.fetchall(), start=1
    ):
        print(
            f"{rank}. {product}: "
            f"£{revenue:,.2f} | "
            f"Units sold: {units}"
        )

    # ==========================================
    # STEP 9: HOURLY SALES PERFORMANCE
    # ==========================================

    print("\nSTEP 9: Hourly sales performance")
    print("-" * 60)

    cursor.execute("""
        SELECT
            SUBSTR(TransactionTime, 1, 2) AS Hour,
            COUNT(*) AS Transactions,
            ROUND(SUM(SalesAmount), 2) AS Revenue,
            ROUND(AVG(SalesAmount), 2) AS AverageSale
        FROM CleanSales
        WHERE TransactionTime IS NOT NULL
        GROUP BY SUBSTR(TransactionTime, 1, 2)
        ORDER BY Hour
    """)

    hourly_rows = cursor.fetchall()

    if hourly_rows:
        for hour, count, revenue, average in hourly_rows:
            print(
                f"{hour}:00 | "
                f"Transactions: {count} | "
                f"Revenue: £{revenue:,.2f} | "
                f"Average: £{average:.2f}"
            )
    else:
        print("No hourly data available yet.")
        print("Historical records have no transaction times.")

    # ==========================================
    # STEP 10: HOURLY DATA QUALITY
    # ==========================================

    print("\nSTEP 10: Hourly data quality")

    cursor.execute("""
        SELECT
            COUNT(*) AS TotalRecords,
            SUM(
                CASE
                    WHEN TransactionTime IS NOT NULL
                    THEN 1
                    ELSE 0
                END
            ) AS RecordsWithTime
        FROM CleanSales
    """)

    total_records, records_with_time = cursor.fetchone()
    records_with_time = records_with_time or 0

    print("Total cleaned records:", total_records)
    print("Records with transaction times:", records_with_time)
    print(
        "Records without transaction times:",
        total_records - records_with_time
    )

    # ==========================================
    # STEP 11: SAVE RESULTS
    # ==========================================

    conn.commit()

    print("\n" + "=" * 60)
    print("BATCH PIPELINE COMPLETED SUCCESSFULLY")
    print("Database saved as:", DB_NAME)
    print("Clean records processed:", cleaned_count)
    print("=" * 60)

finally:
    conn.close()
