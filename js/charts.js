let cashflowChart;
let categoryChart;
const colors = ['#ef8f64', '#579f91', '#f2c14e', '#7e9ce5', '#c28bda', '#edb4a1'];

const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value).replace('US$', '$');

export function renderCharts(transactions = [], monthCount = 6) {
  if (!window.Chart) return [];

  const cashflowEl = document.getElementById('cashflowChart');
  const categoryEl = document.getElementById('categoryChart');

  if (!cashflowEl || !categoryEl) return [];

  const now = new Date();
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - monthCount + index + 1, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).replace('.', '')
    };
  });

  const totals = type => months.map(month =>
    transactions
      .filter(item => item.type === type && item.date && item.date.startsWith(month.key))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  if (cashflowChart) {
    cashflowChart.destroy();
  }

  cashflowChart = new window.Chart(cashflowEl, {
    type: 'bar',
    data: {
      labels: months.map(item => item.label),
      datasets: [
        { label: 'Ingresos', data: totals('income'), backgroundColor: '#579f91', borderRadius: 5 },
        { label: 'Egresos', data: totals('expense'), backgroundColor: '#ef8f64', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => ` ${money(context.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(19,45,40,.08)' },
          border: { display: false },
          ticks: { callback: value => `$${value >= 1000 ? `${value / 1000}k` : value}` }
        }
      }
    }
  });

  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const byCategory = transactions
    .filter(item => item.type === 'expense' && item.date && item.date.startsWith(key))
    .reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Number(item.amount || 0);
      return result;
    }, {});

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (categoryChart) {
    categoryChart.destroy();
  }

  categoryChart = new window.Chart(categoryEl, {
    type: 'doughnut',
    data: {
      labels: entries.length ? entries.map(item => item[0]) : ['Sin egresos'],
      datasets: [{
        data: entries.length ? entries.map(item => item[1]) : [1],
        backgroundColor: entries.length ? colors : ['#e0e0e0'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '76%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  });

  return entries;
}
