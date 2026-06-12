(() => {
  const root = document.querySelector('.admin-dashboard');
  if (!root) return;

  const initial = window.__ADMIN_DASHBOARD_INITIAL__ || {};
  const state = {
    charts: {},
    range: initial.range || 'month',
  };

  const palette = {
    line: '#7b61ff',
    grid: '#e9edf7',
    status: ['#f5a623', '#2b7cff', '#39b9d6', '#61c454', '#eb4d6d'],
    category: ['#7b61ff', '#e66cb1', '#4ea0f5', '#66c294', '#f1b957', '#6acbe2'],
  };

  function toCurrency(v) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(v || 0));
  }

  function toNumber(v) {
    return new Intl.NumberFormat('id-ID').format(Number(v || 0));
  }

  function pctLabel(v) {
    const n = Number(v || 0);
    if (n === 0) return 'No change';
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  }

  function stars(rating) {
    const r = Math.round(Number(rating || 0));
    let out = '';
    for (let i = 1; i <= 5; i += 1) {
      out += i <= r ? '?' : '?';
    }
    return out;
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = value;
  }

  function createLineChart(canvasId, labels, data, tension = 0.38) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    return new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: palette.line,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: palette.line,
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            backgroundColor: 'rgba(123, 97, 255, 0.08)',
            tension,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#687491', font: { size: 11 } },
          },
          y: {
            grid: { color: palette.grid },
            ticks: {
              color: '#687491',
              callback(value) {
                return toNumber(value);
              },
            },
          },
        },
      },
    });
  }

  function createDoughnutChart(canvasId, labels, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: '#3c4560',
              font: { size: 11 },
            },
          },
        },
      },
    });
  }

  function upsertChart(name, factory) {
    if (state.charts[name]) {
      state.charts[name].destroy();
    }
    state.charts[name] = factory();
  }

  function fillKpis(data) {
    const kpis = data.kpis || {};

    const cardMap = {
      totalRevenue: toCurrency(kpis.totalRevenue),
      totalOrders: toNumber(kpis.totalOrders),
      pendingOrders: toNumber(kpis.pendingOrders),
      completedOrders: toNumber(kpis.completedOrders),
      totalProducts: toNumber(kpis.totalProducts),
      lowStockProducts: toNumber(kpis.lowStockProducts),
      totalCustomers: toNumber(kpis.totalCustomers),
      newCustomersToday: toNumber(kpis.newCustomersToday),
      totalStaff: toNumber(kpis.totalStaff),
      salesThisMonth: toCurrency(kpis.salesThisMonth),
    };

    Object.entries(cardMap).forEach(([key, value]) => {
      const card = document.querySelector(`[data-kpi-key="${key}"] .kpi-value`);
      if (card) card.textContent = value;
    });

    const revenueDelta = document.querySelector('[data-kpi-key="totalRevenue"] .kpi-delta');
    if (revenueDelta) revenueDelta.innerHTML = `${pctLabel(kpis.deltas?.revenueTodayVsYesterdayPct)} <span>vs yesterday</span>`;

    const ordersDelta = document.querySelector('[data-kpi-key="totalOrders"] .kpi-delta');
    if (ordersDelta) ordersDelta.innerHTML = `${pctLabel(kpis.deltas?.ordersTodayVsYesterdayPct)} <span>vs yesterday</span>`;

    const customerDelta = document.querySelector('[data-kpi-key="newCustomersToday"] .kpi-delta');
    if (customerDelta) customerDelta.innerHTML = `${pctLabel(kpis.deltas?.customersTodayVsYesterdayPct)} <span>vs yesterday</span>`;
  }

  function fillStrip(data) {
    const strip = data.strip || {};
    const items = document.querySelectorAll('#adminMetricStrip article strong');
    if (items.length < 6) return;

    items[0].textContent = toCurrency(strip.revenueToday);
    items[1].textContent = toNumber(strip.ordersToday);
    items[2].textContent = toNumber(strip.pendingOrders);
    items[3].textContent = `${toNumber(strip.lowStockProducts)} Products`;
    items[4].textContent = toNumber(strip.newCustomers7Days);
    items[5].textContent = toNumber(strip.completedOrders);
  }

  function listRow(main, sub, right, extraClass = '') {
    return `
      <div class="panel-row ${extraClass}">
        <span class="panel-main"><strong>${main}</strong><small>${sub || ''}</small></span>
        ${right}
      </div>
    `;
  }

  function emptyStateRow(title, description) {
    return `
      <div class="panel-empty">
        <strong>${title}</strong>
        <p>${description}</p>
      </div>
    `;
  }

  function fillTables(data) {
    const tables = data.tables || {};

    const topSelling = document.getElementById('topSellingProductsList');
    if (topSelling) {
      topSelling.innerHTML = (tables.topSellingProducts || []).map((item) => listRow(
        item.name,
        item.sku,
        `<span class="panel-sub">${toNumber(item.sold_qty)} sold</span><strong>${toCurrency(item.price)}</strong>`
      )).join('');
    }

    const bestSelling = document.getElementById('bestSellingProductsList');
    if (bestSelling) {
      const rows = tables.bestSellingProducts || [];
      bestSelling.innerHTML = rows.length > 0
        ? rows.map((item) => listRow(
          item.name,
          `${Number(item.avg_rating || 0).toFixed(1)} / 5 (${item.rating_count || 0})`,
          `<span class="panel-sub">${stars(item.avg_rating)}</span><strong>${toCurrency(item.total_revenue)}</strong>`
        )).join('')
        : emptyStateRow('Belum ada produk terjual', 'Data best seller akan muncul setelah ada transaksi.');
    }

    const recentOrders = document.getElementById('recentOrdersList');
    if (recentOrders) {
      const rows = tables.recentOrders || [];
      recentOrders.innerHTML = rows.length > 0
        ? rows.map((item) => listRow(
          `#${item.order_code}`,
          item.customer_name,
          `<span class="badge badge-${item.status}">${item.status}</span><strong>${toCurrency(item.total_amount)}</strong>`
        )).join('')
        : emptyStateRow('Belum ada order', 'Order customer akan muncul setelah checkout pertama.');
    }

    const lowStock = document.getElementById('lowStockProductsList');
    if (lowStock) {
      const rows = tables.lowStockProducts || [];
      lowStock.innerHTML = rows.length > 0
        ? rows.map((item) => listRow(
          item.name,
          item.sku,
          `<strong class="txt-danger">${item.stock} left</strong>`
        )).join('')
        : emptyStateRow('Belum ada produk stok rendah', 'Produk yang stoknya rendah akan muncul di sini.');
    }

    const recentCustomers = document.getElementById('recentCustomersList');
    if (recentCustomers) {
      const rows = tables.recentCustomers || [];
      recentCustomers.innerHTML = rows.length > 0
        ? rows.map((item) => {
          const time = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
          return listRow(item.name, item.email, `<strong>${time}</strong>`);
        }).join('')
        : emptyStateRow('Belum ada customer', 'Customer yang register akan muncul di sini.');
    }

    const recentReviews = document.getElementById('recentReviewsList');
    if (recentReviews) {
      recentReviews.innerHTML = (tables.recentReviews || []).map((item) => listRow(
        item.customer_name,
        item.product_name,
        `<span class="panel-sub">${stars(item.rating)}</span>`
      )).join('');
    }
  }

  function renderCharts(data) {
    const sales = data.salesSeries || { labels: [], data: [] };
    upsertChart('sales', () => createLineChart('salesChart', sales.labels, sales.data));

    const status = data.orderStatus || [];
    upsertChart('status', () => createDoughnutChart(
      'orderStatusChart',
      status.map((x) => x.label),
      status.map((x) => Number(x.total || 0)),
      palette.status
    ));

    const growth = data.customerGrowth || { labels: [], data: [] };
    upsertChart('growth', () => createLineChart('customerGrowthChart', growth.labels, growth.data, 0.33));

    const category = data.categoryRevenue || [];
    upsertChart('category', () => createDoughnutChart(
      'categoryRevenueChart',
      category.map((x) => x.label),
      category.map((x) => Number(x.value || 0)),
      palette.category
    ));
  }

  function setActiveRangeButton(range) {
    document.querySelectorAll('#salesRangeSwitch button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.range === range);
    });
  }

  async function refresh(range) {
    try {
      const response = await fetch(`/admin/dashboard/data?range=${encodeURIComponent(range)}`);
      if (!response.ok) return;

      const payload = await response.json();
      state.range = payload.range || range;
      fillKpis(payload);
      fillStrip(payload);
      fillTables(payload);
      renderCharts(payload);
      setActiveRangeButton(state.range);
    } catch (error) {
      console.error(error);
    }
  }

  function wireRangeSwitch() {
    const switcher = document.getElementById('salesRangeSwitch');
    if (!switcher) return;

    switcher.addEventListener('click', (event) => {
      const target = event.target.closest('button[data-range]');
      if (!target) return;
      const { range } = target.dataset;
      if (!range || range === state.range) return;

      refresh(range);
    });
  }

  setActiveRangeButton(state.range);
  fillKpis(initial);
  fillStrip(initial);
  fillTables(initial);
  renderCharts(initial);
  wireRangeSwitch();
})();
