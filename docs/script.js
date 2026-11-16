
let salesData = [];

async function loadSalesData() {
    try {
        const response = await fetch("./sales_data.json");

        if (!response.ok) {
            throw new Error("Failed to load sales data");
        }

        salesData = await response.json();
        console.log("Loaded transactions:", salesData.length);
        console.log("First transaction:", salesData[0]);

        populateFilter(shopFilter, salesData.map(r => r.ShopName));
        populateFilter(productFilter, salesData.map(r => r.ProductName));

        updateDashboard();
        console.log(
            "Sales data loaded:",
            salesData.length,
            "transactions"
        );



    } catch (error) {
        console.error("Error:", error);
    }
}

const shopFilter = document.getElementById("shopFilter");
const productFilter = document.getElementById("productFilter");
const money = n => "£" + n.toFixed(2);

function populateFilter(element, values) {
  [...new Set(values)].sort().forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.appendChild(option);
  });
}



function aggregate(rows, key) {
  const totals = {};
  rows.forEach(row => {
    totals[row[key]] = (totals[row[key]] || 0)
      + row.SalesAmount;
  });
  return Object.entries(totals)
    .sort((a,b) => b[1] - a[1]);
}

function renderBars(elementId, entries, product=false) {
  const container = document.getElementById(elementId);
  container.replaceChildren();

  const maximum = Math.max(...entries.map(e => e[1]), 1);

  entries.forEach(([name, amount]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";

    const nameText = document.createElement("span");
    nameText.textContent = name;

    const amountText = document.createElement("strong");
    amountText.textContent = money(amount);

    label.append(nameText, amountText);

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = product
      ? "bar-fill product-bar"
      : "bar-fill";
    fill.style.width = (amount / maximum * 100) + "%";

    track.appendChild(fill);
    row.append(label, track);
    container.appendChild(row);
  });

  if (!entries.length) {
    container.textContent = "No matching sales data";
  }
}

function renderDaily(rows) {
  const container = document.getElementById("dailyChart");
  container.replaceChildren();

  const totals = {};
  rows.forEach(row => {
    totals[row.TransactionDate] =
      (totals[row.TransactionDate] || 0)
      + row.SalesAmount;
  });

  const entries = Object.entries(totals)
    .sort((a,b) => a[0].localeCompare(b[0]));

  if (!entries.length) {
    container.textContent = "No matching sales data";
    return;
  }

  const width = 700, height = 230;
  const left = 55, right = 25, top = 25, bottom = 50;
  const chartW = width-left-right;
  const chartH = height-top-bottom;
  const maximum = Math.max(...entries.map(e=>e[1]),1);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Daily sales trend");

  function add(tag, attributes, text) {
    const el = document.createElementNS(svgNS,tag);
    Object.entries(attributes).forEach(([k,v]) =>
      el.setAttribute(k,v)
    );
    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  }

  for(let i=0;i<=4;i++){
    const y = top+chartH*i/4;
    add("line",{x1:left,y1:y,x2:width-right,y2:y,
      stroke:"#e3eaf2"});
    add("text",{x:5,y:y+4,fill:"#64748b","font-size":12},
      money(maximum*(4-i)/4));
  }

  const points = entries.map(([date,value],i)=>{
    const x = entries.length===1
      ? left+chartW/2
      : left+i*chartW/(entries.length-1);
    const y = top+chartH-(value/maximum)*chartH;
    return {date,value,x,y};
  });

  add("polyline",{
    points:points.map(p=>`${p.x},${p.y}`).join(" "),
    fill:"none",stroke:"#237bb7","stroke-width":3
  });

  points.forEach(p=>{
    add("circle",{cx:p.x,cy:p.y,r:5,fill:"#237bb7"});
    add("text",{
      x:p.x,y:height-18,"text-anchor":"middle",
      fill:"#64748b","font-size":12
    },p.date.slice(5));
  });

  container.appendChild(svg);
}

function renderTable(rows) {
  const tbody = document.getElementById("salesTable");
  tbody.replaceChildren();

  rows.forEach(row => {
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

function updateDashboard() {
  const shop = shopFilter.value;
  const product = productFilter.value;

  const filtered = salesData.filter(row =>
    (shop==="All" || row.ShopName===shop) &&
    (product==="All" || row.ProductName===product)
  );

  const total = filtered.reduce(
    (sum,row)=>sum+row.SalesAmount,0
  );
  const count = filtered.length;

  document.getElementById("totalSales").textContent =
    money(total);
  document.getElementById("transactions").textContent =
    count;
  document.getElementById("averageSale").textContent =
    money(count ? total/count : 0);

  renderBars("shopChart",aggregate(filtered,"ShopName"));
  renderBars("productChart",
    aggregate(filtered,"ProductName"),true);
  renderDaily(filtered);
  renderTable(filtered);
}

shopFilter.addEventListener("change",updateDashboard);
productFilter.addEventListener("change",updateDashboard);

document.getElementById("resetBtn")
  .addEventListener("click",()=>{
    shopFilter.value="All";
    productFilter.value="All";
    updateDashboard();
  });

loadSalesData();
