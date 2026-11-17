
"use strict";

// ==========================================
// SHOP SALES ANALYTICS DASHBOARD
// PART 1: SETUP AND DATA LOADING
// ==========================================

let salesData = [];

// ==========================================
// DASHBOARD FILTERS
// ==========================================

const shopFilter =
  document.getElementById("shopFilter");

const productFilter =
  document.getElementById("productFilter");

const periodFilter =
  document.getElementById("periodFilter");

const dateFilter =
  document.getElementById("dateFilter");

const weekFilter =
  document.getElementById("weekFilter");

const monthFilter =
  document.getElementById("monthFilter");

const dateFilterLabel =
  document.getElementById("dateFilterLabel");

const weekFilterLabel =
  document.getElementById("weekFilterLabel");

const monthFilterLabel =
  document.getElementById("monthFilterLabel");

const resetBtn =
  document.getElementById("resetBtn");

// ==========================================
// FINANCIAL ASSUMPTIONS
// ALL COSTS ARE SIMULATED ESTIMATES
// ==========================================

const FINANCIAL_CONFIG = {
  // Estimated product costs as a share of sales.
  foodCostRate: 0.38,
  drinksCostRate: 0.25,

  // Estimated waste as a share of revenue.
  wasteRate: 0.03,

  // Estimated hourly employment cost.
  hourlyLabourCost: 15.50,

  // Estimated labour hours per shop per day.
  labourHoursPerShopDay: 32,

  // Estimated other operating expenses
  // per shop per day.
  otherExpensesPerShopDay: 120
};

// ==========================================
// FORMATTING UTILITIES
// ==========================================

function money(value) {
  return "£" + Number(value || 0).toLocaleString(
    "en-GB",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}

function percentage(value) {
  return Number(value || 0).toFixed(1) + "%";
}

function numberFormat(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

// ==========================================
// DATE AND WEEK UTILITIES
// ==========================================

function todayISO() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day)
  );
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(dateText) {
  const date = parseDate(dateText);

  const weekday = date.getUTCDay();

  const offset = (weekday + 6) % 7;

  date.setUTCDate(
    date.getUTCDate() - offset
  );

  return formatDate(date);
}

function getISOWeek(dateText) {
  const date = parseDate(dateText);

  const weekday = date.getUTCDay() || 7;

  date.setUTCDate(
    date.getUTCDate() + 4 - weekday
  );

  const year = date.getUTCFullYear();

  const firstDay = new Date(
    Date.UTC(year, 0, 1)
  );

  const week = Math.ceil(
    (((date - firstDay) / 86400000) + 1) / 7
  );

  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekStartFromInput(value) {
  if (!/^\d{4}-W\d{2}$/.test(value)) {
    return "";
  }

  const [year, week] =
    value.split("-W").map(Number);

  const jan4 = new Date(
    Date.UTC(year, 0, 4)
  );

  const weekday = jan4.getUTCDay() || 7;

  jan4.setUTCDate(
    jan4.getUTCDate() -
    weekday +
    1 +
    (week - 1) * 7
  );

  return formatDate(jan4);
}

function getMonthFromDate(dateText) {
  return dateText.slice(0, 7);
}

// ==========================================
// LOAD SALES DATA
// ==========================================

async function loadSalesData() {
  try {
    const response = await fetch(
      "./sales_data.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load sales data"
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "Invalid sales data format"
      );
    }

    salesData = data.map(row => ({
      ...row,

      Quantity:
        Number(row.Quantity),

      UnitPrice:
        Number(row.UnitPrice),

      SalesAmount:
        Number(row.SalesAmount),

      TransactionTime:
        row.TransactionTime || null
    }));

    populateFilter(
      shopFilter,
      salesData.map(row => row.ShopName)
    );

    populateFilter(
      productFilter,
      salesData.map(row => row.ProductName)
    );

    const today = todayISO();

    dateFilter.value = today;

    weekFilter.value =
      getISOWeek(today);

    monthFilter.value =
      today.slice(0, 7);

    periodFilter.value = "daily";

    updatePeriodControls();
    updateDashboard();

    console.log(
      "Loaded transactions:",
      salesData.length
    );

  } catch (error) {
    console.error(
      "Dashboard loading error:",
      error
    );

    setText(
      "totalSales",
      "Data unavailable"
    );
  }
}

// ==========================================
// PART 2: FILTERS AND SALES AGGREGATION
// ==========================================

// Populate shop and product dropdowns.
function populateFilter(element, values) {
  if (!element) return;

  const unique = [
    ...new Set(values.filter(Boolean))
  ].sort();

  unique.forEach(value => {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    element.appendChild(option);
  });
}

// Show the correct date selector.
function updatePeriodControls() {
  const period = periodFilter.value;

  dateFilterLabel.style.display =
    period === "daily" ? "" : "none";

  weekFilterLabel.style.display =
    period === "weekly" ? "" : "none";

  monthFilterLabel.style.display =
    period === "monthly" ? "" : "none";

  // Show the weekly breakdown only
  // when Weekly Sales is selected.
  const weeklySection = document.getElementById(
    "weeklyBreakdownSection"
  );

  if (weeklySection) {
    weeklySection.style.display =
      period === "weekly" ? "" : "none";
  }
}

// Get the selected reporting period.
function getSelectedPeriod() {
  const period = periodFilter.value;

  if (period === "daily") {
    return {
      type: "daily",
      start: dateFilter.value,
      end: dateFilter.value
    };
  }

  if (period === "weekly") {
    const start = weekStartFromInput(
      weekFilter.value
    );

    if (!start) {
      return {
        type: "weekly",
        start: "",
        end: ""
      };
    }

    const endDate = parseDate(start);

    endDate.setUTCDate(
      endDate.getUTCDate() + 6
    );

    return {
      type: "weekly",
      start,
      end: formatDate(endDate)
    };
  }

  if (period === "monthly") {
    const month = monthFilter.value;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return {
        type: "monthly",
        start: "",
        end: ""
      };
    }

    const [year, monthNumber] =
      month.split("-").map(Number);

    const lastDay = new Date(
      Date.UTC(year, monthNumber, 0)
    );

    return {
      type: "monthly",
      start: `${month}-01`,
      end: formatDate(lastDay)
    };
  }

  return {
    type: "daily",
    start: "",
    end: ""
  };
}

// Check whether a transaction belongs
// to the selected reporting period.
function isDateInSelectedPeriod(dateText) {
  const selected = getSelectedPeriod();

  if (!selected.start || !selected.end) {
    return false;
  }

  return (
    dateText >= selected.start &&
    dateText <= selected.end
  );
}

// Filter transactions by period,
// shop and product.
function getFilteredSales() {
  const selectedShop = shopFilter.value;
  const selectedProduct = productFilter.value;

  return salesData.filter(row => {
    const shopMatch =
      selectedShop === "All" ||
      row.ShopName === selectedShop;

    const productMatch =
      selectedProduct === "All" ||
      row.ProductName === selectedProduct;

    const dateMatch =
      isDateInSelectedPeriod(
        row.TransactionDate
      );

    return (
      shopMatch &&
      productMatch &&
      dateMatch
    );
  });
}

// Aggregate sales by a selected field.
// Examples:
// ShopName, ProductName, Quantity.
function aggregate(
  rows,
  key,
  metric = "SalesAmount"
) {
  const totals = {};

  rows.forEach(row => {
    const name = row[key];

    if (!name) return;

    totals[name] =
      (totals[name] || 0) +
      Number(row[metric] || 0);
  });

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);
}

// Calculate revenue for a group of sales.
function calculateRevenue(rows) {
  return rows.reduce(
    (total, row) =>
      total + Number(row.SalesAmount || 0),
    0
  );
}

// Get the number of transactions.
function calculateTransactions(rows) {
  return rows.length;
}

// Calculate average transaction value.
function calculateAverageSale(rows) {
  const transactions =
    calculateTransactions(rows);

  if (transactions === 0) {
    return 0;
  }

  return (
    calculateRevenue(rows) /
    transactions
  );
}

// Return all dates within a reporting period.
function getPeriodDates() {
  const selected = getSelectedPeriod();

  if (!selected.start || !selected.end) {
    return [];
  }

  const dates = [];
  const current = parseDate(selected.start);
  const end = parseDate(selected.end);

  while (current <= end) {
    dates.push(formatDate(current));

    current.setUTCDate(
      current.getUTCDate() + 1
    );
  }

  return dates;
}

// Count days that have reached today's date.
// Future dates are excluded from estimates.
function getElapsedPeriodDates() {
  const today = todayISO();

  return getPeriodDates().filter(
    date => date <= today
  );
}

// ==========================================
// PART 3: SALES CHARTS AND TABLES
// ==========================================

// ==========================================
// BAR CHARTS
// ==========================================

function renderBars(
  elementId,
  entries,
  options = {}
) {
  const container =
    document.getElementById(elementId);

  if (!container) return;

  container.replaceChildren();

  if (!entries.length) {
    container.textContent =
      "No sales for selected period";
    return;
  }

  const maximum = Math.max(
    ...entries.map(entry => entry[1]),
    1
  );

  entries.forEach(([name, amount]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";

    const nameText = document.createElement("span");
    nameText.textContent = name;

    const amountText = document.createElement("strong");

    amountText.textContent = options.units
      ? `${numberFormat(amount)} units`
      : money(amount);

    label.append(nameText, amountText);

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");

    fill.className = options.product
      ? "bar-fill product-bar"
      : "bar-fill";

    fill.style.width =
      `${amount / maximum * 100}%`;

    track.appendChild(fill);
    row.append(label, track);

    container.appendChild(row);
  });
}

// ==========================================
// DAILY / WEEKLY / MONTHLY SALES TREND
// ==========================================

function renderDaily(rows) {
  const container =
    document.getElementById("dailyChart");

  if (!container) return;

  container.replaceChildren();

  const totals = {};

  rows.forEach(row => {
    const date = row.TransactionDate;

    totals[date] =
      (totals[date] || 0) +
      row.SalesAmount;
  });

  const selected = getSelectedPeriod();

  if (!selected.start || !selected.end) {
    container.textContent =
      "Select a valid reporting period";
    return;
  }

  const today = todayISO();

  // Show daily totals within the selected period.
  // Future dates are not plotted as zero sales.
  const entries = getPeriodDates()
    .filter(date => date <= today)
    .map(date => [
      date,
      totals[date] || 0
    ]);

  if (!entries.length) {
    container.textContent =
      "No completed dates in selected period";
    return;
  }

  const width = 700;
  const height = 250;

  const left = 70;
  const right = 25;
  const top = 25;
  const bottom = 55;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const maximum = Math.max(
    ...entries.map(entry => entry[1]),
    1
  );

  const svgNS =
    "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(
    svgNS,
    "svg"
  );

  svg.setAttribute(
    "viewBox",
    `0 0 ${width} ${height}`
  );

  svg.setAttribute("role", "img");

  svg.setAttribute(
    "aria-label",
    "Daily sales revenue trend"
  );

  function add(tag, attributes, text) {
    const element = document.createElementNS(
      svgNS,
      tag
    );

    Object.entries(attributes).forEach(
      ([key, value]) => {
        element.setAttribute(key, value);
      }
    );

    if (text !== undefined) {
      element.textContent = text;
    }

    svg.appendChild(element);

    return element;
  }

  // Horizontal grid lines.
  for (let i = 0; i <= 4; i++) {
    const y = top + chartH * i / 4;

    add("line", {
      x1: left,
      y1: y,
      x2: width - right,
      y2: y,
      stroke: "#e3eaf2"
    });

    add("text", {
      x: 5,
      y: y + 4,
      fill: "#64748b",
      "font-size": 12
    }, money(maximum * (4 - i) / 4));
  }

  const points = entries.map(
    ([date, value], index) => {
      const x = entries.length === 1
        ? left + chartW / 2
        : left +
          index * chartW /
          (entries.length - 1);

      const y =
        top +
        chartH -
        value / maximum * chartH;

      return {
        date,
        value,
        x,
        y
      };
    }
  );

  // Draw sales trend line.
  add("polyline", {
    points: points
      .map(point => `${point.x},${point.y}`)
      .join(" "),
    fill: "none",
    stroke: "#237bb7",
    "stroke-width": 3
  });

  // Show data points and dates.
  points.forEach((point, index) => {
    add("circle", {
      cx: point.x,
      cy: point.y,
      r: 5,
      fill: "#237bb7"
    });

    // Reduce labels for monthly charts.
    const labelEvery = Math.max(
      1,
      Math.ceil(points.length / 8)
    );

    if (
      index % labelEvery === 0 ||
      index === points.length - 1
    ) {
      add("text", {
        x: point.x,
        y: height - 18,
        "text-anchor": "middle",
        fill: "#64748b",
        "font-size": 12
      }, point.date.slice(5));
    }
  });

  container.appendChild(svg);
}

// ==========================================
// SALES TRANSACTION TABLE
// ==========================================

function renderTable(rows) {
  const tbody =
    document.getElementById("salesTable");

  if (!tbody) return;

  tbody.replaceChildren();

  const sorted = [...rows].sort(
    (a, b) =>
      b.TransactionDate.localeCompare(
        a.TransactionDate
      ) ||
      String(b.TransactionTime || "").localeCompare(
        String(a.TransactionTime || "")
      ) ||
      b.TransactionID.localeCompare(
        a.TransactionID
      )
  );

  sorted.forEach(row => {
    const tr = document.createElement("tr");

    const values = [
      row.TransactionID,
      row.TransactionDate,
      row.ShopName,
      row.ProductName,
      row.Quantity,
      money(row.SalesAmount)
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ==========================================
// WEEKLY SALES BREAKDOWN
// ==========================================

function renderWeeklyBreakdown(rows) {
  const section = document.getElementById(
    "weeklyBreakdownSection"
  );

  const tbody = document.getElementById(
    "weeklyBreakdownTable"
  );

  if (!section || !tbody) return;

  const isWeekly =
    periodFilter.value === "weekly";

  section.style.display =
    isWeekly ? "" : "none";

  if (!isWeekly) return;

  tbody.replaceChildren();

  const weekStart = weekStartFromInput(
    weekFilter.value
  );

  if (!weekStart) return;

  const start = parseDate(weekStart);

  let weeklyTotal = 0;
  let weeklyTransactions = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);

    date.setUTCDate(
      start.getUTCDate() + i
    );

    const dateText = formatDate(date);

    const dayName = date.toLocaleDateString(
      "en-GB",
      {
        weekday: "long",
        timeZone: "UTC"
      }
    );

    const dayRows = rows.filter(
      row => row.TransactionDate === dateText
    );

    const revenue =
      calculateRevenue(dayRows);

    const transactions =
      calculateTransactions(dayRows);

    const average = transactions
      ? revenue / transactions
      : 0;

    const isFuture =
      dateText > todayISO();

    weeklyTotal += revenue;
    weeklyTransactions += transactions;

    const tr = document.createElement("tr");

    const values = [
      dayName,
      dateText,
      isFuture
        ? "Not yet recorded"
        : money(revenue),
      isFuture
        ? "—"
        : numberFormat(transactions),
      isFuture
        ? "—"
        : money(average)
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // Weekly total row.
  const totalRow =
    document.createElement("tr");

  const totalValues = [
    "WEEK TOTAL",
    "",
    money(weeklyTotal),
    numberFormat(weeklyTransactions),
    money(
      weeklyTransactions
        ? weeklyTotal / weeklyTransactions
        : 0
    )
  ];

  totalValues.forEach(value => {
    const td = document.createElement("td");

    td.textContent = value;
    td.style.fontWeight = "bold";

    totalRow.appendChild(td);
  });

  tbody.appendChild(totalRow);
}

// ==========================================
// PART 4: PROFIT & LOSS AND LABOUR
// ==========================================

// ==========================================
// PRODUCT COST CALCULATIONS
// ==========================================

function getProductCostRate(category) {
  const value = String(category || "")
    .trim()
    .toLowerCase();

  if (value === "drinks") {
    return FINANCIAL_CONFIG.drinksCostRate;
  }

  return FINANCIAL_CONFIG.foodCostRate;
}

function calculateProductCosts(rows) {
  return rows.reduce((total, row) => {
    const rate = getProductCostRate(
      row.Category
    );

    return total +
      Number(row.SalesAmount || 0) * rate;
  }, 0);
}

// ==========================================
// LABOUR AND OPERATING COST ALLOCATION
// ==========================================

// Labour and other expenses are simulated
// at shop/day level.
//
// When a product is selected, we allocate
// shop/day costs proportionally to that
// product's share of shop/day revenue.
//
// This prevents assigning the entire
// shop's operating cost to one product.

function getOperatingCostAllocation(rows) {
  const selectedShop = shopFilter.value;
  const selectedProduct = productFilter.value;

  const eligibleSales = salesData.filter(row => {
    return isDateInSelectedPeriod(
      row.TransactionDate
    ) &&
    (
      selectedShop === "All" ||
      row.ShopName === selectedShop
    );
  });

  const shopDayTotals = new Map();

  eligibleSales.forEach(row => {
    const key =
      `${row.TransactionDate}|${row.ShopID}`;

    shopDayTotals.set(
      key,
      (shopDayTotals.get(key) || 0) +
      Number(row.SalesAmount || 0)
    );
  });

  const selectedShopDayTotals = new Map();

  rows.forEach(row => {
    const key =
      `${row.TransactionDate}|${row.ShopID}`;

    selectedShopDayTotals.set(
      key,
      (selectedShopDayTotals.get(key) || 0) +
      Number(row.SalesAmount || 0)
    );
  });

  let labourHours = 0;
  let labourCosts = 0;
  let otherExpenses = 0;

  selectedShopDayTotals.forEach(
    (selectedRevenue, key) => {
      const totalShopRevenue =
        shopDayTotals.get(key) || 0;

      if (totalShopRevenue <= 0) {
        return;
      }

      const allocation = Math.min(
        1,
        selectedRevenue / totalShopRevenue
      );

      const allocatedHours =
        FINANCIAL_CONFIG.labourHoursPerShopDay *
        allocation;

      labourHours += allocatedHours;

      labourCosts +=
        allocatedHours *
        FINANCIAL_CONFIG.hourlyLabourCost;

      otherExpenses +=
        FINANCIAL_CONFIG.otherExpensesPerShopDay *
        allocation;
    }
  );

  return {
    labourHours,
    labourCosts,
    otherExpenses,
    allocationType: selectedProduct === "All"
      ? "Full shop/day cost"
      : "Revenue-proportional allocation"
  };
}

// ==========================================
// COMPLETE PROFIT & LOSS CALCULATION
// ==========================================

function calculateProfitLoss(rows) {
  const revenue = calculateRevenue(rows);

  const productCosts =
    calculateProductCosts(rows);

  const grossProfit =
    revenue - productCosts;

  const wasteCosts =
    revenue * FINANCIAL_CONFIG.wasteRate;

  const operating =
    getOperatingCostAllocation(rows);

  const labourHours =
    operating.labourHours;

  const labourCosts =
    operating.labourCosts;

  const otherExpenses =
    operating.otherExpenses;

  const netProfit =
    grossProfit -
    labourCosts -
    wasteCosts -
    otherExpenses;

  const profitMargin = revenue > 0
    ? netProfit / revenue * 100
    : 0;

  const labourPercentage = revenue > 0
    ? labourCosts / revenue * 100
    : 0;

  const salesPerLabourHour = labourHours > 0
    ? revenue / labourHours
    : 0;

  return {
    revenue,
    productCosts,
    grossProfit,
    labourCosts,
    wasteCosts,
    otherExpenses,
    netProfit,
    profitMargin,
    labourHours,
    labourPercentage,
    salesPerLabourHour
  };
}

// ==========================================
// PROFIT & LOSS KPI CARDS
// ==========================================

function renderProfitLoss(rows) {
  const pl = calculateProfitLoss(rows);

  setText(
    "plRevenue",
    money(pl.revenue)
  );

  setText(
    "plProductCosts",
    money(pl.productCosts)
  );

  setText(
    "plGrossProfit",
    money(pl.grossProfit)
  );

  setText(
    "plLabourCosts",
    money(pl.labourCosts)
  );

  setText(
    "plWasteCosts",
    money(pl.wasteCosts)
  );

  setText(
    "plOtherExpenses",
    money(pl.otherExpenses)
  );

  setText(
    "plNetProfit",
    money(pl.netProfit)
  );

  setText(
    "plProfitMargin",
    percentage(pl.profitMargin)
  );

  renderProfitLossChart(pl);
  renderShopProfitTable(rows);
  renderLabourPerformance(rows, pl);
}

// ==========================================
// PROFIT & LOSS BREAKDOWN CHART
// ==========================================

function renderProfitLossChart(pl) {
  const entries = [
    ["Sales Revenue", pl.revenue],
    ["Product Costs", pl.productCosts],
    ["Gross Profit", pl.grossProfit],
    ["Labour Costs", pl.labourCosts],
    ["Waste Costs", pl.wasteCosts],
    ["Other Expenses", pl.otherExpenses],
    ["Net Profit", pl.netProfit]
  ];

  const container =
    document.getElementById("profitLossChart");

  if (!container) return;

  container.replaceChildren();

  // Handle negative profit with a signed
  // label and magnitude-based bar length.
  const maximum = Math.max(
    ...entries.map(([, value]) => Math.abs(value)),
    1
  );

  entries.forEach(([name, value]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";

    const nameText = document.createElement("span");
    nameText.textContent = name;

    const amountText =
      document.createElement("strong");

    amountText.textContent = money(value);

    label.append(nameText, amountText);

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";

    if (value < 0) {
      fill.style.background = "#dc2626";
    }

    fill.style.width =
      `${Math.abs(value) / maximum * 100}%`;

    track.appendChild(fill);
    row.append(label, track);

    container.appendChild(row);
  });
}

// ==========================================
// SHOP PROFITABILITY TABLE
// ==========================================

function renderShopProfitTable(rows) {
  const tbody =
    document.getElementById("shopProfitTable");

  if (!tbody) return;

  tbody.replaceChildren();

  const shops = [
    ...new Set(rows.map(row => row.ShopName))
  ].sort();

  if (!shops.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 8;
    td.textContent =
      "No shop sales for selected period";

    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const results = shops.map(shop => {
    const shopRows = rows.filter(
      row => row.ShopName === shop
    );

    return {
      shop,
      ...calculateProfitLoss(shopRows)
    };
  });

  results.sort(
    (a, b) => b.netProfit - a.netProfit
  );

  results.forEach(result => {
    const tr = document.createElement("tr");

    const values = [
      result.shop,
      money(result.revenue),
      money(result.productCosts),
      money(result.labourCosts),
      money(result.wasteCosts),
      money(result.otherExpenses),
      money(result.netProfit),
      percentage(result.profitMargin)
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ==========================================
// LABOUR PERFORMANCE
// ==========================================

function renderLabourPerformance(rows, pl) {
  setText(
    "labourHours",
    numberFormat(pl.labourHours.toFixed(1))
  );

  setText(
    "labourPercentage",
    percentage(pl.labourPercentage)
  );

  setText(
    "salesPerLabourHour",
    money(pl.salesPerLabourHour)
  );

  const shops = [
    ...new Set(rows.map(row => row.ShopName))
  ];

  const results = shops.map(shop => {
    const shopRows = rows.filter(
      row => row.ShopName === shop
    );

    return {
      shop,
      ...calculateProfitLoss(shopRows)
    };
  });

  results.sort(
    (a, b) => b.netProfit - a.netProfit
  );

  setText(
    "bestProfitShop",
    results.length ? results[0].shop : "—"
  );

  const labourEntries = results
    .map(result => [
      result.shop,
      result.salesPerLabourHour
    ])
    .sort((a, b) => b[1] - a[1]);

  renderBars(
    "labourEfficiencyChart",
    labourEntries
  );
}

// ==========================================
// PART 5: HOURLY ANALYTICS AND CONTROLS
// ==========================================

// ==========================================
// HOURLY SALES AND TRANSACTION CHARTS
// ==========================================

function renderHourlyCharts(rows) {
  const revenueContainer = document.getElementById(
    "hourlyRevenueChart"
  );

  const transactionsContainer = document.getElementById(
    "hourlyTransactionsChart"
  );

  if (!revenueContainer || !transactionsContainer) {
    return;
  }

  const timedRows = rows.filter(row =>
    typeof row.TransactionTime === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(
      row.TransactionTime
    )
  );

  if (!timedRows.length) {
    revenueContainer.textContent =
      "No hourly data available for this period yet.";

    transactionsContainer.textContent =
      "Hourly transactions will appear when timestamped sales are generated.";

    return;
  }

  // Create one entry for every hour.
  const hours = Array.from(
    { length: 24 },
    (_, hour) => ({
      label: String(hour).padStart(2, "0") + ":00",
      revenue: 0,
      transactions: 0
    })
  );

  timedRows.forEach(row => {
    const hour = Number(
      row.TransactionTime.slice(0, 2)
    );

    hours[hour].revenue +=
      Number(row.SalesAmount || 0);

    hours[hour].transactions += 1;
  });

  // Show hours with recorded transactions.
  const activeHours = hours.filter(
    hour => hour.transactions > 0
  );

  renderBars(
    "hourlyRevenueChart",
    activeHours.map(hour => [
      hour.label,
      hour.revenue
    ])
  );

  // Reuse bar chart rendering, but display
  // transaction counts rather than currency.
  renderBars(
    "hourlyTransactionsChart",
    activeHours.map(hour => [
      hour.label,
      hour.transactions
    ]),
    { units: true }
  );

  // Explain incomplete historical coverage.
  const missingTimes =
    rows.length - timedRows.length;

  if (missingTimes > 0) {
    const note = document.createElement("p");

    note.textContent =
      `${numberFormat(missingTimes)} historical transactions ` +
      "have no recorded time and are excluded " +
      "from hourly analysis.";

    note.style.fontSize = "12px";
    note.style.color = "#64748b";
    note.style.marginTop = "12px";

    revenueContainer.appendChild(note);
  }
}

// ==========================================
// UPDATE ALL DASHBOARD COMPONENTS
// ==========================================

function updateDashboard() {
  const filtered = getFilteredSales();

  const revenue = calculateRevenue(filtered);
  const transactions = calculateTransactions(filtered);
  const averageSale = calculateAverageSale(filtered);

  // Main sales KPI cards.
  setText(
    "totalSales",
    money(revenue)
  );

  setText(
    "transactions",
    numberFormat(transactions)
  );

  setText(
    "averageSale",
    money(averageSale)
  );

  // Existing sales charts.
  renderBars(
    "shopChart",
    aggregate(filtered, "ShopName")
  );

  renderBars(
    "productChart",
    aggregate(filtered, "ProductName"),
    { product: true }
  );

  renderBars(
    "bestSellersChart",
    aggregate(
      filtered,
      "ProductName",
      "Quantity"
    ).slice(0, 10),
    {
      product: true,
      units: true
    }
  );

  renderBars(
    "topRevenueChart",
    aggregate(
      filtered,
      "ProductName"
    ).slice(0, 10),
    { product: true }
  );

  // Daily, weekly and monthly trends.
  renderDaily(filtered);

  // Weekly breakdown and transactions.
  renderWeeklyBreakdown(filtered);
  renderTable(filtered);

  // New hourly sales analytics.
  renderHourlyCharts(filtered);

  // New Profit & Loss and labour analytics.
  renderProfitLoss(filtered);
    // Update historical weather vs sales analysis.
  if (
    historicalWeatherData.length > 0 &&
    typeof renderHistoricalWeatherSales === "function"
  ) {
    renderHistoricalWeatherSales();
  }
}

// ==========================================
// DASHBOARD EVENT LISTENERS
// ==========================================

// Reporting period selection.
periodFilter.addEventListener("change", () => {
  updatePeriodControls();
  updateDashboard();
});

// Date, week and month filters.
dateFilter.addEventListener(
  "change",
  updateDashboard
);

weekFilter.addEventListener(
  "change",
  updateDashboard
);

monthFilter.addEventListener(
  "change",
  updateDashboard
);

// Shop and product filters.
shopFilter.addEventListener(
  "change",
  updateDashboard
);

productFilter.addEventListener(
  "change",
  updateDashboard
);

// ==========================================
// RESET ALL FILTERS
// ==========================================

resetBtn.addEventListener("click", () => {
  const today = todayISO();

  shopFilter.value = "All";
  productFilter.value = "All";

  periodFilter.value = "daily";

  dateFilter.value = today;
  weekFilter.value = getISOWeek(today);
  monthFilter.value = today.slice(0, 7);

  updatePeriodControls();
  updateDashboard();
});

// ==========================================
// START THE DASHBOARD
// ==========================================

loadSalesData();

// ==========================================
// LIVE WEATHER INTEGRATION
// Source: Open-Meteo
// ==========================================

const WEATHER_LOCATIONS = [
  {
    name: "Manchester",
    latitude: 53.4808,
    longitude: -2.2426
  },
  {
    name: "Birmingham",
    latitude: 52.4862,
    longitude: -1.8904
  },
  {
    name: "London",
    latitude: 51.5074,
    longitude: -0.1278
  }
];

function getWeatherDescription(code) {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";

  return "Unknown conditions";
}

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅";
  if ([45, 48].includes(code)) return "🌫️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  if (code >= 51 && code <= 82) return "🌧️";

  return "🌤️";
}

async function fetchCityWeather(city) {
  const params = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    daily: [
  "temperature_2m_mean",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "weather_code"
].join(","),
forecast_days: "1",
    timezone: "Europe/London"
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `Weather request failed for ${city.name}`
    );
  }

  const data = await response.json();

  
if (!data.daily || !data.daily.time?.length) {
  throw new Error(
    `No daily weather data returned for ${city.name}`
  );
}

return {
  city: city.name,
  date: data.daily.time[0],
  temperature_2m_mean:
    data.daily.temperature_2m_mean?.[0] ?? null,
  temperature_2m_max:
    data.daily.temperature_2m_max?.[0] ?? null,
  temperature_2m_min:
    data.daily.temperature_2m_min?.[0] ?? null,
  precipitation_sum:
    data.daily.precipitation_sum?.[0] ?? null,
  weather_code:
    data.daily.weather_code?.[0] ?? null
};

}


async function loadWeatherInsights() {
  const container = document.getElementById(
    "weatherInsights"
  );

  if (!container) return;

  container.textContent = "Loading today's weather forecast...";

  const results = await Promise.allSettled(
    WEATHER_LOCATIONS.map(fetchCityWeather)
  );

  container.replaceChildren();

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns =
    "repeat(auto-fit, minmax(240px, 1fr))";
  grid.style.gap = "20px";

  function formatTemperature(value) {
    return value === null || value === undefined
      ? "N/A"
      : `${Number(value).toFixed(1)}°C`;
  }

  function formatRainfall(value) {
    return value === null || value === undefined
      ? "N/A"
      : `${Number(value).toFixed(1)} mm`;
  }

  results.forEach((result, index) => {
    const card = document.createElement("div");

    card.style.padding = "24px";
    card.style.border = "1px solid #dce5ef";
    card.style.borderRadius = "14px";
    card.style.background = "#f4f8fc";

    const heading = document.createElement("h3");
    heading.textContent = WEATHER_LOCATIONS[index].name;
    card.appendChild(heading);

    if (result.status === "rejected") {
      const error = document.createElement("p");
      error.textContent = "Daily weather forecast unavailable.";
      card.appendChild(error);
    } else {
      const weather = result.value;

      const date = document.createElement("p");
      date.textContent = `Daily forecast: ${weather.date}`;
      date.style.color = "#64748b";

      const condition = document.createElement("p");
      condition.style.fontSize = "18px";
      condition.textContent =
        `${getWeatherIcon(weather.weather_code)} ` +
        `${getWeatherDescription(weather.weather_code)}`;

      const average = document.createElement("div");
      average.style.margin = "20px 0";

      const averageLabel = document.createElement("p");
      averageLabel.textContent = "Average Temperature";

      const averageValue = document.createElement("h2");
      averageValue.textContent = formatTemperature(
        weather.temperature_2m_mean
      );

      average.append(averageLabel, averageValue);

      const highLow = document.createElement("p");
      highLow.textContent =
        `High: ${formatTemperature(weather.temperature_2m_max)} | ` +
        `Low: ${formatTemperature(weather.temperature_2m_min)}`;

      const rainfall = document.createElement("p");
      rainfall.textContent =
        `Expected Daily Precipitation: ` +
        formatRainfall(weather.precipitation_sum);

      card.append(
        date,
        condition,
        average,
        highLow,
        rainfall
      );
    }

    grid.appendChild(card);
  });

  container.appendChild(grid);

  const source = document.createElement("p");
  source.style.marginTop = "16px";
  source.style.fontSize = "12px";
  source.style.color = "#64748b";
  source.textContent =
    "Source: Open-Meteo. Full-day weather forecasts " +
    "for the current date in UK local time. " +
    "Forecast values may change as weather models update.";

  container.appendChild(source);
}


// Load weather independently of sales data.
loadWeatherInsights();

// ==========================================
// LOCAL EVENTS INTEGRATION
// ==========================================

async function loadLocalEvents() {
  const container = document.getElementById("localEvents");

  if (!container) return;

  container.textContent = "Loading local events...";

  try {
    const response = await fetch("./local_events.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load local events");
    }

    const data = await response.json();

    container.replaceChildren();

    if (data.status === "pending_api_approval") {
      const message = document.createElement("p");
      message.textContent =
        "Ticketmaster API approval pending. " +
        "Live event listings will appear here once connected.";

      container.appendChild(message);
      return;
    }

    if (!Array.isArray(data.cities)) {
      throw new Error("Invalid events data");
    }

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns =
      "repeat(auto-fit, minmax(220px, 1fr))";
    grid.style.gap = "16px";

    data.cities.forEach(cityData => {
      const card = document.createElement("div");

      card.style.padding = "20px";
      card.style.border = "1px solid #dce5ef";
      card.style.borderRadius = "12px";
      card.style.background = "#f8fafc";

      const heading = document.createElement("h4");
      heading.textContent = cityData.city;
      card.appendChild(heading);

      const events = Array.isArray(cityData.events)
        ? cityData.events
        : [];

      if (!events.length) {
        const empty = document.createElement("p");
        empty.textContent =
          "No event listings available yet.";
        card.appendChild(empty);
      }

      events.slice(0, 5).forEach(event => {
        const item = document.createElement("div");
        item.style.marginTop = "14px";
        item.style.paddingTop = "12px";
        item.style.borderTop = "1px solid #dce5ef";

        const name = document.createElement("strong");
        name.textContent = event.name || "Unnamed event";

        const details = document.createElement("p");
        details.textContent = [
          event.date,
          event.venue,
          event.category
        ].filter(Boolean).join(" | ");

        item.append(name, details);

        if (
          typeof event.url === "string" &&
          /^https:\/\//.test(event.url)
        ) {
          const link = document.createElement("a");
          link.href = event.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "View event";
          item.appendChild(link);
        }

        card.appendChild(item);
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);

    if (data.last_updated) {
      const updated = document.createElement("p");
      updated.style.marginTop = "12px";
      updated.style.fontSize = "12px";
      updated.textContent =
        `Events last updated: ${data.last_updated}`;
      container.appendChild(updated);
    }

  } catch (error) {
    console.error("Local events error:", error);

    container.textContent =
      "Local events are temporarily unavailable.";
  }
}

// Load events independently of sales and weather.
loadLocalEvents();



 // ==========================================
 // HISTORICAL WEATHER VS SALES ANALYSIS
 // ==========================================

let historicalWeatherData = [];

async function loadHistoricalWeather() {
  const status = document.getElementById(
    "weatherSalesStatus"
  );

  try {
    const response = await fetch(
      "./historical_weather.json",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Historical weather unavailable");
    }

    const data = await response.json();

    if (!Array.isArray(data.weather_records)) {
      throw new Error("Invalid historical weather data");
    }

    historicalWeatherData = data.weather_records;

    renderHistoricalWeatherSales();

  } catch (error) {
    console.error("Historical weather error:", error);

    if (status) {
      status.textContent =
        "Historical weather data is unavailable.";
    }
  }
}

function getHistoricalWeatherSalesRows() {
  const sales = getFilteredSales();

  // Aggregate selected sales by city and date.
  const totals = new Map();

  sales.forEach(row => {
    const shop = String(row.ShopName || "");
    const city = ["Manchester", "Birmingham", "London"]
      .find(name => shop.toLowerCase().includes(
        name.toLowerCase()
      ));

    if (!city) return;

    const key = `${city}|${row.TransactionDate}`;

    if (!totals.has(key)) {
      totals.set(key, {
        city,
        date: row.TransactionDate,
        revenue: 0,
        transactions: 0
      });
    }

    const item = totals.get(key);

    item.revenue += Number(row.SalesAmount || 0);
    item.transactions += 1;
  });

  // Join weather to sales using city + date.
  return historicalWeatherData
    .filter(weather =>
      weather &&
      typeof weather.city === "string" &&
      typeof weather.date === "string"
    )
    .map(weather => {
      const key = `${weather.city}|${weather.date}`;
      const sale = totals.get(key);

      if (!sale) return null;

      return {
        ...sale,
        temperature: weather.temperature_2m_mean,
        rainfall: weather.precipitation_sum
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      a.city.localeCompare(b.city)
    );
}

function renderHistoricalWeatherSales() {
  const status = document.getElementById(
    "weatherSalesStatus"
  );

  const rows = getHistoricalWeatherSalesRows();

  const temperatures = rows
    .map(row => row.temperature)
    .filter(value => value !== null &&
      Number.isFinite(Number(value)))
    .map(Number);

  const rainfallRows = rows.filter(row =>
    row.rainfall !== null &&
    Number.isFinite(Number(row.rainfall))
  );

  const averageTemp = temperatures.length
    ? temperatures.reduce((a, b) => a + b, 0) /
      temperatures.length
    : null;

  const totalRainfall = rainfallRows.reduce(
    (sum, row) => sum + Number(row.rainfall),
    0
  );

  const rainySales = rainfallRows
    .filter(row => Number(row.rainfall) > 0)
    .reduce((sum, row) => sum + row.revenue, 0);

  setText(
    "historicalAvgTemp",
    averageTemp === null
      ? "N/A"
      : `${averageTemp.toFixed(1)}°C`
  );

  setText(
    "historicalRainfall",
    rainfallRows.length
      ? `${totalRainfall.toFixed(1)} mm`
      : "N/A"
  );

  setText("rainyDaySales", money(rainySales));
  setText("matchedWeatherDays", numberFormat(rows.length));

  if (status) {
    status.textContent = rows.length
      ? `${rows.length} matched city-day records. ` +
        "Sales are simulated; weather is sourced from Open-Meteo."
      : "No matching historical weather and sales records " +
        "for the selected filters.";
  }

  function renderComparison(elementId, field, unit) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.replaceChildren();

    const valid = rows.filter(row =>
      row[field] !== null &&
      Number.isFinite(Number(row[field]))
    );

    if (!valid.length) {
      container.textContent = "No matching data available.";
      return;
    }

    const maximum = Math.max(
      ...valid.map(row => row.revenue), 1
    );

    valid.forEach(row => {
      const wrapper = document.createElement("div");
      wrapper.className = "bar-row";

      const label = document.createElement("div");
      label.className = "bar-label";

      const description = document.createElement("span");
      description.textContent =
        `${row.city} | ${row.date} | ` +
        `${Number(row[field]).toFixed(1)} ${unit}`;

      const amount = document.createElement("strong");
      amount.textContent = money(row.revenue);

      label.append(description, amount);

      const track = document.createElement("div");
      track.className = "bar-track";

      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width =
        `${(row.revenue / maximum) * 100}%`;

      track.appendChild(fill);
      wrapper.append(label, track);
      container.appendChild(wrapper);
    });
  }

function renderWeatherScatterChart(rows, type = "temperature") {
  const container = document.getElementById(
    type === "temperature"
  ? "temperatureSalesChart"
  : "rainfallSalesChart"
  );

  if (!container) return;

  container.replaceChildren();

  
const field = type === "temperature"
  ? "temperature"
  : "rainfall";

const valid = rows.filter(row =>
  row[field] !== null &&
  row[field] !== undefined &&
  Number.isFinite(Number(row[field])) &&
  Number.isFinite(Number(row.revenue))
);


  if (!valid.length) {
    container.textContent = "No matching data available.";
    return;
  }

  const width = 760;
  const height = 360;
  const left = 85;
  const right = 35;
  const top = 30;
  const bottom = 65;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const values = valid.map(row =>
  Number(row[field])
);

  const revenues = valid.map(row =>
    Number(row.revenue)
  );

  const minTemp = type === "rainfall"
  ? 0
  : Math.min(...values) - 1;

const maxTemp = Math.max(
  ...values,
  type === "rainfall" ? 0 : -Infinity
) + 1;
  const maxRevenue = Math.max(...revenues, 1) * 1.15;

  const xScale = value =>
    left + (value - minTemp) /
    (maxTemp - minTemp) * chartW;

  const yScale = value =>
    top + chartH - value / maxRevenue * chartH;

  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Scatter chart comparing temperature and revenue"
  );

  svg.style.width = "100%";
  svg.style.height = "auto";

  function add(tag, attributes, text, parent = svg) {
    const element = document.createElementNS(ns, tag);

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    if (text !== undefined) {
      element.textContent = text;
    }

    parent.appendChild(element);
    return element;
  }

  // Revenue grid lines and labels.
  for (let i = 0; i <= 4; i++) {
    const revenue = maxRevenue * i / 4;
    const y = yScale(revenue);

    add("line", {
      x1: left,
      y1: y,
      x2: width - right,
      y2: y,
      stroke: "#e1e8f0"
    });

    add("text", {
      x: left - 12,
      y: y + 4,
      "text-anchor": "end",
      fill: "#64748b",
      "font-size": 12
    }, "£" + Math.round(revenue).toLocaleString("en-GB"));
  }

  // Temperature axis labels.
  for (let i = 0; i <= 5; i++) {
    const temperature =
      minTemp + (maxTemp - minTemp) * i / 5;

    const x = xScale(temperature);

    add("text", {
      x,
      y: height - 38,
      "text-anchor": "middle",
      fill: "#64748b",
      "font-size": 12
    }, temperature.toFixed(1) +
  (type === "temperature" ? "°" : " mm"));
  }

  // Axis titles.
  add("text", {
    x: width / 2,
    y: height - 8,
    "text-anchor": "middle",
    fill: "#334155",
    "font-size": 14
  }, type === "temperature"
  ? "Average Temperature (°C)"
  : "Daily Precipitation (mm)");

  add("text", {
    x: 18,
    y: height / 2,
    transform: `rotate(-90 18 ${height / 2})`,
    "text-anchor": "middle",
    fill: "#334155",
    "font-size": 14
  }, "Sales Revenue (£)");

  const cityColors = {
    Manchester: "#237bb7",
    Birmingham: "#e59a36",
    London: "#36a28c"
  };

  valid.forEach(row => {
    const x = xScale(Number(row[field]));
    const y = yScale(Number(row.revenue));

    const circle = add("circle", {
      cx: x,
      cy: y,
      r: 9,
      fill: cityColors[row.city] || "#64748b",
      stroke: "#ffffff",
      "stroke-width": 2,
      tabindex: 0
    });

    
const details =
  `${row.city} | ${row.date}\n` +
  `${type === "temperature" ? "Temperature" : "Precipitation"}: ` +
  `${Number(row[field]).toFixed(1)}` +
  `${type === "temperature" ? "°C" : " mm"}\n` +
  `Revenue: ${money(row.revenue)}`;


    add("title", {}, details, circle);

    circle.addEventListener("mouseenter", () => {
      circle.setAttribute("r", 13);
    });

    circle.addEventListener("mouseleave", () => {
      circle.setAttribute("r", 9);
    });
  });

  container.appendChild(svg);
}

  renderWeatherScatterChart(rows, "temperature");
  renderWeatherScatterChart(rows, "rainfall");

  const tbody = document.getElementById(
    "weatherSalesTable"
  );

  if (!tbody) return;

  tbody.replaceChildren();

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "No matching records available.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");

    
const values = [
  row.date,
  row.city,
  row.temperature === null
    ? "N/A"
    : `${Number(row.temperature).toFixed(1)}°C`,
  money(row.revenue),
  numberFormat(row.transactions)
];


    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// Retrieve weather after the dashboard starts.
loadHistoricalWeather();
