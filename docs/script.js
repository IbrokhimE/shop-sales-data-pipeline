
let salesData = [];

const shopFilter = document.getElementById("shopFilter");
const productFilter = document.getElementById("productFilter");
const periodFilter = document.getElementById("periodFilter");
const dateFilter = document.getElementById("dateFilter");
const weekFilter = document.getElementById("weekFilter");
const dateFilterLabel = document.getElementById("dateFilterLabel");
const weekFilterLabel = document.getElementById("weekFilterLabel");
const resetBtn = document.getElementById("resetBtn");

const money = n => "£" + Number(n || 0).toFixed(2);

// ==========================================
// DATE AND WEEK UTILITIES
// ==========================================

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(dateText) {
  const date = parseDate(dateText);
  const weekday = date.getUTCDay();
  const offset = (weekday + 6) % 7;

  date.setUTCDate(date.getUTCDate() - offset);
  return formatDate(date);
}

function getISOWeek(dateText) {
  const date = parseDate(dateText);
  const weekday = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - weekday);

  const year = date.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    (((date - firstDay) / 86400000) + 1) / 7
  );

  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekStartFromInput(value) {
  if (!/^\d{4}-W\d{2}$/.test(value)) return "";

  const [year, week] = value.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekday = jan4.getUTCDay() || 7;

  jan4.setUTCDate(
    jan4.getUTCDate() - weekday + 1 + (week - 1) * 7
  );

  return formatDate(jan4);
}

// ==========================================
// LOAD SALES DATA
// ==========================================

async function loadSalesData() {
  try {
    const response = await fetch("./sales_data.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to load sales data");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid sales data format");
    }

    salesData = data.map(row => ({
      ...row,
      Quantity: Number(row.Quantity),
      UnitPrice: Number(row.UnitPrice),
      SalesAmount: Number(row.SalesAmount)
    }));

    populateFilter(
      shopFilter,
      salesData.map(row => row.ShopName)
    );

    populateFilter(
      productFilter,
      salesData.map(row => row.ProductName)
    );

    // Default to today's date.
    dateFilter.value = todayISO();
    weekFilter.value = getISOWeek(todayISO());
    periodFilter.value = "daily";

    updatePeriodControls();
    updateDashboard();

    console.log("Loaded transactions:", salesData.length);

  } catch (error) {
    console.error("Dashboard loading error:", error);
    document.getElementById("totalSales").textContent =
      "Data unavailable";
  }
}

// ==========================================
// FILTERS
// ==========================================

function populateFilter(element, values) {
  const unique = [...new Set(values.filter(Boolean))].sort();

  unique.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.appendChild(option);
  });
}

function updatePeriodControls() {
  const isDaily = periodFilter.value === "daily";

  dateFilterLabel.style.display = isDaily ? "" : "none";
  weekFilterLabel.style.display = isDaily ? "none" : "";
}

function getFilteredSales() {
  const shop = shopFilter.value;
  const product = productFilter.value;
  const period = periodFilter.value;

  const selectedDate = dateFilter.value;
  const selectedWeek = weekStartFromInput(weekFilter.value);

  return salesData.filter(row => {
    const shopMatch =
      shop === "All" || row.ShopName === shop;

    const productMatch =
      product === "All" || row.ProductName === product;

    let dateMatch = false;

    if (period === "daily") {
      dateMatch = row.TransactionDate === selectedDate;
    } else if (selectedWeek) {
      dateMatch =
        getWeekStart(row.TransactionDate) === selectedWeek;
    }

    return shopMatch && productMatch && dateMatch;
  });
}

// ==========================================
// AGGREGATION
// ==========================================

function aggregate(rows, key, metric = "SalesAmount") {
  const totals = {};

  rows.forEach(row => {
    const name = row[key];
    totals[name] =
      (totals[name] || 0) + Number(row[metric] || 0);
  });

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);
}

// ==========================================
// BAR CHARTS
// ==========================================

function renderBars(elementId, entries, options = {}) {
  const container = document.getElementById(elementId);
  if (!container) return;

  container.replaceChildren();

  if (!entries.length) {
    container.textContent = "No sales for selected period";
    return;
  }

  const maximum = Math.max(...entries.map(e => e[1]), 1);

  entries.forEach(([name, amount]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";

    const nameText = document.createElement("span");
    nameText.textContent = name;

    const amountText = document.createElement("strong");
    amountText.textContent =
      options.units ? `${amount} units` : money(amount);

    label.append(nameText, amountText);

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = options.product
      ? "bar-fill product-bar"
      : "bar-fill";

    fill.style.width = `${amount / maximum * 100}%`;

    track.appendChild(fill);
    row.append(label, track);
    container.appendChild(row);
  });
}

// ==========================================
// DAILY / WEEKLY TREND CHART
// ==========================================

function renderDaily(rows) {
  const container = document.getElementById("dailyChart");
  container.replaceChildren();

  const totals = {};

  rows.forEach(row => {
    const date = row.TransactionDate;
    totals[date] = (totals[date] || 0) + row.SalesAmount;
  });

  let entries;

  if (periodFilter.value === "weekly") {
    const startText = weekStartFromInput(weekFilter.value);

    if (!startText) {
      container.textContent = "Select a valid week";
      return;
    }

    const start = parseDate(startText);

    entries = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      const dateText = formatDate(date);

      return [dateText, totals[dateText] || 0];
    });
  } else {
    const date = dateFilter.value;
    entries = date ? [[date, totals[date] || 0]] : [];
  }

  if (!entries.length) {
    container.textContent = "Select a valid date";
    return;
  }

  const width = 700;
  const height = 230;
  const left = 65;
  const right = 25;
  const top = 25;
  const bottom = 50;

  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const maximum = Math.max(...entries.map(e => e[1]), 1);
  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Sales by day");

  function add(tag, attributes, text) {
    const el = document.createElementNS(svgNS, tag);

    Object.entries(attributes).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });

    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  }

  for (let i = 0; i <= 4; i++) {
    const y = top + chartH * i / 4;

    add("line", {
      x1: left, y1: y,
      x2: width - right, y2: y,
      stroke: "#e3eaf2"
    });

    add("text", {
      x: 5, y: y + 4,
      fill: "#64748b",
      "font-size": 12
    }, money(maximum * (4 - i) / 4));
  }

  const points = entries.map(([date, value], i) => {
    const x = entries.length === 1
      ? left + chartW / 2
      : left + i * chartW / (entries.length - 1);

    const y = top + chartH - value / maximum * chartH;

    return { date, value, x, y };
  });

  add("polyline", {
    points: points.map(p => `${p.x},${p.y}`).join(" "),
    fill: "none",
    stroke: "#237bb7",
    "stroke-width": 3
  });

  points.forEach(point => {
    add("circle", {
      cx: point.x,
      cy: point.y,
      r: 5,
      fill: "#237bb7"
    });

    add("text", {
      x: point.x,
      y: height - 18,
      "text-anchor": "middle",
      fill: "#64748b",
      "font-size": 12
    }, point.date.slice(5));
  });

  container.appendChild(svg);
}

// ==========================================
// TRANSACTION TABLE
// ==========================================

function renderTable(rows) {
  const tbody = document.getElementById("salesTable");
  tbody.replaceChildren();

  const sorted = [...rows].sort((a, b) =>
    b.TransactionDate.localeCompare(a.TransactionDate) ||
    b.TransactionID.localeCompare(a.TransactionID)
  );

  sorted.forEach(row => {
    const tr = document.createElement("tr");

    [
      row.TransactionID,
      row.TransactionDate,
      row.ShopName,
      row.ProductName,
      row.Quantity,
      money(row.SalesAmount)
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard() {
  const filtered = getFilteredSales();

  const total = filtered.reduce(
    (sum, row) => sum + row.SalesAmount, 0
  );

  const count = filtered.length;

  document.getElementById("totalSales").textContent =
    money(total);

  document.getElementById("transactions").textContent =
    count.toLocaleString("en-GB");

  document.getElementById("averageSale").textContent =
    money(count ? total / count : 0);

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
    aggregate(filtered, "ProductName", "Quantity").slice(0, 10),
    { product: true, units: true }
  );

  renderBars(
    "topRevenueChart",
    aggregate(filtered, "ProductName").slice(0, 10),
    { product: true }
  );

  renderDaily(filtered);
  renderTable(filtered);
  renderWeeklyBreakdown(filtered);
}

// ==========================================
// EVENT LISTENERS
// ==========================================


function renderWeeklyBreakdown(rows) {
  const section = document.getElementById("weeklyBreakdownSection");
  const tbody = document.getElementById("weeklyBreakdownTable");

  if (!section || !tbody) return;

  const isWeekly = periodFilter.value === "weekly";
  section.style.display = isWeekly ? "" : "none";

  if (!isWeekly) return;

  tbody.replaceChildren();

  const weekStart = weekStartFromInput(weekFilter.value);
  if (!weekStart) return;

  const start = parseDate(weekStart);
  let weeklyTotal = 0;
  let weeklyTransactions = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);

    const dateText = formatDate(date);
    const dayName = date.toLocaleDateString("en-GB", {
      weekday: "long",
      timeZone: "UTC"
    });

    const dayRows = rows.filter(
      row => row.TransactionDate === dateText
    );

    const revenue = dayRows.reduce(
      (sum, row) => sum + row.SalesAmount, 0
    );

    const transactions = dayRows.length;
    const average = transactions ? revenue / transactions : 0;

    const isFuture = dateText > todayISO();

    weeklyTotal += revenue;
    weeklyTransactions += transactions;

    const tr = document.createElement("tr");

    const values = [
      dayName,
      dateText,
      isFuture ? "Not yet recorded" : money(revenue),
      isFuture ? "—" : transactions.toLocaleString("en-GB"),
      isFuture ? "—" : money(average)
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  const totalRow = document.createElement("tr");

  [
    "WEEK TOTAL",
    "",
    money(weeklyTotal),
    weeklyTransactions.toLocaleString("en-GB"),
    money(
      weeklyTransactions
        ? weeklyTotal / weeklyTransactions
        : 0
    )
  ].forEach(value => {
    const td = document.createElement("td");
    td.textContent = value;
    td.style.fontWeight = "bold";
    totalRow.appendChild(td);
  });

  tbody.appendChild(totalRow);
}

periodFilter.addEventListener("change", () => {
  updatePeriodControls();
  updateDashboard();
});

dateFilter.addEventListener("change", updateDashboard);
weekFilter.addEventListener("change", updateDashboard);
shopFilter.addEventListener("change", updateDashboard);
productFilter.addEventListener("change", updateDashboard);

resetBtn.addEventListener("click", () => {
  shopFilter.value = "All";
  productFilter.value = "All";
  periodFilter.value = "daily";
  dateFilter.value = todayISO();
  weekFilter.value = getISOWeek(todayISO());

  updatePeriodControls();
  updateDashboard();
});

loadSalesData();
