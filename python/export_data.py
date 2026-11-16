
import sqlite3
import json
from datetime import datetime

# ==========================================
# SHOP SALES DATA ENGINEERING PROJECT
# Export Clean Sales and Analytics to JSON
# ==========================================

DB_NAME = "shopsales.db"

conn = sqlite3.connect(DB_NAME)
conn.row_factory = sqlite3.Row

try:
    # ======================================
    # STEP 1: EXPORT CLEAN TRANSACTIONS
    # ======================================

    rows = conn.execute("""
        SELECT
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
        FROM CleanSales
        ORDER BY TransactionDate, TransactionID
    """).fetchall()

    sales_data = [dict(row) for row in rows]

    with open(
        "sales_data.json", "w", encoding="utf-8"
    ) as file:
        json.dump(sales_data, file, indent=2)

    print("STEP 1: Sales data exported")
    print("Records exported:", len(sales_data))

    # ======================================
    # STEP 2: OVERALL SALES KPIs
    # ======================================

    kpi = conn.execute("""
        SELECT
            COUNT(*) AS TotalTransactions,
            COALESCE(
                ROUND(SUM(SalesAmount), 2), 0
            ) AS TotalRevenue,
            COALESCE(
                ROUND(AVG(SalesAmount), 2), 0
            ) AS AverageTransactionValue,
            COALESCE(
                SUM(Quantity), 0
            ) AS TotalUnitsSold
        FROM CleanSales
    """).fetchone()

    # ======================================
    # STEP 3: TOP 10 BEST SELLERS
    # ======================================

    best_sellers = conn.execute("""
        SELECT
            ProductID,
            ProductName,
            Category,
            SUM(Quantity) AS UnitsSold,
            ROUND(
                SUM(SalesAmount), 2
            ) AS TotalRevenue
        FROM CleanSales
        GROUP BY
            ProductID, ProductName, Category
        ORDER BY UnitsSold DESC
        LIMIT 10
    """).fetchall()

    # ======================================
    # STEP 4: TOP PRODUCTS BY REVENUE
    # ======================================

    top_revenue = conn.execute("""
        SELECT
            ProductID,
            ProductName,
            Category,
            SUM(Quantity) AS UnitsSold,
            ROUND(
                SUM(SalesAmount), 2
            ) AS TotalRevenue
        FROM CleanSales
        GROUP BY
            ProductID, ProductName, Category
        ORDER BY TotalRevenue DESC
        LIMIT 10
    """).fetchall()

    # ======================================
    # STEP 5: SHOP PERFORMANCE
    # ======================================

    shops = conn.execute("""
        SELECT
            ShopID,
            ShopName,
            COUNT(*) AS Transactions,
            SUM(Quantity) AS UnitsSold,
            ROUND(
                SUM(SalesAmount), 2
            ) AS TotalRevenue
        FROM CleanSales
        GROUP BY ShopID, ShopName
        ORDER BY TotalRevenue DESC
    """).fetchall()

    # ======================================
    # STEP 6: DAILY SALES TRENDS
    # ======================================

    daily_sales = conn.execute("""
        SELECT
            TransactionDate,
            COUNT(*) AS Transactions,
            SUM(Quantity) AS UnitsSold,
            ROUND(
                SUM(SalesAmount), 2
            ) AS TotalRevenue
        FROM CleanSales
        GROUP BY TransactionDate
        ORDER BY TransactionDate
    """).fetchall()

    # ======================================
    # STEP 7: CATEGORY PERFORMANCE
    # ======================================

    categories = conn.execute("""
        SELECT
            Category,
            SUM(Quantity) AS UnitsSold,
            ROUND(
                SUM(SalesAmount), 2
            ) AS TotalRevenue
        FROM CleanSales
        GROUP BY Category
        ORDER BY TotalRevenue DESC
    """).fetchall()

    # ======================================
    # STEP 8: CREATE ANALYTICS JSON
    # ======================================

    analytics = {
        "GeneratedAt": datetime.now().isoformat(),
        "DataType": "Synthetic Sales Data",
        "KPIs": dict(kpi),
        "BestSellers": [
            dict(row) for row in best_sellers
        ],
        "TopRevenueProducts": [
            dict(row) for row in top_revenue
        ],
        "ShopPerformance": [
            dict(row) for row in shops
        ],
        "DailySales": [
            dict(row) for row in daily_sales
        ],
        "CategoryPerformance": [
            dict(row) for row in categories
        ]
    }

    with open(
        "sales_analytics.json", "w", encoding="utf-8"
    ) as file:
        json.dump(analytics, file, indent=2)

    print("\nSTEP 2: Analytics exported")
    print("Best-selling products:", len(best_sellers))
    print("Shops analysed:", len(shops))
    print("Daily sales periods:", len(daily_sales))

    print("\n" + "=" * 55)
    print("EXPORT COMPLETED SUCCESSFULLY")
    print("Files created:")
    print("1. sales_data.json")
    print("2. sales_analytics.json")
    print("=" * 55)

finally:
    conn.close()
