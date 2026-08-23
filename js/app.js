import { categories, downloadFile, loadData, saveData } from './storage.js';
import { addAccount, addTransfer, validateAccount, validateTransfer } from './accounts.js';
import { addTransaction, filterTransactions, validateTransaction } from './transactions.js';
import { renderCharts } from './charts.js';
import { fillSelects, notify, renderAccounts, renderBudgets, renderLegend, renderMetrics, renderMonthlyKpis, renderTransactions } from './ui.js';

let data = loadData();
let editingId = null;

const $ = selector => document.querySelector(selector);
const currency = () => data.settings?.baseCurrency || 'USD';

// UI setup
document.title = 'Alastor | Finanzas personales';
const brandEl = $('.brand');
if (brandEl) {
  const textNode = Array.from(brandEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = 'Alastor';
}
const footerSpan = $('footer span');
if (footerSpan) footerSpan.textContent = 'Alastor · Finanzas personales';

const profileAvatar = $('.avatar');
if (profileAvatar) {
  profileAvatar.innerHTML = '<img src="assets/perfil.jpg" alt="Perfil de Alastor">';
  const img = profileAvatar.querySelector('img');
  if (img) {
    img.onerror = () => { profileAvatar.textContent = 'MG'; };
  }
}

// Ensure Monthly KPI cards exist in metrics grid without duplicates
const metricsGrid = $('.metrics-grid');
if (metricsGrid && !$('#incomeValue')) {
  metricsGrid.insertAdjacentHTML(
    'beforeend',
    `<article class="metric-card">
      <div class="metric-label">Ingresos del mes <i class="fa-solid fa-arrow-down-to-bracket"></i></div>
      <strong class="metric-value" id="incomeValue">$0</strong>
      <div class="metric-foot">Entradas registradas este mes</div>
    </article>
    <article class="metric-card">
      <div class="metric-label">Egresos del mes <i class="fa-solid fa-arrow-up-from-bracket"></i></div>
      <strong class="metric-value" id="expenseValue">$0</strong>
      <div class="metric-foot">Salidas registradas este mes</div>
    </article>`
  );
}

function filters() {
  return {
    search: $('#searchInput')?.value || '',
    type: $('#typeFilter')?.value || 'all',
    account: $('#accountFilter')?.value || 'all',
    category: $('#categoryFilter')?.value || 'all',
    from: $('#fromDate')?.value || '',
    to: $('#toDate')?.value || '',
    sort: $('#sortFilter')?.value || 'date-desc'
  };
}

function refresh() {
  fillSelects(data, categories);
  renderMetrics(data, currency());
  renderMonthlyKpis(data, currency());
  renderAccounts(data, currency());
  const visible = filterTransactions(data, filters());
  renderTransactions(visible, data, editTransaction, deleteTransaction, currency());
  renderBudgets(data, currency(), deleteBudget);

  const chartRangeVal = Number($('#chartRange')?.value || 6);
  const entries = renderCharts(data.transactions, chartRangeVal) || [];
  renderLegend(entries, currency());
  saveData(data);
}

function openModal(id) {
  const el = $(id);
  if (el) el.hidden = false;
}

function closeModal(id) {
  const el = $(id);
  if (el) el.hidden = true;
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => { modal.hidden = true; });
}

function accountOptions() {
  if (!data.accounts || !data.accounts.length) {
    notify('Crea una cuenta antes de registrar movimientos', 'info');
    openModal('#accountModal');
    return false;
  }
  return true;
}

function editTransaction(id) {
  const item = data.transactions.find(transaction => transaction.id === id);
  if (!item) return;

  editingId = id;
  $('#transactionModalTitle').textContent = 'Editar movimiento';
  $('#transactionId').value = id;
  $('#description').value = item.description;
  $('#amount').value = item.amount;
  $('#transactionAccount').value = item.accountId;
  $('#category').value = item.category;
  $('#date').value = item.date;

  const radio = document.querySelector(`input[name="transactionType"][value="${item.type}"]`);
  if (radio) radio.checked = true;

  openModal('#transactionModal');
}

function deleteTransaction(id) {
  const isTransfer = (data.transfers || []).some(t => t.id === id);
  const item = isTransfer
    ? data.transfers.find(t => t.id === id)
    : data.transactions.find(t => t.id === id);

  if (!item) return;

  const title = isTransfer ? '¿Eliminar transferencia?' : '¿Eliminar movimiento?';
  const label = isTransfer ? `${item.description} (${item.amount})` : item.description;

  if (window.Swal) {
    window.Swal.fire({
      title,
      text: label,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef8f64'
    }).then(result => {
      if (result.isConfirmed) {
        if (isTransfer) {
          data.transfers = data.transfers.filter(t => t.id !== id);
        } else {
          data.transactions = data.transactions.filter(t => t.id !== id);
        }
        refresh();
        notify(isTransfer ? 'Transferencia eliminada' : 'Movimiento eliminado');
      }
    });
  } else if (confirm(`${title}\n${label}`)) {
    if (isTransfer) {
      data.transfers = data.transfers.filter(t => t.id !== id);
    } else {
      data.transactions = data.transactions.filter(t => t.id !== id);
    }
    refresh();
    notify(isTransfer ? 'Transferencia eliminada' : 'Movimiento eliminado');
  }
}

function deleteBudget(index) {
  data.budgets.splice(index, 1);
  refresh();
  notify('Presupuesto eliminado');
}

function csvExport() {
  const items = filterTransactions(data, filters());
  const headers = ['Descripción', 'Tipo', 'Monto', 'Cuenta Origen', 'Cuenta Destino / Categoría', 'Fecha'];
  const rows = items.map(item => {
    const account = data.accounts.find(a => a.id === item.accountId);
    const destAccount = item.toAccountId ? data.accounts.find(a => a.id === item.toAccountId) : null;
    const typeLabel = item.type === 'income' ? 'Ingreso' : item.type === 'transfer' ? 'Transferencia' : 'Egreso';
    const detail = item.type === 'transfer' ? (destAccount?.name || 'Destino N/A') : item.category;

    return [item.description, typeLabel, item.amount, account?.name || 'N/A', detail, item.date];
  });

  const content = [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n');

  downloadFile(content, 'finora-movimientos.csv', 'text/csv;charset=utf-8');
  notify('CSV exportado');
}

function jsonExport() {
  downloadFile(JSON.stringify(data, null, 2), 'finora-respaldo.json', 'application/json');
  notify('Respaldo exportado');
}

// Initial binding & load
fillSelects(data, categories);
if ($('#baseCurrency')) $('#baseCurrency').value = data.settings?.baseCurrency || 'USD';
refresh();

if ($('#baseCurrency')) {
  $('#baseCurrency').onchange = event => {
    if (!data.settings) data.settings = {};
    data.settings.baseCurrency = event.target.value;
    refresh();
  };
}

if ($('#chartRange')) {
  $('#chartRange').onchange = refresh;
}

['searchInput', 'typeFilter', 'accountFilter', 'categoryFilter', 'fromDate', 'toDate', 'sortFilter'].forEach(id => {
  const el = $(`#${id}`);
  if (el) el.addEventListener('input', refresh);
});

if ($('#clearFilters')) {
  $('#clearFilters').onclick = () => {
    ['searchInput', 'fromDate', 'toDate'].forEach(id => { if ($(`#${id}`)) $(`#${id}`).value = ''; });
    ['typeFilter', 'accountFilter', 'categoryFilter'].forEach(id => { if ($(`#${id}`)) $(`#${id}`).value = 'all'; });
    if ($('#sortFilter')) $('#sortFilter').value = 'date-desc';
    refresh();
  };
}

if ($('#openTransactionButton')) {
  $('#openTransactionButton').onclick = () => {
    if (!accountOptions()) return;
    editingId = null;
    $('#transactionForm').reset();
    $('#transactionModalTitle').textContent = 'Nuevo movimiento';
    $('#date').value = new Date().toISOString().slice(0, 10);
    fillSelects(data, categories);
    openModal('#transactionModal');
  };
}

if ($('#openTransferButton')) {
  $('#openTransferButton').onclick = () => {
    if (data.accounts.length < 2) {
      notify('Necesitas al menos dos cuentas para transferir', 'info');
      openModal('#accountModal');
      return;
    }
    fillSelects(data, categories);
    openModal('#transferModal');
  };
}

document.querySelectorAll('.close-modal').forEach(button => {
  button.onclick = () => closeModal(`#${button.dataset.modal}`);
});

// Close modals when clicking backdrop
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModal(`#${backdrop.id}`);
  });
});

// Close modals on Escape key
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeAllModals();
});

if ($('#transactionForm')) {
  $('#transactionForm').onsubmit = event => {
    event.preventDefault();
    const typeRadio = document.querySelector('input[name="transactionType"]:checked');
    const input = {
      type: typeRadio ? typeRadio.value : 'expense',
      description: $('#description').value,
      amount: Number($('#amount').value),
      accountId: $('#transactionAccount').value,
      category: $('#category').value,
      date: $('#date').value
    };

    const error = validateTransaction(data, input, editingId);
    if (error) return notify(error, 'error');

    addTransaction(data, input, editingId);
    closeModal('#transactionModal');
    refresh();
    notify(editingId ? 'Movimiento actualizado' : 'Movimiento guardado');
  };
}

if ($('#accountType')) {
  $('#accountType').onchange = event => {
    const creditFields = document.querySelector('.credit-fields');
    if (creditFields) creditFields.hidden = event.target.value !== 'credit';
  };
}

if ($('#addAccountButton')) {
  $('#addAccountButton').onclick = () => {
    $('#accountForm').reset();
    const creditFields = document.querySelector('.credit-fields');
    if (creditFields) creditFields.hidden = true;
    openModal('#accountModal');
  };
}

if ($('#accountForm')) {
  $('#accountForm').onsubmit = event => {
    event.preventDefault();
    const input = {
      name: $('#accountName').value,
      type: $('#accountType').value,
      initialBalance: Number($('#initialBalance').value || 0),
      currency: $('#accountCurrency').value,
      color: $('#accountColor').value,
      creditLimit: Number($('#creditLimit').value || 0),
      cutoffDay: Number($('#cutoffDay').value || 1),
      paymentDay: Number($('#paymentDay').value || 1)
    };

    const error = validateAccount(input);
    if (error) return notify(error, 'error');

    addAccount(data, input);
    closeModal('#accountModal');
    refresh();
    notify('Cuenta creada');
  };
}

if ($('#accountsList')) {
  $('#accountsList').onclick = event => {
    const button = event.target.closest('.delete-account');
    if (!button) return;

    const id = button.dataset.id;
    const account = data.accounts.find(a => a.id === id);
    if (!account) return;

    if (data.transactions.some(item => item.accountId === id) ||
        data.transfers.some(item => item.fromAccountId === id || item.toAccountId === id)) {
      return notify('No puedes eliminar una cuenta con movimientos', 'error');
    }

    const doDelete = () => {
      data.accounts = data.accounts.filter(a => a.id !== id);
      refresh();
      notify('Cuenta eliminada');
    };

    if (window.Swal) {
      window.Swal.fire({
        title: '¿Eliminar cuenta?',
        text: `Se eliminará la cuenta ${account.name}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef8f64'
      }).then(res => {
        if (res.isConfirmed) doDelete();
      });
    } else if (confirm(`¿Eliminar la cuenta ${account.name}?`)) {
      doDelete();
    }
  };
}

if ($('#transferForm')) {
  $('#transferForm').onsubmit = event => {
    event.preventDefault();
    const input = {
      fromAccountId: $('#fromAccount').value,
      toAccountId: $('#toAccount').value,
      amount: Number($('#transferAmount').value),
      description: $('#transferDescription').value,
      date: new Date().toISOString().slice(0, 10)
    };

    const error = validateTransfer(data, input.fromAccountId, input.toAccountId, input.amount);
    if (error) return notify(error, 'error');

    addTransfer(data, input);
    closeModal('#transferModal');
    refresh();
    notify('Transferencia realizada');
  };
}

if ($('#addBudgetButton')) {
  $('#addBudgetButton').onclick = () => {
    const category = prompt('Categoría del presupuesto:', categories[0]);
    if (!category) return;
    const limitInput = prompt('Límite mensual:', '300');
    const limit = Number(limitInput);

    if (!category.trim() || !Number.isFinite(limit) || limit <= 0) {
      return notify('Indica una categoría y un límite válido', 'error');
    }

    if (data.budgets.some(item => item.category.toLowerCase() === category.trim().toLowerCase())) {
      return notify('Ya existe un presupuesto para esa categoría', 'info');
    }

    data.budgets.push({ category: category.trim(), limit });
    refresh();
    notify('Presupuesto creado');
  };
}

if ($('#exportCsvButton')) $('#exportCsvButton').onclick = csvExport;
if ($('#exportJsonButton')) $('#exportJsonButton').onclick = jsonExport;
if ($('#importJsonButton')) $('#importJsonButton').onclick = () => $('#importFile').click();

if ($('#importFile')) {
  $('#importFile').onchange = event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.accounts) || !Array.isArray(imported.transactions) || !Array.isArray(imported.transfers) || !Array.isArray(imported.budgets)) {
          throw new Error('Estructura no válida');
        }
        data = { ...data, ...imported };
        refresh();
        notify('Respaldo importado');
      } catch {
        notify('El JSON no tiene un formato válido', 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };
}

if ($('#themeButton')) {
  $('#themeButton').onclick = () => {
    document.body.classList.toggle('warm-mode');
    const icon = $('#themeButton i');
    if (icon) {
      icon.className = document.body.classList.contains('warm-mode') ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
  };
}

if ($('#menuButton')) {
  $('#menuButton').onclick = () => {
    const sidebar = $('#sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => {
    const sidebar = $('#sidebar');
    if (sidebar) sidebar.classList.remove('open');
  };
});
